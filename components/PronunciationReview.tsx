'use client'

import { useEffect, useState } from 'react'
import SpotlightCard from './SpotlightCard'

type PronunciationProblem = {
  id: string
  word: string
  accuracy: number
  audio_user_url: string | null
  audio_native_url: string | null
  start_offset_ms: number | null
  end_offset_ms: number | null
  created_at: string
}

type PronunciationReviewProps = {
  sessionId: string
  autoLoad?: boolean
}

export function PronunciationReview({ sessionId, autoLoad = true }: PronunciationReviewProps) {
  const [problems, setProblems] = useState<PronunciationProblem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playingUser, setPlayingUser] = useState<string | null>(null)
  const [playingNative, setPlayingNative] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [recognizedText, setRecognizedText] = useState<string | null>(null)

  useEffect(() => {
    if (autoLoad && sessionId) {
      loadProblems()
    }
  }, [sessionId, autoLoad])

  const loadProblems = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch pronunciation problems
      const response = await fetch(`/api/pronunciation-review?sessionId=${sessionId}`)

      if (!response.ok) {
        throw new Error('Failed to load pronunciation review')
      }

      const data = await response.json()
      const problemsFound = data.problems || []
      setProblems(problemsFound)

      // Also fetch the recognized text from session to show what Azure heard
      // This helps users understand why certain words are flagged
      try {
        const { createClient } = await import('@/lib/supabaseClient')
        const supabase = createClient()
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('summary')
          .eq('id', sessionId)
          .single()

        if (sessionData?.summary?.pronunciation_assessment?.words) {
          // Extract all recognized words
          const words = sessionData.summary.pronunciation_assessment.words
          const text = words.map((w: any) => w.word).join(' ')
          setRecognizedText(text)
        }
      } catch (textErr) {
        console.error('[Pronunciation Review] Failed to load recognized text:', textErr)
      }

      // If no problems found and we haven't retried yet, wait and retry
      // This handles the race condition where extraction is still processing
      if (problemsFound.length === 0 && retryCount < 3) {
        console.log(`[Pronunciation Review] No problems found, will retry in 2s (attempt ${retryCount + 1}/3)`)
        setTimeout(() => {
          setRetryCount(retryCount + 1)
          loadProblems()
        }, 2000)
      }
    } catch (err) {
      console.error('[Pronunciation Review] Error loading problems:', err)
      setError(err instanceof Error ? err.message : 'Failed to load review')
    } finally {
      setLoading(false)
    }
  }

  const playAudio = async (
    url: string | null,
    type: 'user' | 'native',
    problemId: string,
    startMs?: number | null,
    endMs?: number | null
  ) => {
    if (!url) return

    // Stop any currently playing audio
    document.querySelectorAll('audio').forEach((audio) => audio.pause())

    if (type === 'user') {
      setPlayingUser(problemId)
      setPlayingNative(null)
    } else {
      setPlayingNative(problemId)
      setPlayingUser(null)
    }

    try {
      // If we have timing info, use Web Audio API to play only the specific word
      if (type === 'user' && startMs !== null && endMs !== null && startMs !== undefined && endMs !== undefined) {
        console.log(`[Pronunciation Review] Playing word clip: ${startMs}ms - ${endMs}ms`)
        await playAudioClip(url, startMs / 1000, endMs / 1000, () => {
          setPlayingUser(null)
        })
      } else {
        // For native TTS or when we don't have timing, play full audio
        const audio = new Audio(url)
        audio.onended = () => {
          if (type === 'user') {
            setPlayingUser(null)
          } else {
            setPlayingNative(null)
          }
        }
        audio.onerror = () => {
          if (type === 'user') {
            setPlayingUser(null)
          } else {
            setPlayingNative(null)
          }
        }
        await audio.play()
      }
    } catch (err) {
      console.error('[Pronunciation Review] Audio playback error:', err)
      if (type === 'user') {
        setPlayingUser(null)
      } else {
        setPlayingNative(null)
      }
    }
  }

  // Play a specific time range from an audio file using Web Audio API
  const playAudioClip = async (
    url: string,
    startTime: number,
    endTime: number,
    onEnded: () => void
  ) => {
    try {
      // Fetch and decode audio
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      // Create buffer source
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)

      // Add padding for context (100ms before and after)
      const padding = 0.1
      const actualStart = Math.max(0, startTime - padding)
      const actualEnd = Math.min(audioBuffer.duration, endTime + padding)
      const duration = actualEnd - actualStart

      // Play the specific segment
      source.start(0, actualStart, duration)

      // Clean up when done
      source.onended = () => {
        audioContext.close()
        onEnded()
      }
    } catch (err) {
      console.error('[Pronunciation Review] Audio clip playback error:', err)
      onEnded()
    }
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 60) return 'text-yellow-400'
    if (accuracy >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getAccuracyBg = (accuracy: number) => {
    if (accuracy >= 60) return 'bg-yellow-500/10 border-yellow-500/30'
    if (accuracy >= 40) return 'bg-orange-500/10 border-orange-500/30'
    return 'bg-red-500/10 border-red-500/30'
  }

  if (loading) {
    return (
      <SpotlightCard className="!p-6" spotlightColor="rgba(139, 92, 246, 0.2)">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
          <span className="ml-3 text-gray-300">
            {retryCount > 0
              ? `Analyzing pronunciation... (attempt ${retryCount + 1}/3)`
              : 'Loading pronunciation review...'}
          </span>
        </div>
      </SpotlightCard>
    )
  }

  if (error) {
    return (
      <SpotlightCard className="!p-6" spotlightColor="rgba(239, 68, 68, 0.2)">
        <div className="text-red-400 text-center py-4">
          <p className="font-semibold mb-2">Error Loading Review</p>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={loadProblems}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </SpotlightCard>
    )
  }

  if (problems.length === 0) {
    return (
      <SpotlightCard className="!p-6" spotlightColor="rgba(16, 185, 129, 0.2)">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>🎯</span>
          <span>Pronunciation Review</span>
        </h2>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-green-400 font-semibold text-lg mb-2">Excellent Work!</p>
          <p className="text-gray-400 text-sm">
            No pronunciation issues detected in this session. Keep up the great work!
          </p>
        </div>
      </SpotlightCard>
    )
  }

  return (
    <SpotlightCard className="!p-6" spotlightColor="rgba(139, 92, 246, 0.2)">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🎯</span>
          <span>Pronunciation Review</span>
        </h2>
        <div className="text-sm text-gray-400">
          {problems.length} word{problems.length !== 1 ? 's' : ''} to improve
        </div>
      </div>

      {/* Show what Azure recognized */}
      {recognizedText && (
        <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-400 text-lg shrink-0">🎤</span>
            <div className="flex-1 min-w-0">
              <p className="text-blue-200 text-sm font-medium mb-2">
                What Azure Speech Recognition heard:
              </p>
              <p className="text-white text-sm mb-3 italic">
                &ldquo;{recognizedText}&rdquo;
              </p>
              <p className="text-gray-400 text-xs leading-relaxed">
                💡 <strong>Note:</strong> If this doesn't match what you said, the speech recognition may have misheard you.
                The pronunciation problems below are based on this recognized text.
                Try speaking more clearly or check your microphone for better accuracy.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {problems.map((problem) => (
          <div
            key={problem.id}
            className={`rounded-lg border p-4 transition-all hover:border-purple-400/50 ${getAccuracyBg(
              problem.accuracy
            )}`}
          >
            <div className="flex items-center justify-between gap-4">
              {/* Word and Score */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`text-lg font-bold ${getAccuracyColor(
                      problem.accuracy
                    )}`}
                  >
                    {problem.word}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-1 rounded">
                    Score: {Math.round(problem.accuracy)}%
                  </span>
                </div>

                {/* Audio Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* User Audio */}
                  {problem.audio_user_url && (
                    <button
                      onClick={() =>
                        playAudio(
                          problem.audio_user_url,
                          'user',
                          problem.id,
                          problem.start_offset_ms,
                          problem.end_offset_ms
                        )
                      }
                      disabled={playingUser === problem.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                      <span className="text-blue-400">
                        {playingUser === problem.id ? '⏸' : '▶'}
                      </span>
                      <span className="text-gray-300">
                        Your pronunciation
                        {problem.start_offset_ms !== null && (
                          <span className="text-xs text-gray-500 ml-1">
                            (word only)
                          </span>
                        )}
                      </span>
                    </button>
                  )}

                  {/* Native Audio */}
                  {problem.audio_native_url && (
                    <button
                      onClick={() =>
                        playAudio(problem.audio_native_url, 'native', problem.id)
                      }
                      disabled={playingNative === problem.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                      <span className="text-green-400">
                        {playingNative === problem.id ? '⏸' : '▶'}
                      </span>
                      <span className="text-gray-300">Native speaker</span>
                    </button>
                  )}

                  {!problem.audio_user_url && !problem.audio_native_url && (
                    <span className="text-xs text-gray-500">
                      Audio not available
                    </span>
                  )}
                </div>
              </div>

              {/* Visual Score Indicator */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-12 h-12">
                  <svg className="transform -rotate-90 w-12 h-12">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      className="text-gray-700"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${
                        2 * Math.PI * 20 * (1 - problem.accuracy / 100)
                      }`}
                      className={
                        problem.accuracy >= 60
                          ? 'text-yellow-400'
                          : problem.accuracy >= 40
                          ? 'text-orange-400'
                          : 'text-red-400'
                      }
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {Math.round(problem.accuracy)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tips Section */}
      <div className="mt-6 bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
        <p className="text-purple-200 text-sm font-medium mb-2">💡 Practice Tips:</p>
        <ul className="text-gray-300 text-sm space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            <span>
              Listen to the native pronunciation and try to mimic the exact sound
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            <span>
              Record yourself saying the word and compare with the native sample
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">•</span>
            <span>
              Practice these words in context by using them in full sentences
            </span>
          </li>
        </ul>
      </div>
    </SpotlightCard>
  )
}

export default PronunciationReview
