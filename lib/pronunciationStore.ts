/**
 * Store for collecting user audio during session for post-session pronunciation assessment
 */

import { create } from 'zustand'
import { convertToWav } from './audioConverter'

type AudioSegment = {
  blob: Blob
  text: string // Transcribed text
  timestamp: number
}

type PronunciationStoreState = {
  audioSegments: AudioSegment[]
  isProcessing: boolean
  addAudioSegment: (blob: Blob, text: string) => void
  clearAudioSegments: () => void
  setProcessing: (processing: boolean) => void
  getAudioSegments: () => AudioSegment[]
}

export const usePronunciationStore = create<PronunciationStoreState>((set, get) => ({
  audioSegments: [],
  isProcessing: false,

  addAudioSegment: (blob, text) => {
    console.log('[Pronunciation Store] Adding audio segment:', { text, size: blob.size })
    set((state) => ({
      audioSegments: [
        ...state.audioSegments,
        {
          blob,
          text,
          timestamp: Date.now(),
        },
      ],
    }))
    console.log('[Pronunciation Store] Total segments:', get().audioSegments.length + 1)
  },

  clearAudioSegments: () => {
    set({ audioSegments: [] })
  },

  setProcessing: (processing) => {
    set({ isProcessing: processing })
  },

  getAudioSegments: () => {
    return get().audioSegments
  },
}))

/**
 * Process collected audio segments for pronunciation assessment
 */
export async function assessPronunciation(sessionId: string) {
  const store = usePronunciationStore.getState()
  const segments = store.getAudioSegments()

  console.log('[Pronunciation Assessment] Starting assessment for session:', sessionId)
  console.log('[Pronunciation Assessment] Audio segments collected:', segments.length)

  if (segments.length === 0) {
    console.log('[Pronunciation Assessment] No audio segments to assess - skipping')
    return null
  }

  store.setProcessing(true)

  try {
    // Assess all audio segments from the conversation
    // This will give a comprehensive pronunciation assessment
    const segmentsToAssess = segments // Assess ALL segments (not just first 5)

    const assessmentResults = []
    const allWordScores: Array<{
      word: string
      accuracy: number
      segmentIndex: number
      phonemes?: Array<{ phoneme: string; accuracyScore: number }>
    }> = []

    for (let i = 0; i < segmentsToAssess.length; i++) {
      const segment = segmentsToAssess[i]
      try {
        // Convert WebM to WAV for Azure Speech SDK compatibility
        console.log(`[Pronunciation Assessment] Processing segment ${i + 1}/${segmentsToAssess.length}...`)
        const wavBlob = await convertToWav(segment.blob)

        const formData = new FormData()
        formData.append('audio', wavBlob, 'speech.wav')
        formData.append('referenceText', segment.text) // Use transcribed text as reference for full scoring
        formData.append('sessionId', sessionId)

        const response = await fetch('/api/pronunciation-assessment', {
          method: 'POST',
          body: formData,
        })

        console.log('[Pronunciation Assessment] API response status:', response.status)

        if (response.ok) {
          const result = await response.json()

          // Handle skipped segments (no speech detected)
          if (result.skipped) {
            console.log('[Pronunciation Assessment] Segment skipped:', result.reason)
            continue // Skip this segment and move to next
          }

          // Handle successful assessment
          if (result.success && result.scores) {
            console.log('[Pronunciation Assessment] Success:', result)
            assessmentResults.push({
              text: segment.text,
              scores: result.scores,
              words: result.words,
            })

            // Collect word-level scores for clarity focus
            if (result.words && Array.isArray(result.words)) {
              result.words.forEach((wordData: any) => {
                if (wordData.word && wordData.accuracyScore !== undefined) {
                  allWordScores.push({
                    word: wordData.word.toLowerCase(),
                    accuracy: wordData.accuracyScore,
                    segmentIndex: i,
                    phonemes: wordData.phonemes,
                  })
                }
              })
            }
          }
        } else {
          // Log the error details
          let errorBody
          try {
            errorBody = await response.json()
          } catch (e) {
            errorBody = await response.text()
          }
          console.error('[Pronunciation Assessment] API error:', {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            body: errorBody,
          })
        }
      } catch (conversionError) {
        console.error('[Pronunciation Assessment] Audio conversion error:', conversionError)
        // Continue with next segment
      }
    }

    // Calculate average scores
    if (assessmentResults.length > 0) {
      const avgScores = assessmentResults.reduce(
        (acc, result) => ({
          accuracyScore: acc.accuracyScore + (result.scores.accuracyScore || 0),
          fluencyScore: acc.fluencyScore + (result.scores.fluencyScore || 0),
          pronunciationScore: acc.pronunciationScore + (result.scores.pronunciationScore || 0),
          prosodyScore: acc.prosodyScore + (result.scores.prosodyScore || 0),
        }),
        { accuracyScore: 0, fluencyScore: 0, pronunciationScore: 0, prosodyScore: 0 }
      )

      const count = assessmentResults.length

      // Extract bottom 3-5 words for clarity focus
      // Filter for meaningful words (> 2 chars), remove duplicates (keep lowest accuracy)
      const wordMap = new Map<string, typeof allWordScores[0]>()
      allWordScores.forEach((wordScore) => {
        if (wordScore.word.length > 2) {
          const existing = wordMap.get(wordScore.word)
          if (!existing || wordScore.accuracy < existing.accuracy) {
            wordMap.set(wordScore.word, wordScore)
          }
        }
      })

      const clarityFocusWords = Array.from(wordMap.values())
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 5)

      console.log('[Pronunciation Assessment] Clarity focus words:', clarityFocusWords)

      return {
        averageScores: {
          accuracyScore: Math.round(avgScores.accuracyScore / count),
          fluencyScore: Math.round(avgScores.fluencyScore / count),
          pronunciationScore: Math.round(avgScores.pronunciationScore / count),
          prosodyScore: Math.round(avgScores.prosodyScore / count),
        },
        details: assessmentResults,
        clarityFocusWords,
      }
    }

    return null
  } catch (error) {
    console.error('Pronunciation assessment error:', error)
    return null
  } finally {
    store.setProcessing(false)
  }
}
