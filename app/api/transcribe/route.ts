import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

const TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const audio = formData.get('audio')

    if (!audio || !(audio instanceof File)) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    const arrayBuffer = await audio.arrayBuffer()
    const audioType = audio.type || 'audio/webm'
    const blob = new Blob([arrayBuffer], { type: audioType })
    const filename = audio.name || `speech-${Date.now()}.webm`

    const transcribeForm = new FormData()
    transcribeForm.append('model', 'gpt-4o-mini-transcribe')
    transcribeForm.append('response_format', 'json')
    transcribeForm.append('temperature', '0')
    transcribeForm.append('language', 'en')
    transcribeForm.append('file', blob, filename)

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    }

    if (process.env.OPENAI_ORGANIZATION) {
      headers['OpenAI-Organization'] = process.env.OPENAI_ORGANIZATION
    }

    const response = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      headers,
      body: transcribeForm,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Transcription API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to transcribe audio' },
        { status: 502 }
      )
    }

    const data = await response.json()
    const text: string = data?.text ?? ''

    return NextResponse.json({
      text,
      language: data?.language ?? null,
      duration: data?.duration ?? null,
    })
  } catch (error) {
    console.error('Transcription route error:', error)
    return NextResponse.json(
      { error: 'Unexpected transcription error' },
      { status: 500 }
    )
  }
}
