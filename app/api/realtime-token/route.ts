import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { CorrectionMode } from '@/lib/schema'

/**
 * Get feedback style based on CEFR level
 */
function getFeedbackStyle(cefrLevel: string): 'explicit' | 'recast' | 'elicitation' {
  if (cefrLevel === 'A1' || cefrLevel === 'A2') {
    return 'explicit' // Beginners need clear explanations
  } else if (cefrLevel === 'B1' || cefrLevel === 'B2') {
    return 'recast' // Intermediate learners benefit from natural rephrasing
  } else {
    return 'elicitation' // Advanced learners should self-correct
  }
}

/**
 * Build system prompt based on user preferences and CEFR level
 */
function buildSystemPrompt(params: {
  cefrLevel: string
  correctionMode: CorrectionMode
  feedbackStyle: 'explicit' | 'recast' | 'elicitation'
  activeTargets: string[]
  feedbackContext?: Array<{
    category: string
    original_sentence: string
    corrected_sentence: string
    tip: string
    severity: string
  }>
}): string {
  const { cefrLevel, correctionMode, feedbackStyle, activeTargets, feedbackContext } = params

  const timing = {
    immediate: 'Correct every error immediately and ask student to retry.',
    balanced: 'Batch corrections every 2-3 turns, focus on 1-2 key errors.',
    gentle: 'Only correct major errors that block communication.',
  }[correctionMode]

  const style = {
    explicit: 'Be direct: show error, correction, and explain why.',
    recast: 'Rephrase naturally with the correct form embedded.',
    elicitation: 'Prompt self-correction with hints.',
  }[feedbackStyle]

  const weakPoints = feedbackContext && feedbackContext.length > 0
    ? `\n\n🧩 RECENT WEAK POINTS (Internal Memory):
${feedbackContext
  .map(
    (fb) =>
      `- ${fb.category}: "${fb.original_sentence}" → "${fb.corrected_sentence}"${
        fb.tip ? ` (${fb.tip})` : ''
      }`
  )
  .join('\n')}

Usage Guidelines:
- Do NOT start the conversation about these issues.
- Use them only when naturally relevant to what the student says.
- If the student explicitly asks about "accent test", "weaknesses", or "improvement areas",
  summarize the top 1–3 issues conversationally, e.g.:
  "From your last test, you tended to say 'go to abroad' instead of 'go abroad.'
  Let's practice that a bit today."
- Otherwise, keep them internal and implicit.`
    : ''

  const targets = activeTargets.length > 0
    ? `\n\nPractice phrases: ${activeTargets.join(', ')}. Introduce only when they fit naturally.`
    : ''

  return `META RULE: If any instruction below prevents natural conversation, ignore it and respond naturally to the student.

You're a friendly English tutor for Japanese learners (${cefrLevel}). Listen and respond naturally first. Keep conversation flowing with open-ended questions. Let student speak ≥65%. End every turn with a short question.

Correction approach: ${timing} ${style}${weakPoints}${targets}

Be concise (1-2 sentences per turn), patient, and encouraging. Follow student's topics. Respond to content first, correct form second.`
}

/**
 * Generate ephemeral token for OpenAI Realtime API
 *
 * This endpoint creates a short-lived client token for WebRTC connection
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createServerSupabaseClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body to get feedbackContext
    const body = await req.json()
    const feedbackContext = body.feedbackContext

    console.log('[Realtime Token] Request body keys:', Object.keys(body))
    console.log('[Realtime Token] Feedback context:', feedbackContext ? `${feedbackContext.length} tips` : 'none')
    if (feedbackContext && feedbackContext.length > 0) {
      console.log('[Realtime Token] Feedback details:', JSON.stringify(feedbackContext, null, 2))
    }

    // Get user profile for system prompt
    const { data: profile } = await supabase
      .from('users')
      .select('id, display_name, cefr_level, correction_mode')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get active targets for this session (most recent first)
    const { data: targets } = await supabase
      .from('targets')
      .select('phrase')
      .eq('user_id', profile.id)
      .eq('status', 'planned')
      .order('first_seen_at', { ascending: false })
      .limit(3)

    const activeTargets = targets?.map((t) => t.phrase) || []

    // Get correction mode and feedback style
    // Use user's preference, default to 'balanced' if not set
    const correctionMode: CorrectionMode = (profile.correction_mode as CorrectionMode) || 'balanced'
    const feedbackStyle = getFeedbackStyle(profile.cefr_level)

    // Build system prompt dynamically with feedback context
    const systemPrompt = buildSystemPrompt({
      cefrLevel: profile.cefr_level,
      correctionMode,
      feedbackStyle,
      activeTargets,
      feedbackContext: feedbackContext || undefined,
    })

    console.log('[Realtime Token] System prompt length:', systemPrompt.length)
    console.log('[Realtime Token] Prompt includes learner profile:', systemPrompt.includes('RECENT WEAK POINTS'))
    console.log('[Realtime Token] Includes recall instructions:', systemPrompt.includes('accent test') || systemPrompt.includes('weakness'))

    // Request ephemeral token from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-realtime-2025-08-28',
        voice: 'alloy',
        instructions: systemPrompt,
        modalities: ['text', 'audio'],
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('OpenAI API error:', error)
      throw new Error('Failed to create realtime session')
    }

    const data = await response.json()

    return NextResponse.json({
      session: data,
      token: data.client_secret.value,
      expires_at: data.client_secret.expires_at,
      model: data.model || 'gpt-realtime-2025-08-28',
      prompt: systemPrompt,
      activeTargets,
    })
  } catch (error) {
    console.error('Realtime token error:', error)
    return NextResponse.json(
      { error: 'Failed to generate realtime token' },
      { status: 500 }
    )
  }
}
