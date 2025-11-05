/**
 * Azure Speech Service helper functions for pronunciation assessment and TTS
 */

import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PronunciationAssessmentResult = {
  recognizedText: string
  scores: {
    accuracyScore: number
    fluencyScore: number
    completenessScore: number
    pronunciationScore: number
    prosodyScore?: number
  }
  words: Array<{
    word: string
    accuracyScore: number
    errorType?: string
    offset?: number
    duration?: number
    phonemes?: Array<{
      phoneme: string
      accuracyScore: number
    }>
  }>
  rawJson: any
}

/**
 * Assess pronunciation from audio buffer using Azure Speech SDK
 */
export async function assessPronunciationFromBuffer(
  audioBuffer: ArrayBuffer,
  referenceText?: string
): Promise<PronunciationAssessmentResult | null> {
  const apiKey = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION

  if (!apiKey || !region) {
    throw new Error('Azure Speech credentials not configured')
  }

  try {
    // Create speech configuration
    const speechConfig = sdk.SpeechConfig.fromSubscription(apiKey, region)
    speechConfig.speechRecognitionLanguage = 'en-US'

    // Configure pronunciation assessment
    const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
      referenceText || '',
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      !referenceText // enableMiscue only for scripted assessment
    )

    // Try to enable prosody assessment if available
    try {
      if (typeof (pronunciationConfig as any).enableProsodyAssessment === 'function') {
        ;(pronunciationConfig as any).enableProsodyAssessment()
      }
    } catch (e) {
      console.log('[Azure] Prosody assessment not available')
    }

    // Create push stream for audio
    const pushStream = sdk.AudioInputStream.createPushStream()
    pushStream.write(audioBuffer)
    pushStream.close()

    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream)
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)
    pronunciationConfig.applyTo(recognizer)

    // Perform recognition
    const result = await new Promise<sdk.SpeechRecognitionResult>((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (result) => {
          recognizer.close()
          resolve(result)
        },
        (error) => {
          recognizer.close()
          reject(error)
        }
      )
    })

    if (result.reason === sdk.ResultReason.RecognizedSpeech) {
      const pronunciationResult = sdk.PronunciationAssessmentResult.fromResult(result)
      const detailsJson = result.properties.getProperty(
        sdk.PropertyId.SpeechServiceResponse_JsonResult
      )
      const details = JSON.parse(detailsJson)

      return {
        recognizedText: result.text,
        scores: {
          accuracyScore: pronunciationResult.accuracyScore,
          fluencyScore: pronunciationResult.fluencyScore,
          completenessScore: pronunciationResult.completenessScore,
          pronunciationScore: pronunciationResult.pronunciationScore,
          prosodyScore: details.NBest?.[0]?.PronunciationAssessment?.ProsodyScore,
        },
        words:
          details.NBest?.[0]?.Words?.map((word: any) => ({
            word: word.Word,
            accuracyScore: word.PronunciationAssessment?.AccuracyScore || 0,
            errorType: word.PronunciationAssessment?.ErrorType,
            offset: word.Offset,
            duration: word.Duration,
            phonemes: word.Phonemes?.map((p: any) => ({
              phoneme: p.Phoneme,
              accuracyScore: p.AccuracyScore,
            })),
          })) || [],
        rawJson: details,
      }
    } else if (result.reason === sdk.ResultReason.NoMatch) {
      console.log('[Azure] No speech recognized in segment')
      return null
    } else {
      throw new Error(`Speech recognition failed: ${result.reason}`)
    }
  } catch (error) {
    console.error('[Azure] Pronunciation assessment error:', error)
    throw error
  }
}

/**
 * Generate native pronunciation audio using Azure TTS
 * Returns a URL to the generated audio file stored in Supabase Storage
 */
export async function generateNativeTTS(
  word: string,
  userId: string,
  supabase: SupabaseClient
): Promise<string | null> {
  const apiKey = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION

  if (!apiKey || !region) {
    throw new Error('Azure Speech credentials not configured')
  }

  try {
    const speechConfig = sdk.SpeechConfig.fromSubscription(apiKey, region)

    // Use a native English voice (US female voice with clear pronunciation)
    speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural'

    // Set output format to WAV for compatibility
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, undefined)

    // Generate SSML for clearer pronunciation with slower rate
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="en-US-JennyNeural">
          <prosody rate="-20%">
            ${word}
          </prosody>
        </voice>
      </speak>
    `

    const result = await new Promise<sdk.SpeechSynthesisResult>((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          synthesizer.close()
          resolve(result)
        },
        (error) => {
          synthesizer.close()
          reject(error)
        }
      )
    })

    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
      // Upload to Supabase Storage
      const fileName = `native-tts/${userId}/${Date.now()}-${word.replace(/\s+/g, '_')}.mp3`

      const { data, error } = await supabase.storage
        .from('pronunciation-audio')
        .upload(fileName, result.audioData, {
          contentType: 'audio/mpeg',
          upsert: false,
        })

      if (error) {
        console.error('[Azure] Failed to upload TTS audio:', error)
        return null
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('pronunciation-audio')
        .getPublicUrl(fileName)

      return urlData.publicUrl
    } else {
      console.error('[Azure] TTS synthesis failed:', result.reason)
      return null
    }
  } catch (error) {
    console.error('[Azure] TTS generation error:', error)
    return null
  }
}

/**
 * Fetch audio from URL and assess pronunciation
 * This is a convenience wrapper for the common pattern of fetching audio then assessing it
 */
export async function assessPronunciationFromUrl(
  audioUrl: string,
  referenceText?: string
): Promise<PronunciationAssessmentResult | null> {
  try {
    const response = await fetch(audioUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return await assessPronunciationFromBuffer(arrayBuffer, referenceText)
  } catch (error) {
    console.error('[Azure] Failed to assess pronunciation from URL:', error)
    throw error
  }
}
