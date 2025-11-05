import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'

export async function POST(req: NextRequest) {
  try {
    console.log('[Pronunciation API] Request received')
    const apiKey = process.env.AZURE_SPEECH_KEY
    const region = process.env.AZURE_SPEECH_REGION

    if (!apiKey || !region) {
      console.error('[Pronunciation API] Missing credentials')
      return NextResponse.json(
        { error: 'Azure Speech credentials not configured' },
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
    const referenceText = formData.get('referenceText') as string | null
    const sessionId = formData.get('sessionId') as string | null

    console.log('[Pronunciation API] Form data:', {
      hasAudio: !!audio,
      audioType: audio?.constructor.name,
      audioSize: audio instanceof File ? audio.size : 'N/A',
      audioMimeType: audio instanceof File ? audio.type : 'N/A',
      audioName: audio instanceof File ? audio.name : 'N/A',
      referenceText,
      sessionId
    })

    if (!audio || !(audio instanceof File)) {
      console.error('[Pronunciation API] Invalid audio file')
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    if (audio.size === 0) {
      console.error('[Pronunciation API] Empty audio file')
      return NextResponse.json(
        { error: 'Audio file is empty' },
        { status: 400 }
      )
    }

    // Convert audio file to ArrayBuffer for Azure Speech SDK
    const arrayBuffer = await audio.arrayBuffer()

    // Upload audio segment to Supabase Storage for later playback
    let audioUrl: string | null = null
    if (sessionId && authUser) {
      try {
        const timestamp = Date.now()
        const fileName = `user-segments/${authUser.id}/${sessionId}/${timestamp}.wav`

        const { error: uploadError } = await supabase
          .storage
          .from('pronunciation-audio')
          .upload(fileName, audio, {
            contentType: 'audio/wav',
            upsert: false
          })

        if (uploadError) {
          console.error('[Pronunciation API] Failed to upload audio segment:', uploadError)
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('pronunciation-audio')
            .getPublicUrl(fileName)
          audioUrl = publicUrl
          console.log('[Pronunciation API] Audio segment uploaded:', audioUrl)
        }
      } catch (uploadErr) {
        console.error('[Pronunciation API] Audio upload exception:', uploadErr)
      }
    }

    // Create speech configuration
    const speechConfig = sdk.SpeechConfig.fromSubscription(apiKey, region)
    speechConfig.speechRecognitionLanguage = 'en-US'

    // Configure pronunciation assessment
    const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
      referenceText || '', // Empty string for unscripted assessment
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      !referenceText // enableMiscue only for scripted assessment
    )

    // Enable prosody assessment via JSON configuration
    // Note: prosody assessment may not be available in all SDK versions
    try {
      // Try to enable prosody if the method exists
      if (typeof (pronunciationConfig as any).enableProsodyAssessment === 'function') {
        (pronunciationConfig as any).enableProsodyAssessment()
      }
    } catch (e) {
      console.log('[Pronunciation] Prosody assessment not available:', e)
    }

    // Create push stream for audio
    const pushStream = sdk.AudioInputStream.createPushStream()
    pushStream.write(arrayBuffer)
    pushStream.close()

    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream)

    // Create speech recognizer
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)
    pronunciationConfig.applyTo(recognizer)

    // Perform recognition and assessment
    console.log('[Pronunciation API] Starting speech recognition...')
    const result = await new Promise<sdk.SpeechRecognitionResult>(
      (resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            recognizer.close()
            console.log('[Pronunciation API] Recognition result:', {
              reason: result.reason,
              text: result.text,
              duration: result.duration
            })
            resolve(result)
          },
          (error) => {
            recognizer.close()
            console.error('[Pronunciation API] Recognition error:', error)
            reject(error)
          }
        )
      }
    )

    console.log('[Pronunciation API] Result reason:', result.reason)

    if (result.reason === sdk.ResultReason.RecognizedSpeech) {
      // Get pronunciation assessment result
      const pronunciationResult =
        sdk.PronunciationAssessmentResult.fromResult(result)

      // Get detailed JSON result
      const detailsJson = result.properties.getProperty(
        sdk.PropertyId.SpeechServiceResponse_JsonResult
      )
      const details = JSON.parse(detailsJson)

      // Extract scores
      const scores = {
        accuracyScore: pronunciationResult.accuracyScore,
        fluencyScore: pronunciationResult.fluencyScore,
        completenessScore: pronunciationResult.completenessScore,
        pronunciationScore: pronunciationResult.pronunciationScore,
        prosodyScore: details.NBest?.[0]?.PronunciationAssessment?.ProsodyScore,
      }

      // Extract detailed word-level results with audio URL and timing
      const words = details.NBest?.[0]?.Words?.map((word: any) => ({
        word: word.Word,
        accuracyScore: word.PronunciationAssessment?.AccuracyScore,
        errorType: word.PronunciationAssessment?.ErrorType,
        offset: word.Offset, // Start time in 100-nanosecond units
        duration: word.Duration, // Duration in 100-nanosecond units
        audioUrl: audioUrl, // Link to the full segment audio
        phonemes: word.Phonemes?.map((p: any) => ({
          phoneme: p.Phoneme,
          accuracyScore: p.AccuracyScore,
        })),
      })) || []

      // Store pronunciation assessment in session if sessionId provided
      if (sessionId) {
        console.log('[Pronunciation API] Session ID provided:', sessionId)
        const { data: userProfile } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', authUser.id)
          .single()

        console.log('[Pronunciation API] User profile found:', userProfile)

        if (userProfile) {
          // Update fluency_snapshots with all pronunciation scores
          console.log('[Pronunciation API] Saving scores to database:', scores)
          console.log('[Pronunciation API] Updating for session_id:', sessionId, 'user_id:', userProfile.id)

          const { data: updateData, error: updateError } = await supabase
            .from('fluency_snapshots')
            .update({
              pronunciation_score: scores.pronunciationScore,
              accuracy_score: scores.accuracyScore,
              fluency_score: scores.fluencyScore,
              prosody_score: scores.prosodyScore,
              completeness_score: scores.completenessScore,
            })
            .eq('session_id', sessionId)
            .eq('user_id', userProfile.id)
            .select()

          if (updateError) {
            console.error('[Pronunciation API] Failed to update fluency_snapshots:', updateError)
          } else if (!updateData || updateData.length === 0) {
            console.warn('[Pronunciation API] No rows updated - fluency_snapshot may not exist yet')
          } else {
            console.log('[Pronunciation API] Successfully updated fluency_snapshots:', updateData)
          }

          // Store detailed pronunciation data in session summary
          const { data: session } = await supabase
            .from('sessions')
            .select('summary')
            .eq('id', sessionId)
            .single()

          if (session) {
            const summary = session.summary || {}
            await supabase
              .from('sessions')
              .update({
                summary: {
                  ...summary,
                  pronunciation_assessment: {
                    scores,
                    words,
                    timestamp: new Date().toISOString(),
                  },
                },
              })
              .eq('id', sessionId)
          }
        }
      }

      return NextResponse.json({
        success: true,
        recognizedText: result.text,
        scores,
        words,
      })
    } else if (result.reason === sdk.ResultReason.NoMatch) {
      console.log('[Pronunciation API] No speech recognized in this segment - skipping')
      // Return success with null scores so the caller can skip this segment
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'No speech could be recognized in this audio segment',
        recognizedText: '',
        scores: null,
        words: null,
      })
    } else {
      console.error('[Pronunciation API] Unexpected recognition result:', result.reason)
      return NextResponse.json(
        { error: 'Speech recognition failed', reason: result.reason },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[Pronunciation API] Error:', error)
    console.error('[Pronunciation API] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      {
        error: 'Failed to assess pronunciation',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
