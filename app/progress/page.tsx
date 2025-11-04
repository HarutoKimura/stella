'use client'

import { OrbBG } from '@/components/OrbBG'
import { createClient } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

type ProgressData = {
  id: string
  user_id: string
  week_start: string
  grammar_score: number | null
  pronunciation_score: number | null
  vocabulary_score: number | null
  fluency_score: number | null
  grammar_errors: number
  pronunciation_errors: number
  vocabulary_errors: number
  fluency_errors: number
  total_sessions: number
  total_test_sessions: number
  created_at: string
}

export default function ProgressPage() {
  const supabase = createClient()
  const router = useRouter()
  const [data, setData] = useState<ProgressData[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    loadProgressData()
  }, [])

  const loadProgressData = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      // Get user profile to get the internal user_id
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) {
        router.push('/login')
        return
      }

      setUserId(profile.id)

      // Fetch progress data
      const { data: progressData, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', profile.id)
        .order('week_start', { ascending: true })

      if (error) {
        console.error('Error fetching progress:', error)
      } else {
        setData(progressData || [])
      }
    } catch (error) {
      console.error('Failed to load progress data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTrend = (key: keyof ProgressData) => {
    if (data.length < 2) return '—'
    const latest = data[data.length - 1]
    const previous = data[data.length - 2]

    const latestValue = latest[key] as number
    const previousValue = previous[key] as number

    if (latestValue === null || previousValue === null) return '—'

    const diff = latestValue - previousValue
    if (Math.abs(diff) < 0.1) return '→ stable'
    return diff > 0 ? `+${diff.toFixed(1)} ↑` : `${diff.toFixed(1)} ↓`
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    if (score >= 85) return 'text-green-400'
    if (score >= 70) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBgColor = (score: number | null) => {
    if (score === null) return 'bg-gray-500/10 border-gray-500/30'
    if (score >= 85) return 'bg-green-500/10 border-green-500/30'
    if (score >= 70) return 'bg-yellow-500/10 border-yellow-500/30'
    return 'bg-red-500/10 border-red-500/30'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const latestData = data.length > 0 ? data[data.length - 1] : null
  const totalSessions = latestData?.total_sessions || 0
  const totalTestSessions = latestData?.total_test_sessions || 0

  if (loading) {
    return (
      <OrbBG>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">Loading your progress...</div>
        </div>
      </OrbBG>
    )
  }

  return (
    <OrbBG>
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">Your Progress Dashboard</h1>
            <a
              href="/home"
              className="text-white hover:text-blue-300 transition-colors"
            >
              ← Back to Home
            </a>
          </div>

          {data.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-center">
              <p className="text-white text-lg mb-4">No progress data available yet.</p>
              <p className="text-gray-300">
                Complete some accent tests and conversation sessions to start tracking your progress!
              </p>
              <a
                href="/free_conversation"
                className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Start a Session
              </a>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">💬</span>
                    <div>
                      <p className="text-gray-300 text-sm">Conversation Sessions</p>
                      <p className="text-white text-2xl font-bold">{totalSessions}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">🎯</span>
                    <div>
                      <p className="text-gray-300 text-sm">Accent Tests</p>
                      <p className="text-white text-2xl font-bold">{totalTestSessions}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">📈</span>
                    <div>
                      <p className="text-gray-300 text-sm">Weeks Tracked</p>
                      <p className="text-white text-2xl font-bold">{data.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Chart */}
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-white mb-4">Weekly Improvement Trends</h2>
                <div className="bg-white/5 rounded-lg p-4">
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="week_start"
                        tickFormatter={formatDate}
                        stroke="rgba(255,255,255,0.5)"
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="rgba(255,255,255,0.5)"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        labelFormatter={(label) => `Week of ${formatDate(label)}`}
                      />
                      <Legend
                        wrapperStyle={{ color: '#fff' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="grammar_score"
                        stroke="#8884d8"
                        strokeWidth={2}
                        name="Grammar"
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="pronunciation_score"
                        stroke="#82ca9d"
                        strokeWidth={2}
                        name="Pronunciation"
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="vocabulary_score"
                        stroke="#ffc658"
                        strokeWidth={2}
                        name="Vocabulary"
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="fluency_score"
                        stroke="#ff7c7c"
                        strokeWidth={2}
                        name="Fluency"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trends Summary */}
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Recent Trends</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Grammar Card */}
                  <div className={`border rounded-lg p-4 transition-all ${getScoreBgColor(latestData?.grammar_score ?? null)}`}>
                    <p className="text-gray-300 text-sm mb-2 font-medium uppercase tracking-wide">Grammar</p>
                    <p className={`text-4xl font-bold mb-1 ${getScoreColor(latestData?.grammar_score ?? null)}`}>
                      {latestData?.grammar_score?.toFixed(1) ?? '—'}
                    </p>
                    <p className="text-white text-sm font-medium mb-2">
                      {calculateTrend('grammar_score')}
                    </p>
                    {latestData && (
                      <p className="text-gray-400 text-xs">
                        {latestData.grammar_errors} errors this week
                      </p>
                    )}
                  </div>

                  {/* Pronunciation Card */}
                  <div className={`border rounded-lg p-4 transition-all ${getScoreBgColor(latestData?.pronunciation_score ?? null)}`}>
                    <p className="text-gray-300 text-sm mb-2 font-medium uppercase tracking-wide">Pronunciation</p>
                    <p className={`text-4xl font-bold mb-1 ${getScoreColor(latestData?.pronunciation_score ?? null)}`}>
                      {latestData?.pronunciation_score?.toFixed(1) ?? '—'}
                    </p>
                    <p className="text-white text-sm font-medium mb-2">
                      {calculateTrend('pronunciation_score')}
                    </p>
                    {latestData && (
                      <p className="text-gray-400 text-xs">
                        {latestData.pronunciation_errors} errors this week
                      </p>
                    )}
                  </div>

                  {/* Vocabulary Card */}
                  <div className={`border rounded-lg p-4 transition-all ${getScoreBgColor(latestData?.vocabulary_score ?? null)}`}>
                    <p className="text-gray-300 text-sm mb-2 font-medium uppercase tracking-wide">Vocabulary</p>
                    <p className={`text-4xl font-bold mb-1 ${getScoreColor(latestData?.vocabulary_score ?? null)}`}>
                      {latestData?.vocabulary_score?.toFixed(1) ?? '—'}
                    </p>
                    <p className="text-white text-sm font-medium mb-2">
                      {calculateTrend('vocabulary_score')}
                    </p>
                    {latestData && (
                      <p className="text-gray-400 text-xs">
                        {latestData.vocabulary_errors} errors this week
                      </p>
                    )}
                  </div>

                  {/* Fluency Card */}
                  <div className={`border rounded-lg p-4 transition-all ${getScoreBgColor(latestData?.fluency_score ?? null)}`}>
                    <p className="text-gray-300 text-sm mb-2 font-medium uppercase tracking-wide">Fluency</p>
                    <p className={`text-4xl font-bold mb-1 ${getScoreColor(latestData?.fluency_score ?? null)}`}>
                      {latestData?.fluency_score?.toFixed(1) ?? '—'}
                    </p>
                    <p className="text-white text-sm font-medium mb-2">
                      {calculateTrend('fluency_score')}
                    </p>
                    {latestData && (
                      <p className="text-gray-400 text-xs">
                        {latestData.fluency_errors} errors this week
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <p className="text-purple-200 text-sm mb-2">💡 AI Memory at Work</p>
                  <p className="text-white">
                    Your progress is tracked automatically from every conversation and accent test.
                    The AI remembers your patterns and adapts to help you improve faster.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </OrbBG>
  )
}
