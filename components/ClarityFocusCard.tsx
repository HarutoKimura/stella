'use client'

import SpotlightCard from './SpotlightCard'

type ClarityFocusWord = {
  word: string
  accuracy_score: number
  segment_index: number | null
  phonemes?: any
}

type ClarityFocusCardProps = {
  words: ClarityFocusWord[]
  className?: string
}

/**
 * ClarityFocusCard - Displays the 3-5 lowest-accuracy pronunciation words
 * from a session to help users focus on their most challenging pronunciations
 */
export function ClarityFocusCard({ words, className = '' }: ClarityFocusCardProps) {
  if (!words || words.length === 0) {
    return null
  }

  // Helper function to get color based on accuracy score
  const getAccuracyColor = (score: number): string => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  // Helper function to get progress bar color
  const getProgressBarColor = (score: number): string => {
    if (score >= 80) return 'from-green-500 to-emerald-500'
    if (score >= 60) return 'from-yellow-500 to-amber-500'
    return 'from-red-500 to-orange-500'
  }

  // Helper function to get pronunciation tip based on accuracy
  const getPronunciationTip = (word: string, score: number): string => {
    if (score >= 80) {
      return 'Good! Minor improvements possible'
    } else if (score >= 60) {
      return 'Practice this word more slowly'
    } else if (score >= 40) {
      return 'Focus on each sound separately'
    } else {
      return 'Listen to native speakers say this word'
    }
  }

  return (
    <SpotlightCard className={`!p-6 ${className}`} spotlightColor="rgba(249, 115, 22, 0.2)">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-3xl">🗣️</span>
          <div>
            <h3 className="text-xl font-bold text-white">Clarity Focus</h3>
            <p className="text-sm text-gray-400">
              Words needing pronunciation practice
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {words.map((wordData, index) => (
          <div
            key={`${wordData.word}-${index}`}
            className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4 hover:bg-orange-500/10 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-bold text-white">
                    {wordData.word}
                  </span>
                  <span className={`text-xl font-bold ${getAccuracyColor(wordData.accuracy_score)}`}>
                    {Math.round(wordData.accuracy_score)}%
                  </span>
                </div>

                {/* Phoneme details if available - right under the word */}
                {wordData.phonemes && wordData.phonemes.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-2">
                      {wordData.phonemes.map((phoneme: any, idx: number) => {
                        const hasValidAccuracy = phoneme.accuracyScore !== undefined &&
                                                phoneme.accuracyScore !== null &&
                                                !isNaN(phoneme.accuracyScore)

                        return (
                          <div
                            key={idx}
                            className="text-xs px-2 py-1 rounded bg-gray-700/50 border border-gray-600"
                            title={hasValidAccuracy ? `Accuracy: ${Math.round(phoneme.accuracyScore)}%` : 'Phoneme'}
                          >
                            <span className="text-gray-300">{phoneme.phoneme}</span>
                            {hasValidAccuracy && (
                              <span className={`ml-1 ${getAccuracyColor(phoneme.accuracyScore)}`}>
                                {Math.round(phoneme.accuracyScore)}%
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className={`bg-gradient-to-r ${getProgressBarColor(wordData.accuracy_score)} h-2 rounded-full transition-all`}
                    style={{ width: `${wordData.accuracy_score}%` }}
                  />
                </div>

                {/* Pronunciation tip */}
                <p className="text-sm text-orange-200 flex items-start gap-2">
                  <span className="text-orange-400 flex-shrink-0">💡</span>
                  <span>{getPronunciationTip(wordData.word, wordData.accuracy_score)}</span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SpotlightCard>
  )
}
