'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'

type ErrorPattern = {
  type: string
  example: string
  correction: string
  count: number
}

type Insights = {
  totalSessions: number
  totalPhrases: number
  commonErrors: ErrorPattern[]
  bestDay: string
  streak: number
}

export function LearningInsights() {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadInsights()
  }, [])

  const loadInsights = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) return

      // Get total sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', profile.id)

      // Get mastered phrases
      const { data: phrases } = await supabase
        .from('targets')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'mastered')

      // Get common errors
      const { data: errors } = await supabase
        .from('errors')
        .select('*')
        .eq('user_id', profile.id)
        .order('count', { ascending: false })
        .limit(5)

      // Calculate streak (simplified)
      const sessionsGrouped = sessions?.reduce((acc: any, session) => {
        const date = new Date(session.started_at).toLocaleDateString()
        acc[date] = (acc[date] || 0) + 1
        return acc
      }, {})

      const streak = Object.keys(sessionsGrouped || {}).length

      setInsights({
        totalSessions: sessions?.length || 0,
        totalPhrases: phrases?.length || 0,
        commonErrors: errors || [],
        bestDay: 'Monday', // Simplified - would need more logic
        streak,
      })
    } catch (error) {
      console.error('Failed to load insights:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-white text-center py-8">Loading insights...</div>
  }

  if (!insights) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">💡</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Insights Yet</h3>
        <p className="text-gray-400">Practice more to unlock personalized insights</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-4">Learning Insights</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-700/20 backdrop-blur-md rounded-lg p-6 border border-blue-500/30">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-3xl font-bold text-white">{insights.totalSessions}</div>
          <div className="text-gray-300">Total Sessions</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-purple-700/20 backdrop-blur-md rounded-lg p-6 border border-purple-500/30">
          <div className="text-4xl mb-2">🔥</div>
          <div className="text-3xl font-bold text-white">{insights.streak}</div>
          <div className="text-gray-300">Day Streak</div>
        </div>
      </div>

      {/* Common Mistakes */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-yellow-500/30">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>⚠️</span> Common Mistakes to Watch
        </h3>
        {insights.commonErrors.length > 0 ? (
          <div className="space-y-3">
            {insights.commonErrors.map((error, idx) => (
              <div key={idx} className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-yellow-400 uppercase">
                    {error.type}
                  </div>
                  <div className="text-sm text-gray-400">
                    {error.count} times
                  </div>
                </div>
                <div className="text-red-300 mb-1">
                  ❌ {error.example}
                </div>
                <div className="text-green-300">
                  ✅ {error.correction}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✨</div>
            <p className="text-gray-300">
              No corrections yet! The AI tutor will track your mistakes as you practice.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Complete more sessions to see patterns in your errors.
            </p>
          </div>
        )}
      </div>

      {/* Encouragement */}
      <div className="bg-gradient-to-br from-green-500/20 to-green-700/20 backdrop-blur-md rounded-lg p-6 border border-green-500/30 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <div className="text-xl font-bold text-white mb-2">
          You're making great progress!
        </div>
        <p className="text-gray-300">
          Keep practicing regularly to improve your fluency
        </p>
      </div>
    </div>
  )
}
