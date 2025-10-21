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

    // Build system prompt
    const systemPrompt = `You are a friendly English tutor helping Japanese learners practice everyday conversation (CEFR: ${profile.cefr_level}).

ACTIVE TARGETS (encourage natural use in conversation):
${activeTargets.join(', ')}

RULES:
- Keep student speaking ≥65% of the time
- If student doesn't use target phrase after 2 turns, gently prompt: "Try using '[phrase]' in your next sentence"
- Wait 3-5 seconds before interrupting
- Batch corrections every 2-3 turns
- Be concise (1-2 sentences per turn)
- Focus on everyday topics and common situations
- Respond in both text and audio
- Natural conversational flow

IMPORTANT: The student can communicate via voice OR text. Respond naturally to both.`

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
