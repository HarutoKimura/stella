import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import OpenAI from 'openai'
import { ratelimit, getRateLimitIdentifier } from '@/lib/ratelimit'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * GET /api/recommendations
 *
 * Fetches the latest recommended actions for the user
 * Returns up to 3 incomplete actions from the current week
 */
export async function GET(req: NextRequest) {
  try {
    console.log('[Recommendations API] GET request received')

    // Authenticate user
    const supabase = await createServerSupabaseClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting - lenient for read operations
    const identifier = getRateLimitIdentifier(req, authUser.id)
    const { success } = await ratelimit.read.limit(identifier)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    console.log('[Recommendations API] Fetching actions for user:', userProfile.id)

    // Fetch latest incomplete actions
    const { data: actions, error: fetchError } = await supabase
      .from('recommended_actions')
      .select('*')
      .eq('user_id', userProfile.id)
      .eq('completed', false)
      .order('week_start', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3)

    if (fetchError) {
      console.error('[Recommendations API] Error fetching actions:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch actions' }, { status: 500 })
    }

    console.log('[Recommendations API] Found', actions?.length || 0, 'actions')

    return NextResponse.json({ actions: actions || [] })

  } catch (error) {
    console.error('[Recommendations API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch recommendations',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/recommendations
 *
 * Generates new recommended actions based on the user's weekly insight
 * Uses OpenAI to create 2-3 actionable next steps
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Recommendations API] POST request received')

    // Authenticate user
    const supabase = await createServerSupabaseClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting - strict for AI generation
    const identifier = getRateLimitIdentifier(req, authUser.id)
    const { success } = await ratelimit.ai.limit(identifier)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, cefr_level, display_name')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Parse request body
    const { insight_text, week_start } = await req.json()

    if (!insight_text || !week_start) {
      return NextResponse.json(
        { error: 'Missing required fields: insight_text and week_start' },
        { status: 400 }
      )
    }

    console.log('[Recommendations API] Generating actions for week:', week_start)

    // Check if actions already exist for this week
    const { data: existingActions } = await supabase
      .from('recommended_actions')
      .select('*')
      .eq('user_id', userProfile.id)
      .eq('week_start', week_start)

    if (existingActions && existingActions.length > 0) {
      console.log('[Recommendations API] Actions already exist for this week')
      return NextResponse.json({
        actions: existingActions,
        message: 'Actions already generated for this week',
      })
    }

    // Generate actions using OpenAI
    const prompt = `You're an English tutor. Read this feedback for a ${userProfile.cefr_level} student:

"${insight_text}"

Create 2-3 SHORT, CREATIVE practice actions (max 80 characters each). Must be DIFFERENT categories and formats.

RULES:
1. Different categories: Grammar, Pronunciation, Vocabulary, OR Fluency
2. VERY concise - fit in one line
3. Specific examples, not generic instructions
4. 5-10 min tasks

GOOD (short & specific):
- "Say 'think, that, through, although' 10 times fast"
- "Describe your desk using only past tense"
- "Record: 'I've been, I've done, I've seen' x5"

BAD (too long):
- "Write 5 sentences using simple present and present continuous to describe daily routines, then read them aloud focusing on correct subject-verb agreement"

MORE EXAMPLES:
{"category": "Pronunciation", "action": "Shadow-speak a 2-min news clip"}
{"category": "Grammar", "action": "Ask yourself 5 'Why...' questions out loud"}
{"category": "Vocabulary", "action": "Name 10 objects around you with adjectives"}
{"category": "Fluency", "action": "Describe yesterday for 2 min non-stop"}

Return JSON:
{
  "actions": [
    {"category": "Grammar", "action": "max 80 chars"},
    {"category": "Pronunciation", "action": "different format"},
    {"category": "Vocabulary", "action": "another format"}
  ]
}

CRITICAL: Keep each action under 80 characters! Be creative and varied!`

    console.log('[Recommendations API] Calling OpenAI with model: gpt-5-nano')

    let completion
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content: 'English coach. Create SHORT (max 80 chars), DIVERSE actions. Different categories. Creative formats. No generic "write 5 sentences" patterns.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        reasoning_effort: 'minimal' as any, // GPT-5 parameter - type assertion until SDK is updated
        max_completion_tokens: 1000, // Higher limit: reasoning tokens + output tokens
        response_format: { type: 'json_object' },
      })
    } catch (openaiError: any) {
      console.error('[Recommendations API] OpenAI API Error:', openaiError)
      console.error('[Recommendations API] Error details:', openaiError.message)
      console.error('[Recommendations API] Error response:', openaiError.response?.data)
      throw new Error(`OpenAI API error: ${openaiError.message}`)
    }

    console.log('[Recommendations API] OpenAI completion object:', JSON.stringify(completion, null, 2))

    const responseContent = completion.choices?.[0]?.message?.content?.trim()
    if (!responseContent) {
      console.error('[Recommendations API] Empty response. Full completion object:', completion)
      throw new Error('Empty response from OpenAI')
    }

    console.log('[Recommendations API] OpenAI raw response:', responseContent)

    // Parse the response - OpenAI should return an object with actions array
    let parsedResponse
    try {
      parsedResponse = JSON.parse(responseContent)
    } catch (parseError) {
      console.error('[Recommendations API] JSON parse error:', parseError)
      throw new Error('Failed to parse OpenAI response')
    }

    let actions = parsedResponse.actions || []

    if (!Array.isArray(actions)) {
      console.error('[Recommendations API] Actions is not an array:', typeof actions)
      throw new Error('Invalid response format from OpenAI')
    }

    // Validate and sanitize actions
    actions = actions
      .filter((a: any) => {
        const valid = a.category && a.action
        if (!valid) {
          console.warn('[Recommendations API] Filtering out invalid action:', a)
        }
        return valid
      })
      .slice(0, 3)
      .map((a: any) => ({
        category: a.category,
        action: a.action.substring(0, 100), // Limit to 100 chars for UI fit
      }))

    if (actions.length === 0) {
      console.error('[Recommendations API] No valid actions generated from OpenAI')
      throw new Error('OpenAI failed to generate valid actions. Please try again.')
    }

    console.log('[Recommendations API] Successfully generated', actions.length, 'specific actions:',
      actions.map((a: any) => `${a.category}: ${a.action.substring(0, 50)}...`))

    // Save to Supabase
    const insertPromises = actions.map((action: any) =>
      supabase.from('recommended_actions').insert({
        user_id: userProfile.id,
        week_start,
        category: action.category,
        action_text: action.action,
      })
    )

    const results = await Promise.all(insertPromises)
    const insertErrors = results.filter(r => r.error)

    if (insertErrors.length > 0) {
      console.error('[Recommendations API] Error inserting actions:', insertErrors)
      return NextResponse.json(
        { error: 'Failed to save some actions' },
        { status: 500 }
      )
    }

    // Fetch the newly created actions
    const { data: newActions } = await supabase
      .from('recommended_actions')
      .select('*')
      .eq('user_id', userProfile.id)
      .eq('week_start', week_start)
      .order('created_at', { ascending: false })

    console.log('[Recommendations API] Successfully saved', newActions?.length || 0, 'actions')

    return NextResponse.json({
      actions: newActions || [],
      message: 'Actions generated successfully',
    })

  } catch (error) {
    console.error('[Recommendations API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate recommendations',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
