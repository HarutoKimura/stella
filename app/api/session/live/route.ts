import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import OpenAI from 'openai'
import type { SaveConversationRequest } from '@/types/coach'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/session/live
 *
 * Saves conversation transcript and generates feedback summary
 * Called when user ends a realtime conversation session
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Session Live API] Request received')

    // Authenticate user
    const supabase = await createServerSupabaseClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Get request body
    const body = await req.json() as SaveConversationRequest
    const { weekId, focusAreas, transcript, insightSummary } = body

    // Validate required fields
    if (!weekId || !focusAreas || !transcript) {
      return NextResponse.json(
        { error: 'Missing required fields: weekId, focusAreas, transcript' },
        { status: 400 }
      )
    }

    if (transcript.length === 0) {
      return NextResponse.json(
        { error: 'Transcript cannot be empty' },
        { status: 400 }
      )
    }

    console.log('[Session Live API] Processing conversation with', transcript.length, 'messages')

    // Generate feedback summary using GPT-4o-mini
    const feedbackPrompt = `You are an English learning coach reviewing a student's conversation practice.

Analyze the conversation transcript below and provide motivational feedback.

Student's focus areas: ${focusAreas.join(', ')}
${insightSummary ? `Context from weekly insight: ${insightSummary}` : ''}

Provide feedback in 2-3 sentences that:
1. Celebrates what the student did well
2. Offers one specific, actionable tip for improvement related to their focus areas
3. Encourages continued practice

Keep it warm, personal, and motivating. Maximum 3 sentences.

Transcript:
${transcript.map(m => `${m.role === 'user' ? 'Student' : 'Coach'}: ${m.text}`).join('\n')}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a supportive English learning coach providing personalized feedback.',
        },
        {
          role: 'user',
          content: feedbackPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    })

    const feedback = completion.choices[0].message.content?.trim() ||
      "Great conversation practice! Keep working on your focus areas and you'll see improvement."

    console.log('[Session Live API] Feedback generated:', feedback.substring(0, 50))

    // Save conversation session to database
    const { data: savedSession, error: insertError } = await supabase
      .from('conversation_sessions')
      .insert([
        {
          user_id: userProfile.id,
          week_id: weekId,
          focus_areas: focusAreas,
          transcript: transcript,
          feedback: feedback,
        },
      ])
      .select()
      .single()

    if (insertError) {
      console.error('[Session Live API] Failed to save session:', insertError)
      return NextResponse.json(
        { error: 'Failed to save conversation session', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('[Session Live API] Session saved successfully:', savedSession.id)

    return NextResponse.json({
      sessionId: savedSession.id,
      feedback: feedback,
    })

  } catch (error) {
    console.error('[Session Live API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save conversation session',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
