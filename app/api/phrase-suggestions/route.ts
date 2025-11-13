import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { ratelimit, getRateLimitIdentifier } from '@/lib/ratelimit'

/**
 * POST /api/phrase-suggestions
 * Generate personalized phrase suggestions using GPT-4o-mini based on user's weaknesses
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const identifier = getRateLimitIdentifier(req, authUser.id)
    const { success } = await ratelimit.ai.limit(identifier)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id, cefr_level')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Parse request body
    const body = await req.json()
    const { existingPhrases = [], maxCards = 2 } = body

    // Fetch user's top errors
    const { data: errors } = await supabase
      .from('errors')
      .select('*')
      .eq('user_id', profile.id)
      .order('count', { ascending: false })
      .order('last_seen_at', { ascending: false })
      .limit(5)

    if (!errors || errors.length === 0) {
      return NextResponse.json({
        suggestions: [],
        message: 'No errors found. Keep practicing!'
      })
    }

    // Build context about user's weaknesses
    const weaknessContext = errors.map((err) => {
      return `- ${err.type} error (seen ${err.count} times): "${err.example}" → "${err.correction}"`
    }).join('\n')

    console.log('[Phrase Suggestions] Generating for CEFR:', profile.cefr_level)
    console.log('[Phrase Suggestions] Weaknesses:\n', weaknessContext)

    // Call GPT-4o-mini to generate personalized suggestions
    const prompt = `You are an English learning assistant helping a Japanese learner at CEFR level ${profile.cefr_level}.

Based on their recent mistakes, suggest ${maxCards} useful English phrases they should practice:

USER'S RECENT MISTAKES:
${weaknessContext}

EXISTING TARGET PHRASES (avoid duplicates):
${existingPhrases.length > 0 ? existingPhrases.join(', ') : 'None'}

Generate ${maxCards} phrase suggestions as a JSON array. Each suggestion should:
1. Address one of their specific weaknesses
2. Be at or slightly above their CEFR level (${profile.cefr_level})
3. Include a complete, natural example sentence (not a template)
4. Be practical for everyday conversation

Format:
{
  "suggestions": [
    {
      "phrase": "the phrase to practice",
      "category": "brief category like 'Making Requests' or 'Giving Opinions'",
      "exampleSentence": "A complete natural sentence using the phrase in context",
      "cefr": "${profile.cefr_level}",
      "reasoning": "Brief explanation of how this helps with their specific mistake"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, just the JSON object.`

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful English learning assistant. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('[Phrase Suggestions] OpenAI error:', errorText)
      return NextResponse.json(
        { error: 'Failed to generate suggestions' },
        { status: 500 }
      )
    }

    const data = await openaiResponse.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      )
    }

    // Parse the JSON response
    let parsedResponse
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsedResponse = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('[Phrase Suggestions] Failed to parse JSON:', content)
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      )
    }

    console.log('[Phrase Suggestions] Generated', parsedResponse.suggestions?.length || 0, 'suggestions')

    return NextResponse.json({
      suggestions: parsedResponse.suggestions || [],
      weaknessCount: errors.length,
    })
  } catch (error) {
    console.error('[Phrase Suggestions] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
