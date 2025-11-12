import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import { ratelimit, getRateLimitIdentifier } from '@/lib/ratelimit'

const TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions'
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB (OpenAI limit)
const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/ogg',
  'audio/flac',
]

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

    // Rate limiting - moderate for file uploads
    const identifier = getRateLimitIdentifier(req, authUser.id)
    const { success } = await ratelimit.upload.limit(identifier)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many upload requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const formData = await req.formData()
    const audio = formData.get('audio')

    // Validate file exists and is a File object
    if (!audio || !(audio instanceof File)) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Validate file size
    if (audio.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      )
    }

    // Validate file type (allow empty type and handle codec parameters)
    if (audio.type) {
      // Extract base MIME type (ignore codec parameters like ";codecs=opus")
      const baseMimeType = audio.type.split(';')[0].trim()

      if (!ALLOWED_AUDIO_TYPES.includes(baseMimeType)) {
        console.warn('[Transcribe] Rejected audio type:', audio.type)
        return NextResponse.json(
          {
            error: 'Invalid audio format. Supported formats: webm, wav, mp3, mp4, m4a, ogg, flac',
            received: audio.type
          },
          { status: 415 }
        )
      }
    }

    // Log audio file details for debugging
    console.log('[Transcribe] Processing audio:', {
      type: audio.type || 'unknown',
      size: audio.size,
      name: audio.name
    })

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
