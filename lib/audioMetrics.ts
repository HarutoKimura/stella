/**
 * Phase 2: Audio Metrics Calculator
 *
 * Calculates speaking metrics from voice conversation:
 * - Words Per Minute (WPM)
 * - Filler rate (um, uh, like, etc.)
 * - Average pause duration
 */

import { TranscriptTurn } from './sessionStore'

// Common filler words
const FILLER_WORDS = [
  'um',
  'uh',
  'uhm',
  'er',
  'ah',
  'like',
  'you know',
  'i mean',
  'sort of',
  'kind of',
]

export type AudioMetrics = {
  wpm: number
  filler_rate: number
  avg_pause_ms: number
}

/**
 * Calculate Words Per Minute from transcript
 */
export function calculateWPM(
  transcript: TranscriptTurn[],
  totalSpeakingMs: number
): number {
  const userTurns = transcript.filter((turn) => turn.role === 'user')
  const totalWords = userTurns.reduce((sum, turn) => {
    return sum + turn.text.split(/\s+/).length
  }, 0)

  if (totalSpeakingMs === 0) return 0

  const minutes = totalSpeakingMs / 1000 / 60
  return Math.round(totalWords / minutes)
}

/**
 * Calculate filler word rate (fillers per 100 words)
 */
export function calculateFillerRate(transcript: TranscriptTurn[]): number {
  const userTurns = transcript.filter((turn) => turn.role === 'user')

  let totalWords = 0
  let fillerCount = 0

  for (const turn of userTurns) {
    const words = turn.text.toLowerCase().split(/\s+/)
    totalWords += words.length

    // Count filler words
    for (const word of words) {
      if (FILLER_WORDS.includes(word)) {
        fillerCount++
      }
    }

    // Check for multi-word fillers
    const text = turn.text.toLowerCase()
    for (const filler of FILLER_WORDS) {
      if (filler.includes(' ')) {
        const regex = new RegExp(`\\b${filler}\\b`, 'g')
        const matches = text.match(regex)
        if (matches) {
          fillerCount += matches.length
        }
      }
    }
  }

  if (totalWords === 0) return 0

  return Math.round((fillerCount / totalWords) * 100 * 10) / 10 // Rate per 100 words
}

/**
 * Calculate average pause duration between turns
 */
export function calculateAvgPause(transcript: TranscriptTurn[]): number {
  if (transcript.length < 2) return 0

  let totalPause = 0
  let pauseCount = 0

  for (let i = 1; i < transcript.length; i++) {
    const prevTurn = transcript[i - 1]
    const currTurn = transcript[i]

    // Only count pauses between user turns and tutor responses
    if (prevTurn.role === 'user' && currTurn.role === 'tutor') {
      const pause = currTurn.timestamp - prevTurn.timestamp
      if (pause > 0 && pause < 30000) {
        // Ignore pauses > 30s
        totalPause += pause
        pauseCount++
      }
    }
  }

  if (pauseCount === 0) return 0

  return Math.round(totalPause / pauseCount)
}

/**
 * Calculate all audio metrics from transcript
 */
export function calculateAudioMetrics(
  transcript: TranscriptTurn[],
  totalSpeakingMs: number
): AudioMetrics {
  return {
    wpm: calculateWPM(transcript, totalSpeakingMs),
    filler_rate: calculateFillerRate(transcript),
    avg_pause_ms: calculateAvgPause(transcript),
  }
}

/**
 * Estimate speaking time from transcript (when actual time is not available)
 */
export function estimateSpeakingTime(transcript: TranscriptTurn[]): number {
  // Average speaking rate: ~150 WPM = 2.5 words/second = 400ms/word
  const AVERAGE_MS_PER_WORD = 400

  const userTurns = transcript.filter((turn) => turn.role === 'user')
  const totalWords = userTurns.reduce((sum, turn) => {
    return sum + turn.text.split(/\s+/).length
  }, 0)

  return totalWords * AVERAGE_MS_PER_WORD
}
