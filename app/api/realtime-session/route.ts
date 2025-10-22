import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { RealtimeSessionConfig, RealtimeFunction } from '@/lib/aiContracts'

/**
 * Phase 2: Initialize Realtime Session Configuration
 *
 * This endpoint prepares the session config for OpenAI Realtime API,
 * including system instructions, active targets, and function definitions.
 *
 * The client will use this config to set up the RealtimeAgent:
 *
 * ```typescript
 * const { instructions, functions, activeTargets } = await fetch('/api/realtime-session').json();
 *
 * const agent = new RealtimeAgent({
 *   name: 'Tutor',
 *   instructions,
 *   functions,
 * });
 * ```
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

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('id, cefr_level')
      .eq('auth_user_id', authUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get active targets for this user (planned status, most recent first)
    const { data: targets } = await supabase
      .from('targets')
      .select('phrase')
      .eq('user_id', userProfile.id)
      .eq('status', 'planned')
      .order('first_seen_at', { ascending: false })
      .limit(3)

    const activeTargets = targets?.map((t) => t.phrase) || []

   // Define system instructions
const instructions = `
You are a warm, natural-sounding English tutor from California who helps Japanese learners improve their speaking fluency and confidence.
You speak in a relaxed, friendly tone — like chatting with a close friend.

STUDENT LEVEL: ${userProfile.cefr_level}
ACTIVE TARGET PHRASES: ${activeTargets.join(', ')}

SPEAKING STYLE:
- Speak clearly and warmly, with gentle enthusiasm.
- Keep the rhythm natural — include short pauses (1–2 seconds) before responding.
- React like a human (e.g., “That’s interesting!”, “Oh really?”, “I totally get that.”).
- Use occasional natural filler words (“you know,” “let’s see,” “hmm”) to sound spontaneous.

TEACHING RULES:
- Student should speak ≥65% of the time.
- If the student hasn’t used a target phrase after 2 turns, say: “Try using ‘[phrase]’ next time.”
- Correct grammar or pronunciation every 2–3 turns — not immediately.
- Always encourage and build confidence (“Nice try!”, “That’s improving!”).
- Wait patiently 3–5 seconds if the student pauses before speaking again.

TOPICS:
- Keep it light and relatable: daily life, travel, hobbies, work, or food.
- Avoid robotic Q&A; respond naturally and expand on what the student says.

OUTPUT:
- Respond with both speech and text.
- Keep replies short (1–2 sentences).
- Maintain natural conversational flow.

FUNCTION CALLS:
- When the student uses a target phrase correctly, call function mark_target_used.
- When the student makes an error, accumulate and call function add_correction after 2–3 turns.
- If the student says "stop" or "end", call function end_session.
`


    // Define functions (tool-calls)
    const functions: RealtimeFunction[] = [
      {
        name: 'mark_target_used',
        description: 'Mark a target phrase as successfully used by the student',
        parameters: {
          type: 'object',
          properties: {
            phrase: { type: 'string', description: 'The target phrase that was used' },
          },
          required: ['phrase'],
        },
      },
      {
        name: 'add_correction',
        description: 'Add a correction for a student error',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['grammar', 'vocab', 'pron'] },
            example: { type: 'string', description: 'What the student said' },
            correction: { type: 'string', description: 'The corrected version' },
          },
          required: ['type', 'example', 'correction'],
        },
      },
      {
        name: 'end_session',
        description: 'End the tutoring session',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'navigate',
        description: 'Navigate to a different page',
        parameters: {
          type: 'object',
          properties: {
            destination: {
              type: 'string',
              enum: ['/home', '/profile', '/free_conversation'],
              description: 'The page to navigate to',
            },
          },
          required: ['destination'],
        },
      },
    ]

    const config: Omit<RealtimeSessionConfig, 'token'> = {
      model: 'gpt-realtime-mini-2025-10-06',
      voice: 'alloy',
      instructions,
      functions,
      activeTargets,
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Realtime session config error:', error)
    return NextResponse.json(
      { error: 'Failed to prepare session config' },
      { status: 500 }
    )
  }
}
