import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

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

    // Get user profile for system prompt
    const { data: profile } = await supabase
      .from('users')
      .select('id, display_name, cefr_level')
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

    // Check if user has a goal already
    const { data: userGoal } = await supabase
      .from('users')
      .select('goal_id')
      .eq('id', profile.id)
      .single()

    const hasGoal = userGoal && userGoal.goal_id

    // Build system prompt
    const systemPrompt = hasGoal
      ? `You are a friendly English tutor helping Japanese learners practice everyday conversation (CEFR: ${profile.cefr_level}).

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

CORRECTIONS:
- Batch corrections every 3-4 turns to avoid interrupting flow
- Keep corrections brief and encouraging
- Focus on conversation, not drilling

STYLE:
- Be concise (1-2 sentences per turn)
- Be patient and encouraging
- Let the conversation flow naturally
- The student can communicate via voice OR text - respond naturally to both

Remember: Natural conversation comes first. Target phrases are secondary and should only be introduced when they genuinely fit the context.`
      : `You are a friendly English tutor helping Japanese learners (CEFR: ${profile.cefr_level}).

FIRST-TIME USER - NATURAL TEACHING:
This student doesn't have a learning goal yet. Discover what they want through natural conversation, then start teaching immediately.

CONVERSATION FLOW:
1. Greet warmly: "Hi! What brings you here today?"
2. Listen and ask 1-2 follow-up questions
3. Once you understand (usually 2-4 exchanges), call create_user_goal() silently
4. IMMEDIATELY start teaching - don't announce that you created anything
5. Just transition naturally into the first lesson

EXAMPLES:
User: "I need English for job interviews"
You: "Great! When's your interview?"
User: "Next month"
You: [Call create_user_goal silently]
You: "Let's practice introducing yourself. Repeat after me: 'I have 5 years of experience in...'"

User: "I want to travel to Europe"
You: [Call create_user_goal silently]
You: "Perfect! Let's start with a useful airport phrase. Try saying: 'Where is the baggage claim?'"

CRITICAL RULES:
- DON'T say "I've created a plan"
- DON'T say "Your goal has been set"
- DON'T announce goal creation at all
- JUST seamlessly transition into teaching
- Make it feel like ONE continuous conversation

Remember: The user should never know a "goal" was created. They're just talking to their tutor.`

    // Define tools for the AI tutor
    const tools = hasGoal
      ? [
          // Allow changing goal even if they have one
          {
            type: 'function',
            name: 'change_user_goal',
            description:
              'Silently update the learning goal when user wants to change focus. Call when they say "I want to change my goal", "Actually I need English for...", etc. Then continue teaching naturally without announcing the change.',
            parameters: {
              type: 'object',
              properties: {
                goalDescription: {
                  type: 'string',
                  description:
                    'The NEW goal they want to achieve. Be specific based on conversation.',
                },
                timeline: {
                  type: 'string',
                  description: 'New timeline if mentioned. Optional.',
                },
                currentSkills: {
                  type: 'string',
                  description: 'Updated skill description if mentioned. Optional.',
                },
              },
              required: ['goalDescription'],
            },
          },
        ]
      : [
          {
            type: 'function',
            name: 'create_user_goal',
            description:
              'Silently create a learning goal based on conversation. Call this after understanding what they want (2-4 exchanges), then immediately start teaching. DO NOT announce that you created a goal.',
            parameters: {
              type: 'object',
              properties: {
                goalDescription: {
                  type: 'string',
                  description:
                    'What the user wants to achieve with English, based on the conversation. Be specific (e.g., "preparing for job interviews at tech companies" not just "job interviews")',
                },
                timeline: {
                  type: 'string',
                  description:
                    'When they need to achieve this goal (e.g., "1 month", "3 months", "before summer trip"). Optional.',
                },
                currentSkills: {
                  type: 'string',
                  description:
                    'Their current English skill level or what they can/cannot do (e.g., "can read but struggle speaking", "complete beginner"). Optional.',
                },
              },
              required: ['goalDescription'],
            },
          },
        ]

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
        tools: tools.length > 0 ? tools : undefined,
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
