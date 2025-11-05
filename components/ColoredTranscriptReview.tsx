'use client'

import { useState, useEffect } from 'react'
import SpotlightCard from './SpotlightCard'
import { WordDetailModal } from './WordDetailModal'

type WordData = {
  word: string
  accuracyScore: number
  errorType?: 'None' | 'Mispronunciation' | 'Omission' | 'Insertion'
  offset?: number
  duration?: number
  audioUrl?: string | null
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

type TranscriptWord = {
  text: string
  hasScore: boolean
  wordData?: WordData
  turnRole: 'user' | 'tutor'
  turnIndex: number
  wordIndexInTurn: number
}

type ColoredTranscriptReviewProps = {
  sessionId: string
  words?: WordData[]
  autoLoad?: boolean
}

export function ColoredTranscriptReview({
  sessionId,
  words: initialWords,
}: ColoredTranscriptReviewProps) {
  const [transcriptWords, setTranscriptWords] = useState<TranscriptWord[]>([])
  const [audioMap, setAudioMap] = useState<Map<string, AudioData>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedWord, setSelectedWord] = useState<any | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (sessionId) {
      loadTranscriptAndScores()
    }
  }, [sessionId])

  const loadTranscriptAndScores = async () => {
    setLoading(true)
    setError(null)

    try {
      const { createClient } = await import('@/lib/supabaseClient')
      const supabase = createClient()

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('summary')
        .eq('id', sessionId)
        .single()

      if (sessionError || !sessionData) {
        throw new Error('Failed to load session data')
      }

      // Load pronunciation assessment data (what Azure heard)
      const pronunciationAssessment = sessionData.summary?.pronunciation_assessment
      const azureWords = pronunciationAssessment?.words || initialWords || []

      if (azureWords.length === 0) {
        setError('No pronunciation data available for this session')
        setLoading(false)
        return
      }

      // Build simple array of words with scores (what Azure recognized)
      buildAzureTranscriptWords(azureWords)

      // Load audio data for playback
      await loadAudioData()

      setLoading(false)
    } catch (err) {
      console.error('[Colored Transcript] Error loading data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load transcript')
      setLoading(false)
    }
  }

  const buildAzureTranscriptWords = (azureWords: WordData[]) => {
    // Simply map Azure recognized words to transcript words
    // Every word has a score and can be clicked
    const allWords: TranscriptWord[] = azureWords.map((wordData, idx) => ({
      text: wordData.word,
      hasScore: true,
      wordData: wordData,
      turnRole: 'user', // All Azure-recognized words are from user speech
      turnIndex: 0,
      wordIndexInTurn: idx,
    }))

    console.log('[Colored Transcript] Built Azure transcript:', allWords.length, 'words')
    setTranscriptWords(allWords)
  }

  const loadAudioData = async () => {
    try {
      const response = await fetch(`/api/pronunciation-review?sessionId=${sessionId}`)

      if (response.ok) {
        const data = await response.json()
        const problems = data.problems || []

        const map = new Map<string, AudioData>()
        problems.forEach((problem: any) => {
          const key = problem.word.toLowerCase().replace(/[^\w\s]/g, '')
          map.set(key, {
            audio_user_url: problem.audio_user_url,
            audio_native_url: problem.audio_native_url,
            start_offset_ms: problem.start_offset_ms,
            end_offset_ms: problem.end_offset_ms,
          })
        })

        setAudioMap(map)
      }
    } catch (err) {
      console.error('[Colored Transcript] Failed to fetch audio data:', err)
    }
  }

  const handleWordClick = (transcriptWord: TranscriptWord) => {
    if (!transcriptWord.hasScore || !transcriptWord.wordData) return

    const normalizedWord = transcriptWord.text.toLowerCase().replace(/[^\w\s]/g, '')
    const audioData = audioMap.get(normalizedWord)

    const wordDetail = {
      word: transcriptWord.wordData.word,
      accuracyScore: transcriptWord.wordData.accuracyScore,
      errorType: transcriptWord.wordData.errorType,
      phonemes: transcriptWord.wordData.phonemes,
      audioUserUrl: audioData?.audio_user_url || transcriptWord.wordData.audioUrl,
      audioNativeUrl: audioData?.audio_native_url,
      startOffsetMs: audioData?.start_offset_ms ?? (transcriptWord.wordData.offset ? Math.floor(transcriptWord.wordData.offset / 10000) : null),
      endOffsetMs: audioData?.end_offset_ms ?? (transcriptWord.wordData.offset && transcriptWord.wordData.duration ? Math.floor((transcriptWord.wordData.offset + transcriptWord.wordData.duration) / 10000) : null),
    }

    setSelectedWord(wordDetail)
  }

  const getWordColor = (accuracy: number) => {
    if (accuracy >= 85) return 'text-green-400 hover:text-green-300'
    if (accuracy >= 70) return 'text-yellow-400 hover:text-yellow-300'
    if (accuracy >= 50) return 'text-orange-400 hover:text-orange-300'
    return 'text-red-400 hover:text-red-300'
  }

  const getWordBgClass = (accuracy: number) => {
    if (accuracy >= 85) return 'hover:bg-green-500/20'
    if (accuracy >= 70) return 'hover:bg-yellow-500/20'
    if (accuracy >= 50) return 'hover:bg-orange-500/20'
    return 'hover:bg-red-500/20'
  }

  const getWordUnderlineClass = (accuracy: number) => {
    if (accuracy >= 85) return 'decoration-green-400/60'
    if (accuracy >= 70) return 'decoration-yellow-400/60'
    if (accuracy >= 50) return 'decoration-orange-400/60'
    return 'decoration-red-400/60'
  }

  if (loading) {
    return (
      <SpotlightCard className="!p-6" spotlightColor="rgba(139, 92, 246, 0.2)">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
          <span className="ml-3 text-gray-300">Loading pronunciation transcript...</span>
        </div>
      </SpotlightCard>
    )
  }

  if (error) {
    return (
      <SpotlightCard className="!p-6" spotlightColor="rgba(239, 68, 68, 0.2)">
        <div className="text-red-400 text-center py-4">
          <p className="font-semibold mb-2">Error Loading Transcript</p>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={loadTranscriptAndScores}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </SpotlightCard>
    )
  }

  if (transcriptWords.length === 0) {
    return (
      <SpotlightCard className="!p-6" spotlightColor="rgba(107, 114, 128, 0.2)">
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🎤</div>
          <p className="text-gray-400 font-semibold text-lg mb-2">No Pronunciation Data</p>
          <p className="text-gray-500 text-sm">
            This session doesn't have pronunciation assessment data yet.
          </p>
        </div>
      </SpotlightCard>
    )
  }

  // Calculate statistics from words with scores
  const wordsWithScores = transcriptWords.filter(w => w.hasScore && w.wordData)
  const excellentWords = wordsWithScores.filter(w => w.wordData!.accuracyScore >= 85).length
  const goodWords = wordsWithScores.filter(w => w.wordData!.accuracyScore >= 70 && w.wordData!.accuracyScore < 85).length
  const fairWords = wordsWithScores.filter(w => w.wordData!.accuracyScore >= 50 && w.wordData!.accuracyScore < 70).length
  const needsPracticeWords = wordsWithScores.filter(w => w.wordData!.accuracyScore < 50).length

  return (
    <>
      <SpotlightCard className="!p-6 mb-6" spotlightColor="rgba(139, 92, 246, 0.2)">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity mb-6"
        >
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📝</span>
            <span>Pronunciation Transcript</span>
            <span className="text-sm text-gray-400 font-normal">
              ({wordsWithScores.length} word{wordsWithScores.length !== 1 ? 's' : ''} assessed)
            </span>
          </h2>
          <span className="text-gray-400 text-sm">
            {isExpanded ? '▲ Hide' : '▼ Show'}
          </span>
        </button>

        {isExpanded && (
          <>
            {/* Legend */}
            {wordsWithScores.length > 0 && (
              <div className="mb-6 bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <p className="text-gray-300 text-sm font-medium mb-3">
                  Color Guide - Click colored words for details:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <span className="text-green-400 text-sm">
                      Excellent ({excellentWords})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <span className="text-yellow-400 text-sm">
                      Good ({goodWords})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                    <span className="text-orange-400 text-sm">
                      Fair ({fairWords})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <span className="text-red-400 text-sm">
                      Needs Practice ({needsPracticeWords})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* What Azure Speech Recognition Heard - All Words Colored by Score */}
            <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-6">
              <div className="mb-3 flex items-center gap-2 text-sm text-blue-300">
                <span className="text-lg">🎤</span>
                <span className="font-medium">What Azure Speech Recognition heard:</span>
              </div>
              <div className="text-lg leading-relaxed">
                {transcriptWords.map((transcriptWord, idx) => {
                  const { wordData } = transcriptWord
                  if (!wordData) return null

                  return (
                    <span key={idx}>
                      <button
                        onClick={() => handleWordClick(transcriptWord)}
                        className={`
                          ${getWordColor(wordData.accuracyScore)}
                          ${getWordBgClass(wordData.accuracyScore)}
                          ${getWordUnderlineClass(wordData.accuracyScore)}
                          underline decoration-2 underline-offset-4
                          px-1 py-0.5 rounded transition-all cursor-pointer
                          font-medium
                        `}
                        title={`${wordData.word}: ${Math.round(wordData.accuracyScore)}% accuracy - Click for details`}
                      >
                        {transcriptWord.text}
                      </button>
                      {idx < transcriptWords.length - 1 && ' '}
                    </span>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </SpotlightCard>

      {/* Word Detail Modal */}
      {selectedWord && (
        <WordDetailModal
          wordDetail={selectedWord}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </>
  )
}
