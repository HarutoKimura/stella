'use client'

import { useState, useEffect } from 'react'
import SpotlightCard from './SpotlightCard'

type WordDetail = {
  word: string
  accuracyScore: number
  errorType?: 'None' | 'Mispronunciation' | 'Omission' | 'Insertion'
  phonemes?: Array<{
    phoneme: string
    accuracyScore: number
  }>
  audioUserUrl?: string | null
  audioNativeUrl?: string | null
  startOffsetMs?: number | null
  endOffsetMs?: number | null
}

type WordDetailModalProps = {
  wordDetail: WordDetail | null
  onClose: () => void
}

export function WordDetailModal({ wordDetail, onClose }: WordDetailModalProps) {
  const [playingUser, setPlayingUser] = useState(false)
  const [playingNative, setPlayingNative] = useState(false)

  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  if (!wordDetail) return null

  const playAudio = async (
    url: string | null | undefined,
    type: 'user' | 'native',
    startMs?: number | null,
    endMs?: number | null
  ) => {
    if (!url) return

    // Stop any currently playing audio
    document.querySelectorAll('audio').forEach((audio) => audio.pause())

    if (type === 'user') {
      setPlayingUser(true)
      setPlayingNative(false)
    } else {
      setPlayingNative(true)
      setPlayingUser(false)
    }

    try {
      // If we have timing info for user audio, use Web Audio API
      if (type === 'user' && startMs !== null && endMs !== null && startMs !== undefined && endMs !== undefined) {
        await playAudioClip(url, startMs / 1000, endMs / 1000, () => {
          setPlayingUser(false)
        })
      } else {
        // For native TTS or when we don't have timing, play full audio
        const audio = new Audio(url)
        audio.onended = () => {
          if (type === 'user') {
            setPlayingUser(false)
          } else {
            setPlayingNative(false)
          }
        }
        audio.onerror = () => {
          if (type === 'user') {
            setPlayingUser(false)
          } else {
            setPlayingNative(false)
          }
        }
        await audio.play()
      }
    } catch (err) {
      console.error('[Word Detail Modal] Audio playback error:', err)
      if (type === 'user') {
        setPlayingUser(false)
      } else {
        setPlayingNative(false)
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
      console.error('[Word Detail Modal] Audio clip playback error:', err)
      onEnded()
    }
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 85) return 'text-green-400'
    if (accuracy >= 70) return 'text-yellow-400'
    if (accuracy >= 50) return 'text-orange-400'
    return 'text-red-400'
  }

  const getAccuracyBgClass = (accuracy: number) => {
    if (accuracy >= 85) return 'bg-green-500/10 border-green-500/30'
    if (accuracy >= 70) return 'bg-yellow-500/10 border-yellow-500/30'
    if (accuracy >= 50) return 'bg-orange-500/10 border-orange-500/30'
    return 'bg-red-500/10 border-red-500/30'
  }

  // Generate IPA notation from phonemes
  const getIPANotation = () => {
    if (!wordDetail.phonemes || wordDetail.phonemes.length === 0) {
      return null
    }
    return '/' + wordDetail.phonemes.map(p => p.phoneme).join('') + '/'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <SpotlightCard className="!p-6" spotlightColor="rgba(139, 92, 246, 0.3)">
          {/* Header with close button */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">
                &ldquo;{wordDetail.word}&rdquo;
              </h2>
              {getIPANotation() && (
                <p className="text-gray-400 text-lg font-mono">
                  {getIPANotation()}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Accuracy Score */}
          <div className={`rounded-lg border p-4 mb-6 ${getAccuracyBgClass(wordDetail.accuracyScore)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-300 mb-1">Accuracy Score</p>
                <p className={`text-4xl font-bold ${getAccuracyColor(wordDetail.accuracyScore)}`}>
                  {Math.round(wordDetail.accuracyScore)}%
                </p>
              </div>
              <div className="relative w-20 h-20">
                <svg className="transform -rotate-90 w-20 h-20">
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    className="text-gray-700"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - wordDetail.accuracyScore / 100)}`}
                    className={getAccuracyColor(wordDetail.accuracyScore)}
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Audio Playback Controls */}
          {(wordDetail.audioUserUrl || wordDetail.audioNativeUrl) && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-blue-200 text-sm font-medium mb-3">🎧 Listen & Compare:</p>
              <div className="flex flex-col gap-3">
                {/* User Audio */}
                {wordDetail.audioUserUrl && (
                  <button
                    onClick={() =>
                      playAudio(
                        wordDetail.audioUserUrl,
                        'user',
                        wordDetail.startOffsetMs,
                        wordDetail.endOffsetMs
                      )
                    }
                    disabled={playingUser}
                    className="flex items-center gap-3 px-4 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 w-full"
                  >
                    <span className="text-blue-400 text-xl">
                      {playingUser ? '⏸' : '▶'}
                    </span>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">Your Pronunciation</p>
                      <p className="text-gray-400 text-xs">
                        {wordDetail.startOffsetMs !== null ? 'Word segment' : 'Full audio'}
                      </p>
                    </div>
                  </button>
                )}

                {/* Native Audio */}
                {wordDetail.audioNativeUrl && (
                  <button
                    onClick={() => playAudio(wordDetail.audioNativeUrl, 'native')}
                    disabled={playingNative}
                    className="flex items-center gap-3 px-4 py-3 bg-green-600/20 hover:bg-green-600/30 rounded-lg transition-colors disabled:opacity-50 w-full"
                  >
                    <span className="text-green-400 text-xl">
                      {playingNative ? '⏸' : '▶'}
                    </span>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">Native Speaker</p>
                      <p className="text-gray-400 text-xs">Reference pronunciation</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* IPA Phoneme Breakdown */}
          {wordDetail.phonemes && wordDetail.phonemes.length > 0 && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 mb-6">
              <p className="text-purple-200 text-sm font-medium mb-3">🔊 Sound Breakdown (IPA):</p>
              <div className="flex flex-wrap gap-2">
                {wordDetail.phonemes.map((phoneme, idx) => {
                  const hasScore = typeof phoneme.accuracyScore === 'number' && !isNaN(phoneme.accuracyScore)
                  const score = hasScore ? phoneme.accuracyScore : 0

                  return (
                    <div
                      key={idx}
                      className={`px-3 py-2 rounded-lg text-sm font-mono border ${
                        hasScore
                          ? score >= 85
                            ? 'bg-green-500/20 text-green-300 border-green-500/40'
                            : score >= 70
                            ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                            : score >= 50
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                            : 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-gray-500/20 text-gray-300 border-gray-500/40'
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-bold">/{phoneme.phoneme}/</div>
                        {hasScore && (
                          <div className="text-xs mt-1">{Math.round(score)}%</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-purple-500/30 text-purple-200 border border-purple-500/50 rounded-lg font-semibold hover:bg-purple-500/40 transition-colors"
            >
              Close
            </button>
          </div>
        </SpotlightCard>
      </div>
    </div>
  )
}
