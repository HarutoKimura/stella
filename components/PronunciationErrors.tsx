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

type PronunciationErrorsProps = {
  words?: PronunciationError[]
}

export function PronunciationErrors({ words }: PronunciationErrorsProps) {
  if (!words || words.length === 0) {
    return null
  }

  // Filter to show only words with issues (accuracy < 70 or has error type)
  const problematicWords = words.filter(
    (w) => w.errorType !== 'None' || (w.accuracyScore && w.accuracyScore < 70)
  )

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
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span>🎯</span>
        <span>Pronunciation Feedback</span>
        <span className="text-sm text-gray-400 font-normal">
          ({problematicWords.length} word{problematicWords.length !== 1 ? 's' : ''} to improve)
        </span>
      </h2>

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

            {/* Phoneme breakdown if available */}
            {wordData.phonemes && wordData.phonemes.length > 0 && (
              <div className="mt-4 bg-orange-500/10 border border-orange-500/20 rounded p-3">
                <p className="text-orange-200 text-sm font-medium mb-2">
                  🔊 Sound breakdown:
                </p>
                <div className="flex flex-wrap gap-2">
                  {wordData.phonemes.map((phoneme, pIdx) => (
                    <div
                      key={pIdx}
                      className={`px-2 py-1 rounded text-xs font-mono ${
                        phoneme.accuracyScore >= 80
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                          : phoneme.accuracyScore >= 60
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      /{phoneme.phoneme}/ {Math.round(phoneme.accuracyScore)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Helpful tip based on error type */}
            <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded p-3">
              <p className="text-blue-200 text-sm">
                <span className="font-semibold">💡 Tip: </span>
                {wordData.errorType === 'Mispronunciation' &&
                  `Listen carefully to how native speakers pronounce "${wordData.word}" and practice mimicking the exact sounds.`}
                {wordData.errorType === 'Omission' &&
                  `Make sure to pronounce every word clearly. Try slowing down slightly.`}
                {wordData.errorType === 'Insertion' &&
                  `You added an extra word here. Focus on speaking more precisely.`}
                {wordData.errorType === 'None' && wordData.accuracyScore && wordData.accuracyScore < 70 &&
                  `Try to pronounce "${wordData.word}" more clearly. Practice the individual sounds that need work.`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Overall advice */}
      <div className="mt-6 bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
        <p className="text-purple-200 text-sm font-medium mb-2">
          📚 Practice Strategy:
        </p>
        <ul className="text-gray-300 text-sm space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">1.</span>
            <span>Record yourself saying these words</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">2.</span>
            <span>Compare with native pronunciation (use online dictionaries)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">3.</span>
            <span>Practice the problem sounds slowly, then gradually speed up</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">4.</span>
            <span>Use these words in full sentences during your next practice</span>
          </li>
        </ul>
      </div>
    </SpotlightCard>
  )
}
