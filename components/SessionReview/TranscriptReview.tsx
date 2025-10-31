import { useState } from 'react'
import SpotlightCard from '../SpotlightCard'

type TranscriptTurn = {
  role: 'user' | 'tutor'
  text: string
  timestamp: number
}

type Correction = {
  type: 'grammar' | 'vocab' | 'pron'
  example: string
  correction: string
}

type Props = {
  transcript: TranscriptTurn[]
  corrections: Correction[]
}

export function TranscriptReview({ transcript, corrections }: Props) {
  const [showTimestamps, setShowTimestamps] = useState(false)

  // Helper: Check if a user turn contains an error
  const findCorrectionsForTurn = (text: string): Correction[] => {
    return corrections.filter((corr) =>
      text.toLowerCase().includes(corr.example.toLowerCase())
    )
  }

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (transcript.length === 0) {
    return (
      <SpotlightCard className="!p-8">
        <div className="text-center">
          <p className="text-gray-400 text-lg">No transcript available for this session.</p>
          <p className="text-gray-500 text-sm mt-2">
            Transcripts are saved automatically during your conversations.
          </p>
        </div>
      </SpotlightCard>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Full Transcript</h2>
        <button
          onClick={() => setShowTimestamps(!showTimestamps)}
          className="px-3 py-1.5 bg-gray-500/20 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-colors text-xs font-semibold"
        >
          {showTimestamps ? '🕒 Hide Timestamps' : '🕒 Show Timestamps'}
        </button>
      </div>

      {/* Transcript Turns */}
      <div className="space-y-3">
        {transcript.map((turn, index) => {
          const turnCorrections = turn.role === 'user' ? findCorrectionsForTurn(turn.text) : []
          const hasErrors = turnCorrections.length > 0

          return (
            <div key={index} className="flex gap-3">
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  turn.role === 'user'
                    ? 'bg-blue-500/20 border border-blue-500/50'
                    : 'bg-purple-500/20 border border-purple-500/50'
                }`}>
                  {turn.role === 'user' ? '👤' : '🤖'}
                </div>
                {index < transcript.length - 1 && (
                  <div className="w-0.5 h-full bg-gray-700 mt-2" />
                )}
              </div>

              {/* Turn content */}
              <div className="flex-1">
                <SpotlightCard
                  className={`!p-4 ${hasErrors ? '!border-red-500/50' : ''}`}
                  spotlightColor={
                    hasErrors
                      ? 'rgba(239, 68, 68, 0.2)'
                      : turn.role === 'user'
                        ? 'rgba(59, 130, 246, 0.2)'
                        : 'rgba(168, 85, 247, 0.2)'
                  }
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase">
                      {turn.role === 'user' ? 'You' : 'AI Tutor'}
                    </span>
                    {showTimestamps && (
                      <span className="text-xs text-gray-500">
                        {formatTime(turn.timestamp)}
                      </span>
                    )}
                  </div>

                  <p className="text-white text-base leading-relaxed">
                    {turn.text}
                  </p>

                  {/* Show errors inline if found */}
                  {hasErrors && (
                    <div className="mt-3 pt-3 border-t border-red-500/30 space-y-2">
                      {turnCorrections.map((corr, idx) => (
                        <div key={idx} className="text-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-red-400 font-mono text-xs mt-0.5">✗</span>
                            <div className="flex-1">
                              <p className="text-red-300">
                                <span className="font-semibold">Error:</span> {corr.example}
                              </p>
                              <p className="text-green-300 mt-1">
                                <span className="font-semibold">Correct:</span> {corr.correction}
                              </p>
                              <span className="inline-block mt-1 px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                                {corr.type === 'grammar' ? '📝 Grammar' : corr.type === 'vocab' ? '📚 Vocabulary' : '🗣️ Pronunciation'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SpotlightCard>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <SpotlightCard className="!p-4 !bg-gray-800/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <span className="text-gray-400">
              Total Turns: <span className="text-white font-semibold">{transcript.length}</span>
            </span>
            <span className="text-gray-400">
              Your Speaking Time: <span className="text-blue-300 font-semibold">
                {Math.round((transcript.filter(t => t.role === 'user').length / transcript.length) * 100)}%
              </span>
            </span>
          </div>
          <span className="text-gray-500 text-xs">
            💡 Aim for 65%+ speaking time for optimal practice
          </span>
        </div>
      </SpotlightCard>
    </div>
  )
}
