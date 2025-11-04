'use client'

import { OrbBG } from '@/components/OrbBG'
import { NextSteps } from '@/components/NextSteps'
import { CoachSession } from '@/components/CoachSession'
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

type InsightData = {
  insight: string
  week_start: string
  cached: boolean
  scores?: {
    grammar: number
    pronunciation: number
    vocabulary: number
    fluency: number
  }
  deltas?: {
    grammar: number
    pronunciation: number
    vocabulary: number
    fluency: number
  }
}

type HistoricalInsight = {
  week_start: string
  insight_text: string
  created_at: string
}

// Helper function to determine focus areas from scores
function getFocusAreasFromScores(scores: {
  grammar: number
  pronunciation: number
  vocabulary: number
  fluency: number
}): string[] {
  // Find the two lowest scores to use as focus areas
  const scoreEntries = Object.entries(scores).map(([key, value]) => ({
    area: key.charAt(0).toUpperCase() + key.slice(1),
    score: value,
  }))

  scoreEntries.sort((a, b) => a.score - b.score)

  // Return the two lowest scoring areas
  return scoreEntries.slice(0, 2).map(entry => entry.area)
}

export default function ProgressPage() {
  const supabase = createClient()
  const router = useRouter()
  const [data, setData] = useState<ProgressData[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userLevel, setUserLevel] = useState<string>('B1')
  const [insight, setInsight] = useState<InsightData | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historicalInsights, setHistoricalInsights] = useState<HistoricalInsight[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    loadProgressData()
    loadInsights()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Get user profile to get the internal user_id and CEFR level
      const { data: profile } = await supabase
        .from('users')
        .select('id, cefr_level')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) {
        router.push('/login')
        return
      }

      setUserId(profile.id)
      setUserLevel(profile.cefr_level || 'B1')

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

  const loadInsights = async () => {
    setInsightLoading(true)
    try {
      const response = await fetch('/api/insights')
      if (response.ok) {
        const data = await response.json()
        setInsight(data)
      } else {
        console.error('Failed to load insights:', await response.text())
      }
    } catch (error) {
      console.error('Error loading insights:', error)
    } finally {
      setInsightLoading(false)
    }
  }

  const loadHistoricalInsights = async () => {
    if (historicalInsights.length > 0) return // Already loaded

    setHistoryLoading(true)
    try {
      const response = await fetch('/api/insights?history=true')
      if (response.ok) {
        const data = await response.json()
        setHistoricalInsights(data.history || [])
      } else {
        console.error('Failed to load historical insights:', await response.text())
      }
    } catch (error) {
      console.error('Error loading historical insights:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (showHistory && historicalInsights.length === 0) {
      loadHistoricalInsights()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory])

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

              {/* AI Insights Section */}
              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-md rounded-lg p-6 mt-6 border border-indigo-400/30">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">🧠</span>
                  <h2 className="text-xl font-semibold text-white">AI Insights</h2>
                  {insight?.cached && (
                    <span className="text-xs text-indigo-300 bg-indigo-500/20 px-2 py-1 rounded">
                      This week
                    </span>
                  )}
                </div>

                {insightLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <p className="text-gray-300 text-sm">Generating your personalized insight...</p>
                  </div>
                ) : insight ? (
                  <div className="space-y-3">
                    <p className="text-white text-base leading-relaxed">
                      {insight.insight}
                    </p>
                    {insight.scores && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>📊</span>
                        <span>
                          Based on your latest performance across {Object.keys(insight.scores).length} skill areas
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">
                    Complete an accent test to receive personalized AI coaching insights.
                  </p>
                )}

                {!insightLoading && data.length > 0 && (
                  <div className="flex items-center gap-4 mt-4">
                    <button
                      onClick={loadInsights}
                      className="text-sm text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate insight
                    </button>

                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="text-sm text-purple-300 hover:text-purple-200 transition-colors underline"
                    >
                      {showHistory ? 'Hide Past Insights' : 'View Past Insights'}
                    </button>
                  </div>
                )}

                {/* Historical Insights Timeline */}
                {showHistory && (
                  <div className="mt-6 border-t border-indigo-800/40 pt-4">
                    <h3 className="text-sm font-medium text-indigo-300 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Past Insights
                    </h3>

                    {historyLoading ? (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-400"></div>
                        <span>Loading history...</span>
                      </div>
                    ) : historicalInsights.length > 0 ? (
                      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {historicalInsights.map((historical, index) => (
                          <div
                            key={historical.week_start}
                            className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-indigo-400">
                                Week of {new Date(historical.week_start).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              {index === 0 && (
                                <span className="text-xs text-gray-500">(Most Recent)</span>
                              )}
                            </div>
                            <p className="text-gray-300 text-sm leading-relaxed">
                              {historical.insight_text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">
                        No historical insights yet. Keep practicing and insights will accumulate over time!
                      </p>
                    )}
                  </div>
                )}

                {/* Next Steps Section */}
                <NextSteps
                  insightText={insight?.insight}
                  weekStart={insight?.week_start}
                />

                {/* AI Coach Session */}
                {insight && (
                  <CoachSession
                    focusAreas={
                      insight.scores
                        ? getFocusAreasFromScores(insight.scores)
                        : ['Grammar', 'Pronunciation'] // Default focus areas when scores not available
                    }
                    level={userLevel}
                    insightText={insight?.insight}
                    theme="Weekly Progress Practice"
                  />
                )}

                {/* Fallback if no insight */}
                {!insight && data.length > 0 && (
                  <div className="mt-6 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                    <p className="text-orange-200 text-sm">
                      ⚠️ No insights available yet. Complete an accent test to generate insights and unlock AI Practice Sessions!
                    </p>
                    <a
                      href="/accent-test"
                      className="inline-block mt-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      Take Accent Test
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </OrbBG>
  )
}
