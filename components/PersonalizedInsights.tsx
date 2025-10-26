'use client'

import { useState, useEffect } from 'react'
import SpotlightCard from './SpotlightCard'

type Insights = {
  userId: string
  cefrLevel: string
  streak: number
  totalSessions: number
  recentActivity: {
    last7Days: number
    totalSpeakingMinutes: number
  }
  phraseProgress: {
    planned: number
    attempted: number
    mastered: number
    total: number
  }
  topErrors: Array<{
    type: 'grammar' | 'vocab' | 'pron'
    example: string | null
    correction: string | null
    count: number
  }>
  recommendations: string[]
  fluency: {
    averageWPM: number | null
    recentSessions: number
  }
}

export function PersonalizedInsights() {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInsights()
  }, [])

  const loadInsights = async () => {
    try {
      const response = await fetch('/api/insights')
      if (response.ok) {
        const data = await response.json()
        setInsights(data)
      }
    } catch (error) {
      console.error('Failed to load insights:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-white text-center py-8">
        Loading insights...
      </div>
    )
  }

  if (!insights) {
    return (
      <SpotlightCard className="!p-6" spotlightColor="rgba(239, 68, 68, 0.2)">
        <p className="text-gray-300">Failed to load insights. Please try again.</p>
      </SpotlightCard>
    )
  }

  const masteryPercentage = insights.phraseProgress.total > 0
    ? Math.round((insights.phraseProgress.mastered / insights.phraseProgress.total) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Streak & Activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SpotlightCard className="!p-6" spotlightColor="rgba(251, 146, 60, 0.3)">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🔥</div>
            <div>
              <p className="text-gray-300 text-sm">Current Streak</p>
              <p className="text-3xl font-bold text-white">
                {insights.streak} {insights.streak === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="!p-6" spotlightColor="rgba(34, 197, 94, 0.3)">
          <div className="flex items-center gap-3">
            <div className="text-4xl">📊</div>
            <div>
              <p className="text-gray-300 text-sm">Total Sessions</p>
              <p className="text-3xl font-bold text-white">{insights.totalSessions}</p>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="!p-6" spotlightColor="rgba(59, 130, 246, 0.3)">
          <div className="flex items-center gap-3">
            <div className="text-4xl">⏱️</div>
            <div>
              <p className="text-gray-300 text-sm">This Week</p>
              <p className="text-3xl font-bold text-white">
                {insights.recentActivity.totalSpeakingMinutes} min
              </p>
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* Phrase Mastery Progress */}
      <SpotlightCard className="!p-6" spotlightColor="rgba(139, 92, 246, 0.3)">
        <h3 className="text-white text-lg font-bold mb-4">Phrase Mastery</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Progress</span>
            <span className="text-white font-semibold">{masteryPercentage}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${masteryPercentage}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm mt-4">
            <div>
              <p className="text-gray-400">Planned</p>
              <p className="text-yellow-400 font-semibold text-xl">
                {insights.phraseProgress.planned}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Attempted</p>
              <p className="text-blue-400 font-semibold text-xl">
                {insights.phraseProgress.attempted}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Mastered</p>
              <p className="text-green-400 font-semibold text-xl">
                {insights.phraseProgress.mastered}
              </p>
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* Fluency Stats */}
      {insights.fluency.averageWPM !== null && (
        <SpotlightCard className="!p-6" spotlightColor="rgba(34, 197, 94, 0.3)">
          <h3 className="text-white text-lg font-bold mb-4">Speaking Fluency</h3>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-gray-400 text-sm">Average WPM</p>
              <p className="text-4xl font-bold text-green-400">
                {insights.fluency.averageWPM}
              </p>
            </div>
            <div className="text-gray-500 text-sm">
              Based on {insights.fluency.recentSessions} recent session
              {insights.fluency.recentSessions !== 1 ? 's' : ''}
            </div>
          </div>
        </SpotlightCard>
      )}

      {/* Top Errors */}
      {insights.topErrors.length > 0 && (
        <SpotlightCard className="!p-6" spotlightColor="rgba(239, 68, 68, 0.3)">
          <h3 className="text-white text-lg font-bold mb-4">Areas to Improve</h3>
          <div className="space-y-3">
            {insights.topErrors.map((error, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-white/5 rounded-lg"
              >
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400 text-sm font-semibold">
                    {error.count}x
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded uppercase">
                      {error.type}
                    </span>
                  </div>
                  {error.example && error.correction && (
                    <div className="text-sm">
                      <span className="text-red-300">{error.example}</span>
                      {' → '}
                      <span className="text-green-300">{error.correction}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>
      )}

      {/* Personalized Recommendations */}
      <SpotlightCard className="!p-6" spotlightColor="rgba(125, 249, 255, 0.3)">
        <h3 className="text-white text-lg font-bold mb-4">💡 Recommendations</h3>
        <ul className="space-y-3">
          {insights.recommendations.map((rec, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="text-cyan-400 text-xl flex-shrink-0">→</span>
              <span className="text-gray-300">{rec}</span>
            </li>
          ))}
        </ul>
      </SpotlightCard>
    </div>
  )
}
