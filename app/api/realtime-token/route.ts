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

  // Correction timing instructions
  const correctionInstructions = {
    immediate: `IMMEDIATE CORRECTION MODE:
- Interrupt and correct EVERY error as soon as you notice it
- Wait for the student to retry the sentence correctly before continuing
- Say: "Let me stop you there. You said '...' but it should be '...'. Can you try again?"
- This prevents fossilization of errors - better to fix now than later!`,

    balanced: `BALANCED CORRECTION MODE:
- Batch corrections every 2-3 turns to avoid disrupting flow
- Keep corrections brief and encouraging
- Focus on 1-2 most important errors per batch
- Balance between accuracy and conversation fluency`,

    gentle: `GENTLE CORRECTION MODE:
- Only correct major errors that significantly impact communication
- Wait until natural topic transitions to give feedback
- Prioritize building confidence over perfect accuracy
- Acknowledge what the student did well before correcting`,
  }

  // Feedback style instructions
  const feedbackInstructions = {
    explicit: `EXPLICIT FEEDBACK (Beginner Level):
When correcting, be very clear and direct:
❌ Wrong: "I go work"
✅ Correct: "I go TO work"
💡 Rule: Use "to" before the base verb after "go"

Always explain WHY the correction is needed.`,

    recast: `RECAST FEEDBACK (Intermediate Level):
When correcting, naturally rephrase with the correct form:
Student: "I go work every day"
You: "Oh, you go TO work every day? That's a long commute!"

Embed corrections naturally without explicit grammar explanations unless asked.`,

    elicitation: `ELICITATION FEEDBACK (Advanced Level):
When correcting, prompt self-correction:
Student: "I go work every day"
You: "You go... what? Think about the verb pattern."

Force the student to notice and fix their own errors. Only provide the answer if they're stuck.`,
  }

  // Build accent test context section if available
  const accentTestContext = feedbackContext && feedbackContext.length > 0
    ? `\n\n📊 ACCENT TEST CONTEXT (From Recent Assessment):
The student just took an accent test. Here are specific issues to work on:

${feedbackContext.map((fb, idx) => `${idx + 1}. [${fb.severity.toUpperCase()} PRIORITY - ${fb.category}]
   ❌ They said: "${fb.original_sentence}"
   ✅ Should be: "${fb.corrected_sentence}"
   💡 Tip: ${fb.tip}
`).join('\n')}

IMPORTANT: When you notice the student making these mistakes again:
- Gently point it out: "I notice you said '${feedbackContext[0].original_sentence}'. Remember from your test? Try '${feedbackContext[0].corrected_sentence}' instead."
- If they ask about their weaknesses, refer to these specific patterns
- Prioritize HIGH severity issues over LOW severity ones
- Track whether they're improving on these specific corrections`
    : ''

  return `You are a friendly English tutor helping Japanese learners practice everyday conversation (CEFR: ${cefrLevel}).

CONVERSATION GOALS:
- Have natural, engaging conversations about everyday topics
- Help the student practice these phrases naturally when opportunities arise: ${activeTargets.join(', ')}
- Keep student speaking ≥65% of the time

YOUR TEACHING APPROACH:
1. ALWAYS respond naturally to what the student actually says first
2. Build genuine conversation - ask follow-up questions, show interest
3. Only introduce target phrases when they fit naturally into the conversation context
4. If a target phrase fits the conversation (after 4-5 turns), you can gently suggest: "By the way, you could also say '[phrase]' in this situation"
5. Never force phrases that don't match the conversation topic

${correctionInstructions[correctionMode]}

${feedbackInstructions[feedbackStyle]}
${accentTestContext}

STYLE:
- Be concise (1-2 sentences per turn)
- Be patient and encouraging
- Let the conversation flow naturally
- The student can communicate via voice OR text - respond naturally to both

Remember: Natural conversation comes first. Target phrases are secondary and should only be introduced when they genuinely fit the context.`
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
    console.log('[Realtime Token] Prompt includes accent test context:', systemPrompt.includes('ACCENT TEST CONTEXT'))

    // Request ephemeral token from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-realtime-mini-2025-10-06',
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
      model: data.model || 'gpt-realtime-mini-2025-10-06',
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
