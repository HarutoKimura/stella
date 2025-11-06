import SpotlightCard from './SpotlightCard'

type PronunciationScoresProps = {
  scores?: {
    accuracyScore?: number
    fluencyScore?: number
    pronunciationScore?: number
    prosodyScore?: number
    completenessScore?: number
  }
}

export function PronunciationScores({ scores }: PronunciationScoresProps) {
  if (!scores || !scores.pronunciationScore) {
    return null
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Very Good'
    if (score >= 70) return 'Good'
    if (score >= 60) return 'Fair'
    return 'Needs Practice'
  }

  return (
    <SpotlightCard className="!p-6 mb-6" spotlightColor="rgba(59, 130, 246, 0.2)">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span>🎙️</span>
        <span>Pronunciation Assessment</span>
      </h2>

      {/* Overall Pronunciation Score */}
      <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-300 text-lg font-medium">Overall Score</span>
          <span className={`text-4xl font-bold ${getScoreColor(scores.pronunciationScore)}`}>
            {Math.round(scores.pronunciationScore)}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              scores.pronunciationScore >= 80
                ? 'bg-green-400'
                : scores.pronunciationScore >= 60
                ? 'bg-yellow-400'
                : 'bg-red-400'
            }`}
            style={{ width: `${scores.pronunciationScore}%` }}
          />
        </div>
        <p className="text-gray-400 text-sm mt-2 text-center">
          {getScoreGrade(scores.pronunciationScore)}
        </p>
      </div>

      {/* Detailed Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Accuracy Score */}
        {scores.accuracyScore !== undefined && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-white font-semibold">Accuracy</div>
                <div className="text-xs text-gray-400">How close to native pronunciation</div>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(scores.accuracyScore)}`}>
                {Math.round(scores.accuracyScore)}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  scores.accuracyScore >= 80
                    ? 'bg-green-400'
                    : scores.accuracyScore >= 60
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                }`}
                style={{ width: `${scores.accuracyScore}%` }}
              />
            </div>
          </div>
        )}

        {/* Fluency Score */}
        {scores.fluencyScore !== undefined && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-white font-semibold">Fluency</div>
                <div className="text-xs text-gray-400">Natural flow and breaks</div>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(scores.fluencyScore)}`}>
                {Math.round(scores.fluencyScore)}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  scores.fluencyScore >= 80
                    ? 'bg-green-400'
                    : scores.fluencyScore >= 60
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                }`}
                style={{ width: `${scores.fluencyScore}%` }}
              />
            </div>
          </div>
        )}

        {/* Prosody Score */}
        {scores.prosodyScore !== undefined && scores.prosodyScore > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-white font-semibold">Prosody</div>
                <div className="text-xs text-gray-400">Stress, intonation, rhythm</div>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(scores.prosodyScore)}`}>
                {Math.round(scores.prosodyScore)}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  scores.prosodyScore >= 80
                    ? 'bg-green-400'
                    : scores.prosodyScore >= 60
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                }`}
                style={{ width: `${scores.prosodyScore}%` }}
              />
            </div>
          </div>
        )}

        {/* Completeness Score */}
        {scores.completenessScore !== undefined && scores.completenessScore > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-white font-semibold">Completeness</div>
                <div className="text-xs text-gray-400">Word completion rate</div>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(scores.completenessScore)}`}>
                {Math.round(scores.completenessScore)}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  scores.completenessScore >= 80
                    ? 'bg-green-400'
                    : scores.completenessScore >= 60
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
                }`}
                style={{ width: `${scores.completenessScore}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </SpotlightCard>
  )
}
