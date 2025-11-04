import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import OpenAI from 'openai'
import type { StartSessionRequest, CoachDialogueResponse } from '@/types/coach'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/session/start
 *
 * Creates a new AI Coach v2 practice session
 * Generates interactive dialogue based on weekly insights and user's focus areas
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Session Start API] Request received')

    // Authenticate user
    const supabase = await createServerSupabaseClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await req.json() as Partial<StartSessionRequest>
    const { focusAreas, level, theme, insightText } = body

    // Validate required fields
    if (!focusAreas || focusAreas.length === 0) {
      return NextResponse.json(
        { error: 'Focus areas are required' },
        { status: 400 }
      )
    }

    if (!level) {
      return NextResponse.json(
        { error: 'CEFR level is required' },
        { status: 400 }
      )
    }

    // Get user profile to get user_id
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, cefr_level, display_name')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get current week_id (week number of the year)
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const weekId = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)

    console.log('[Session Start API] Generating dialogue with OpenAI...')
    console.log('[Session Start API] Focus areas:', focusAreas)
    console.log('[Session Start API] Level:', level)
    console.log('[Session Start API] Theme:', theme || 'General conversation')

    // Create system prompt for dialogue generation
    const systemPrompt = `You are an empathetic English speaking coach helping learners improve their English skills.
Generate a 5-turn interactive practice lesson in JSON format for a ${level} level student.

Focus areas to address: ${focusAreas.join(', ')}
${theme ? `Theme: ${theme}` : 'Theme: General conversation'}
${insightText ? `Context from student's weekly insight: ${insightText}` : ''}

Each turn should have:
- turn: number (1-5)
- coach_text: what the coach says (max 120 chars, friendly and encouraging)
- expected_student_text: example of what the student might say (max 120 chars)
- correction_tip: specific tip to help with the focus area (max 120 chars)

Keep the conversation natural, practical, and appropriate for ${level} level.
Make it engaging and directly address the focus areas: ${focusAreas.join(', ')}.

Return ONLY a JSON object with this exact structure:
{
  "dialogue": [
    {
      "turn": 1,
      "coach_text": "...",
      "expected_student_text": "...",
      "correction_tip": "..."
    }
  ]
}`

    // Generate dialogue with OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: 'Generate the practice dialogue now in JSON format only.',
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    })

    const responseContent = completion.choices[0].message.content
    if (!responseContent) {
      throw new Error('No response from OpenAI')
    }

    const dialogueData = JSON.parse(responseContent) as CoachDialogueResponse

    if (!dialogueData.dialogue || !Array.isArray(dialogueData.dialogue)) {
      throw new Error('Invalid dialogue format from OpenAI')
    }

    console.log('[Session Start API] Dialogue generated:', dialogueData.dialogue.length, 'turns')

    // Store session in database
    const { data: savedSession, error: insertError } = await supabase
      .from('coach_sessions')
      .insert([
        {
          user_id: userProfile.id,
          week_id: weekId,
          focus_areas: focusAreas,
          dialogue: dialogueData.dialogue,
        },
      ])
      .select()
      .single()

    if (insertError) {
      console.error('[Session Start API] Failed to save session:', insertError)
      return NextResponse.json(
        { error: 'Failed to save session', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('[Session Start API] Session saved successfully:', savedSession.id)

    return NextResponse.json({
      sessionId: savedSession.id,
      dialogue: dialogueData.dialogue,
    })

  } catch (error) {
    console.error('[Session Start API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create practice session',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
