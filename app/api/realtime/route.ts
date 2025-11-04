import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import OpenAI from 'openai'
import type { RealtimeMessageRequest, ConversationMessage } from '@/types/coach'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/realtime
 *
 * Handles individual message exchanges during live conversation
 * Uses GPT-4o-mini for natural conversation flow
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Realtime API] Request received')

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
    const body = await req.json() as RealtimeMessageRequest
    const { input, focusAreas, level, messages } = body

    // Validate required fields
    if (!input || !focusAreas || !level) {
      return NextResponse.json(
        { error: 'Missing required fields: input, focusAreas, level' },
        { status: 400 }
      )
    }

    console.log('[Realtime API] Processing message:', input.substring(0, 50))

    // Build system prompt for conversation
    const systemPrompt = `You are a friendly English conversation coach helping a learner practice ${focusAreas.join(' and ')}.

Your role:
- Speak naturally and adapt difficulty for CEFR ${level} level
- Encourage the learner with positive reinforcement
- Ask engaging follow-up questions to keep conversation flowing
- Gently correct errors when you notice them, but don't interrupt the flow
- Keep your messages concise (≤80 words) and conversational
- Use simple, clear language appropriate for ${level} level
- Show empathy and patience

Focus areas for this session: ${focusAreas.join(', ')}

Keep the conversation natural and enjoyable. After about 8 exchanges, naturally suggest wrapping up the conversation.`

    // Build message history for context
    const messageHistory: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]

    // Add previous messages for context (limit to last 10 for token efficiency)
    const recentMessages = messages.slice(-10)
    for (const msg of recentMessages) {
      messageHistory.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text,
      })
    }

    // Add current user input
    messageHistory.push({
      role: 'user',
      content: input,
    })

    // Generate AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messageHistory,
      temperature: 0.8, // Higher temperature for more natural, varied responses
      max_tokens: 200, // Keep responses concise
    })

    const reply = completion.choices[0].message.content ||
      "I'm sorry, I didn't quite catch that. Could you say that again?"

    console.log('[Realtime API] Generated response:', reply.substring(0, 50))

    return NextResponse.json({
      reply,
    })

  } catch (error) {
    console.error('[Realtime API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
