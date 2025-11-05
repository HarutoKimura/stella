'use client'

import { useEffect, useState } from 'react'
import SpotlightCard from './SpotlightCard'

type PronunciationError = {
  word: string
  accuracyScore: number
  errorType: 'None' | 'Mispronunciation' | 'Omission' | 'Insertion'
  phonemes?: Array<{
    phoneme: string
    accuracyScore: number
  }>
}

type AudioData = {
  audio_user_url: string | null
  audio_native_url: string | null
  start_offset_ms: number | null
  end_offset_ms: number | null
}

type PronunciationErrorsProps = {
  words?: PronunciationError[]
  sessionId?: string
}

export function PronunciationErrors({ words, sessionId }: PronunciationErrorsProps) {
  const [audioMap, setAudioMap] = useState<Map<string, AudioData>>(new Map())
  const [playingUser, setPlayingUser] = useState<string | null>(null)
  const [playingNative, setPlayingNative] = useState<string | null>(null)
  const [recognizedText, setRecognizedText] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  console.log('[Pronunciation Errors] Component initialized with sessionId:', sessionId, 'words:', words?.length)

  useEffect(() => {
    console.log('[Pronunciation Errors] useEffect triggered, sessionId:', sessionId, 'words.length:', words?.length)
    if (sessionId && words && words.length > 0) {
      fetchAudioData()
    }
  }, [sessionId, words])

  const fetchAudioData = async () => {
    try {
      setIsLoadingAudio(true)
      console.log('[Pronunciation Errors] Fetching audio data for session:', sessionId)
      const response = await fetch(`/api/pronunciation-review?sessionId=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        const problems = data.problems || []
        console.log('[Pronunciation Errors] Fetched problems:', problems.length, problems)

        // Create a map of word -> audio data
        const map = new Map<string, AudioData>()
        problems.forEach((problem: any) => {
          const key = problem.word.toLowerCase()
          console.log('[Pronunciation Errors] Mapping word:', key, problem)
          map.set(key, {
            audio_user_url: problem.audio_user_url,
            audio_native_url: problem.audio_native_url,
            start_offset_ms: problem.start_offset_ms,
            end_offset_ms: problem.end_offset_ms,
          })
        })
        console.log('[Pronunciation Errors] Audio map size:', map.size)
        setAudioMap(map)

        // If no audio data found and we haven't retried too many times, retry
        if (map.size === 0 && retryCount < 3) {
          console.log(`[Pronunciation Errors] No audio data found, will retry in 2s (attempt ${retryCount + 1}/3)`)
          setTimeout(() => {
            setRetryCount(retryCount + 1)
            fetchAudioData()
          }, 2000)
        }
      } else {
        console.error('[Pronunciation Errors] Failed to fetch, status:', response.status)
      }

      // Also fetch the recognized text from session to show what Azure heard
      const { createClient } = await import('@/lib/supabaseClient')
      const supabase = createClient()
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('summary')
        .eq('id', sessionId)
        .single()

      if (sessionData?.summary?.pronunciation_assessment?.words) {
        const words = sessionData.summary.pronunciation_assessment.words
        const text = words.map((w: any) => w.word).join(' ')
        setRecognizedText(text)
      }
    } catch (err) {
      console.error('[Pronunciation Errors] Failed to fetch audio data:', err)
    } finally {
      setIsLoadingAudio(false)
    }
  }

  const playAudio = async (
    url: string | null,
    type: 'user' | 'native',
    word: string,
    startMs?: number | null,
    endMs?: number | null
  ) => {
    if (!url) return

    // Stop any currently playing audio
    document.querySelectorAll('audio').forEach((audio) => audio.pause())

    if (type === 'user') {
      setPlayingUser(word)
      setPlayingNative(null)
    } else {
      setPlayingNative(word)
      setPlayingUser(null)
    }

    try {
      // If we have timing info for user audio, use Web Audio API to play only the specific word
      if (type === 'user' && startMs !== null && endMs !== null && startMs !== undefined && endMs !== undefined) {
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
      console.error('[Pronunciation Errors] Audio playback error:', err)
      if (type === 'user') {
        setPlayingUser(null)
      } else {
        setPlayingNative(null)
      }
    }
  }

  const playAudioClip = async (
    url: string,
    startTime: number,
    endTime: number,
    onEnded: () => void
  ) => {
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)

      // Add padding for context (100ms before and after)
      const padding = 0.1
      const actualStart = Math.max(0, startTime - padding)
      const actualEnd = Math.min(audioBuffer.duration, endTime + padding)
      const duration = actualEnd - actualStart

      source.start(0, actualStart, duration)

      source.onended = () => {
        audioContext.close()
        onEnded()
      }
    } catch (err) {
      console.error('[Pronunciation Errors] Audio clip playback error:', err)
      onEnded()
    }
  }

  if (!words || words.length === 0) {
    return null
  }

  // Filter to show only words with issues (accuracy < 85 or has error type)
  // Match the same threshold as the extract endpoint
  const problematicWords = words.filter(
    (w) => w.errorType !== 'None' || (w.accuracyScore && w.accuracyScore < 85)
  )

  console.log('[Pronunciation Errors] Total words:', words.length)
  console.log('[Pronunciation Errors] Problematic words:', problematicWords.length, problematicWords.map(w => w.word))

  if (problematicWords.length === 0) {
    return (
      <SpotlightCard className="!p-6 mb-6" spotlightColor="rgba(34, 197, 94, 0.2)">
        <div className="text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-xl font-bold text-green-300 mb-2">Perfect Pronunciation!</h2>
          <p className="text-gray-400 text-sm">
            No mispronunciations detected. Great job!
          </p>
        </div>
      </SpotlightCard>
    )
  }

  return (
    <SpotlightCard className="!p-6 mb-6" spotlightColor="rgba(249, 115, 22, 0.2)">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity mb-4"
      >
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🎯</span>
          <span>Pronunciation Feedback</span>
          <span className="text-sm text-gray-400 font-normal">
            ({problematicWords.length} word{problematicWords.length !== 1 ? 's' : ''} to improve)
          </span>
        </h2>
        <span className="text-gray-400 text-sm">
          {isExpanded ? '▲ Hide' : '▼ Show'}
        </span>
      </button>

      {isExpanded && (
        <>
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
                The problems below are based on this recognized text.
                Try speaking more clearly or check your microphone for better accuracy.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {problematicWords.map((wordData, idx) => (
          <div
            key={idx}
            className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {wordData.errorType === 'Mispronunciation' ? '🔴' :
                   wordData.errorType === 'Omission' ? '⚠️' :
                   wordData.errorType === 'Insertion' ? '➕' : '🟡'}
                </span>
                <div>
                  <h3 className="text-white font-bold text-lg">&ldquo;{wordData.word}&rdquo;</h3>
                  <p className="text-orange-300 text-sm">
                    {wordData.errorType === 'Mispronunciation' && 'Mispronounced'}
                    {wordData.errorType === 'Omission' && 'Word skipped'}
                    {wordData.errorType === 'Insertion' && 'Extra word added'}
                    {wordData.errorType === 'None' && 'Could be clearer'}
                  </p>
                </div>
              </div>
              {wordData.accuracyScore && (
                <div className="text-right">
                  <div className={`text-3xl font-bold ${
                    wordData.accuracyScore >= 70 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {Math.round(wordData.accuracyScore)}
                  </div>
                  <div className="text-gray-400 text-xs">accuracy</div>
                </div>
              )}
            </div>

            {/* Audio Playback Controls */}
            {(() => {
              const wordKey = wordData.word.toLowerCase()
              const audioData = audioMap.get(wordKey)
              const allKeys = Array.from(audioMap.keys())
              console.log('[Pronunciation Errors] Looking up audio for word:', wordKey, 'found:', !!audioData, 'map size:', audioMap.size, 'all keys:', allKeys)
              if (audioData) {
                console.log('[Pronunciation Errors] Audio data for', wordKey, ':', audioData)
              }

              // Show loading state
              if (isLoadingAudio && audioMap.size === 0) {
                return (
                  <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      <span>Loading audio playback...</span>
                    </div>
                  </div>
                )
              }

              if (audioData && (audioData.audio_user_url || audioData.audio_native_url)) {
                return (
                  <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <p className="text-blue-200 text-sm font-medium mb-3">
                      🎧 Listen & Compare:
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* User Audio */}
                      {audioData.audio_user_url && (
                        <button
                          onClick={() =>
                            playAudio(
                              audioData.audio_user_url,
                              'user',
                              wordData.word,
                              audioData.start_offset_ms,
                              audioData.end_offset_ms
                            )
                          }
                          disabled={playingUser === wordData.word}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors text-sm disabled:opacity-50"
                        >
                          <span className="text-blue-400">
                            {playingUser === wordData.word ? '⏸' : '▶'}
                          </span>
                          <span className="text-gray-300">Your pronunciation</span>
                        </button>
                      )}

                      {/* Native Audio */}
                      {audioData.audio_native_url && (
                        <button
                          onClick={() =>
                            playAudio(audioData.audio_native_url, 'native', wordData.word)
                          }
                          disabled={playingNative === wordData.word}
                          className="flex items-center gap-2 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 rounded-lg transition-colors text-sm disabled:opacity-50"
                        >
                          <span className="text-green-400">
                            {playingNative === wordData.word ? '⏸' : '▶'}
                          </span>
                          <span className="text-gray-300">Native speaker</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              }
              return null
            })()}

            {/* Phoneme breakdown if available */}
            {wordData.phonemes && wordData.phonemes.length > 0 && (
              <div className="mt-4 bg-orange-500/10 border border-orange-500/20 rounded p-3">
                <p className="text-orange-200 text-sm font-medium mb-2">
                  🔊 Sound breakdown (IPA):
                </p>
                <div className="flex flex-wrap gap-2">
                  {wordData.phonemes.map((phoneme, pIdx) => {
                    const hasScore = typeof phoneme.accuracyScore === 'number' && !isNaN(phoneme.accuracyScore)
                    const score = hasScore ? phoneme.accuracyScore : 0

                    return (
                      <div
                        key={pIdx}
                        className={`px-2 py-1 rounded text-xs font-mono ${
                          hasScore
                            ? score >= 80
                              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                              : score >= 60
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                        }`}
                      >
                        /{phoneme.phoneme}/{hasScore ? ` ${Math.round(score)}` : ''}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
        </>
      )}
    </SpotlightCard>
  )
}
