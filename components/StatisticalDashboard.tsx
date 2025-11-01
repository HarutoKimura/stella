'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import SpotlightCard from '@/components/SpotlightCard'
import { DbProgressMetric, DbWeeklyProgress, DbCefrTrajectory } from '@/lib/schema'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface DashboardStats {
  currentEGI: number
  cefrLevel: string
  cefrConfidence: number
  weeklyProgress: DbWeeklyProgress | null
  recentMetrics: DbProgressMetric[]
  cefrTrajectory: DbCefrTrajectory[]
}

type Correction = {
  type: 'grammar' | 'vocab' | 'pron'
  example: string
  correction: string
  error_type?: string
  severity?: string
  reason?: string
  issue_type?: string
}

export function StatisticalDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showGrammarErrors, setShowGrammarErrors] = useState(false)
  const [showVocabErrors, setShowVocabErrors] = useState(false)
  const [latestCorrections, setLatestCorrections] = useState<Correction[]>([])
  const supabase = createClient()

  useEffect(() => {
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadStats = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) return

      // Get latest progress metrics (last 10 sessions)
      const { data: metrics } = await supabase
        .from('progress_metrics')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10)

      // Get current week's progress
      const weekStart = getWeekStartDate(new Date())
      const { data: weekly } = await supabase
        .from('weekly_progress')
        .select('*')
        .eq('user_id', profile.id)
        .eq('week_start_date', weekStart)
        .single()

      // Get CEFR trajectory (last 5 estimations)
      const { data: trajectory } = await supabase
        .from('cefr_trajectory')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5)

      // Get latest session's corrections (for error details)
      const { data: latestSession } = await supabase
        .from('sessions')
        .select('summary')
        .eq('user_id', profile.id)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(1)
        .single()

      const corrections: Correction[] = latestSession?.summary?.corrections || []
      setLatestCorrections(corrections)

      // Calculate current EGI (average of last 3 sessions)
      const recentEGI = metrics?.slice(0, 3).map(m => m.egi_score) || []
      const currentEGI = recentEGI.length > 0
        ? Math.round(recentEGI.reduce((a, b) => a + b, 0) / recentEGI.length)
        : 0

      // Get latest CEFR estimation
      const latestCefr = trajectory?.[0]

      setStats({
        currentEGI,
        cefrLevel: latestCefr?.estimated_cefr || 'B1',
        cefrConfidence: latestCefr?.confidence_level || 0,
        weeklyProgress: weekly || null,
        recentMetrics: metrics || [],
        cefrTrajectory: trajectory || [],
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <SpotlightCard className="!p-8">
        <p className="text-gray-400 text-center">Loading your statistics...</p>
      </SpotlightCard>
    )
  }

  if (!stats || stats.recentMetrics.length === 0) {
    return (
      <SpotlightCard className="!p-8">
        <div className="text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-gray-400 text-lg mb-2">No statistics yet</p>
          <p className="text-gray-500 text-sm">
            Complete a practice session to see your detailed progress metrics!
          </p>
        </div>
      </SpotlightCard>
    )
  }

  const latestMetric = stats.recentMetrics[0]

  return (
    <div className="space-y-6">
      {/* EGI Score - Main Highlight */}
      <SpotlightCard className="!p-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20">
        <div className="text-center">
          <h2 className="text-gray-300 text-sm uppercase tracking-wider mb-2">
            English Growth Index (EGI)
          </h2>
          <div className="text-7xl font-bold text-white mb-2">
            {stats.currentEGI}
          </div>
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-gray-400">CEFR:</span>
              <span className="text-white font-semibold">{stats.cefrLevel}</span>
              <span className="text-gray-500">
                ({Math.round(stats.cefrConfidence * 100)}% confidence)
              </span>
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-3">
            Composite score: Fluency (30%) • Grammar (25%) • Vocabulary (20%) • Comprehension (15%) • Confidence (10%)
          </p>
        </div>
      </SpotlightCard>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <ScoreCard
          icon="🚀"
          label="Fluency"
          score={latestMetric.fluency_score}
          color="blue"
          details={`${stats.recentMetrics[0]?.total_words || 0} words • ${Math.round(stats.recentMetrics[0]?.lexical_diversity * 100 || 0)}% diversity`}
        />
        <ScoreCard
          icon="✅"
          label="Grammar"
          score={latestMetric.grammar_score}
          color="green"
          details={`${latestMetric.grammar_errors} error${latestMetric.grammar_errors !== 1 ? 's' : ''}`}
          onClick={() => setShowGrammarErrors(!showGrammarErrors)}
          clickable={latestCorrections.filter(c => c.type === 'grammar').length > 0}
        />
        <ScoreCard
          icon="📚"
          label="Vocabulary"
          score={latestMetric.vocabulary_score}
          color="purple"
          details={`${latestMetric.unique_words} unique words`}
          onClick={() => setShowVocabErrors(!showVocabErrors)}
          clickable={latestCorrections.filter(c => c.type === 'vocab').length > 0}
        />
        <ScoreCard
          icon="🧠"
          label="Comprehension"
          score={latestMetric.comprehension_score}
          color="cyan"
          details="Target usage"
        />
        <ScoreCard
          icon="💪"
          label="Confidence"
          score={latestMetric.confidence_score}
          color="yellow"
          details={`${Math.round(latestMetric.response_time_avg_ms / 1000)}s avg response`}
        />
        <ScoreCard
          icon="🎯"
          label="Overall"
          score={latestMetric.egi_score}
          color="pink"
          details="English Growth Index"
        />
      </div>

      {/* Grammar Errors Details (expandable) */}
      {showGrammarErrors && latestCorrections.filter(c => c.type === 'grammar').length > 0 && (
        <SpotlightCard className="!p-6" spotlightColor="rgba(239, 68, 68, 0.2)">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📝</span>
              <span>Your Grammar Mistakes</span>
              <span className="text-sm text-gray-400 font-normal">
                (from latest session)
              </span>
            </h3>
            <button
              onClick={() => setShowGrammarErrors(false)}
              className="text-gray-400 hover:text-white text-sm"
            >
              ✕ Close
            </button>
          </div>
          <div className="space-y-4">
            {latestCorrections.filter(c => c.type === 'grammar').map((error, idx) => (
              <div key={idx} className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-red-400 text-lg flex-shrink-0">❌</span>
                  <div className="flex-1">
                    <p className="text-red-200 text-sm mb-1 font-medium">You said:</p>
                    <p className="text-white">&ldquo;{error.example}&rdquo;</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-green-400 text-lg flex-shrink-0">✅</span>
                  <div className="flex-1">
                    <p className="text-green-200 text-sm mb-1 font-medium">Correct:</p>
                    <p className="text-white font-semibold">&ldquo;{error.correction}&rdquo;</p>
                  </div>
                </div>
                {error.error_type && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded">
                      {error.error_type}
                    </span>
                    {error.severity && (
                      <span className={`px-2 py-1 rounded ${
                        error.severity === 'major'
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {error.severity}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SpotlightCard>
      )}

      {/* Vocabulary Issues Details (expandable) */}
      {showVocabErrors && latestCorrections.filter(c => c.type === 'vocab').length > 0 && (
        <SpotlightCard className="!p-6" spotlightColor="rgba(168, 85, 247, 0.2)">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📚</span>
              <span>Your Vocabulary Suggestions</span>
              <span className="text-sm text-gray-400 font-normal">
                (from latest session)
              </span>
            </h3>
            <button
              onClick={() => setShowVocabErrors(false)}
              className="text-gray-400 hover:text-white text-sm"
            >
              ✕ Close
            </button>
          </div>
          <div className="space-y-4">
            {latestCorrections.filter(c => c.type === 'vocab').map((issue, idx) => (
              <div key={idx} className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-purple-400 text-lg flex-shrink-0">💬</span>
                  <div className="flex-1">
                    <p className="text-purple-200 text-sm mb-1 font-medium">You said:</p>
                    <p className="text-white">&ldquo;{issue.example}&rdquo;</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-cyan-400 text-lg flex-shrink-0">✨</span>
                  <div className="flex-1">
                    <p className="text-cyan-200 text-sm mb-1 font-medium">Try this instead:</p>
                    <p className="text-white font-semibold">&ldquo;{issue.correction}&rdquo;</p>
                  </div>
                </div>
                {issue.reason && (
                  <div className="bg-cyan-500/10 border border-cyan-500/20 rounded p-2 text-sm text-cyan-200">
                    💡 {issue.reason}
                  </div>
                )}
                {issue.issue_type && (
                  <div className="mt-2">
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
                      {issue.issue_type}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SpotlightCard>
      )}

      {/* This Week's Progress */}
      {stats.weeklyProgress && (
        <SpotlightCard className="!p-6">
          <h3 className="text-xl font-bold text-white mb-4">📅 This Week</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatItem
              label="Sessions"
              value={stats.weeklyProgress.total_sessions}
              color="blue"
            />
            <StatItem
              label="Minutes"
              value={stats.weeklyProgress.total_minutes}
              color="green"
            />
            <StatItem
              label="Phrases Mastered"
              value={stats.weeklyProgress.phrases_mastered}
              color="purple"
            />
            <StatItem
              label="Avg EGI"
              value={Math.round(stats.weeklyProgress.avg_egi_score)}
              color="cyan"
            />
          </div>
        </SpotlightCard>
      )}

      {/* CEFR Distribution */}
      <SpotlightCard className="!p-6">
        <h3 className="text-xl font-bold text-white mb-4">📖 Vocabulary Level Distribution</h3>
        <CEFRDistributionChart distribution={latestMetric.cefr_distribution} />
      </SpotlightCard>

      {/* Error Breakdown */}
      <SpotlightCard className="!p-6">
        <h3 className="text-xl font-bold text-white mb-4">🔍 Error Analysis</h3>
        <div className="grid grid-cols-3 gap-4">
          <ErrorCard
            type="Grammar"
            count={latestMetric.grammar_errors}
            icon="📝"
            color="red"
          />
          <ErrorCard
            type="Vocabulary"
            count={latestMetric.vocab_errors}
            icon="📚"
            color="orange"
          />
          <ErrorCard
            type="Pronunciation"
            count={latestMetric.pronunciation_errors}
            icon="🗣️"
            color="yellow"
          />
        </div>
      </SpotlightCard>

      {/* Progress Trend - Multi-line Chart */}
      <SpotlightCard className="!p-6">
        <h3 className="text-xl font-bold text-white mb-4">📈 Skill Progression Over Time</h3>
        <MultiLineProgressChart metrics={stats.recentMetrics.slice(0, 10).reverse()} />
      </SpotlightCard>
    </div>
  )
}

// Helper Components

function ScoreCard({
  icon,
  label,
  score,
  color,
  details,
  onClick,
  clickable,
}: {
  icon: string
  label: string
  score: number
  color: string
  details?: string
  onClick?: () => void
  clickable?: boolean
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    cyan: 'from-cyan-500 to-cyan-600',
    yellow: 'from-yellow-500 to-yellow-600',
    pink: 'from-pink-500 to-pink-600',
  }

  return (
    <SpotlightCard
      className={`!p-4 ${clickable ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className="text-center">
        <div className="text-3xl mb-2">{icon}</div>
        <div className="text-sm text-gray-400 mb-1">{label}</div>
        <div className={`text-3xl font-bold bg-gradient-to-r ${colorMap[color]} bg-clip-text text-transparent`}>
          {score}
        </div>
        {details && <div className="text-xs text-gray-500 mt-1">{details}</div>}
        {clickable && (
          <div className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
            <span>👁️</span>
            <span>View details</span>
          </div>
        )}
      </div>
    </SpotlightCard>
  )
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
  }

  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  )
}

function ErrorCard({
  type,
  count,
  icon,
  color,
}: {
  type: string
  count: number
  icon: string
  color: string
}) {
  const colorMap: Record<string, string> = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
  }

  return (
    <div className="bg-white/5 rounded-lg p-4 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <div className={`text-2xl font-bold ${colorMap[color]}`}>{count}</div>
      <div className="text-sm text-gray-400 mt-1">{type}</div>
    </div>
  )
}

function CEFRDistributionChart({ distribution }: { distribution: Record<string, number> }) {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const total = Object.values(distribution).reduce((a, b) => a + b, 0)

  if (total === 0) {
    return <p className="text-gray-400 text-center">No vocabulary data yet</p>
  }

  return (
    <div className="space-y-3">
      {levels.map(level => {
        const count = distribution[level] || 0
        const percentage = total > 0 ? (count / total) * 100 : 0

        return (
          <div key={level}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-semibold">{level}</span>
              <span className="text-gray-400 text-sm">
                {count} words ({Math.round(percentage)}%)
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MultiLineProgressChart({ metrics }: { metrics: DbProgressMetric[] }) {
  if (metrics.length === 0) {
    return <p className="text-gray-400 text-center">Complete more sessions to see trends</p>
  }

  // Prepare data for recharts
  const chartData = metrics.map((metric, index) => ({
    session: `#${index + 1}`,
    fluency: metric.fluency_score,
    grammar: metric.grammar_score,
    vocabulary: metric.vocabulary_score,
    comprehension: metric.comprehension_score,
    confidence: metric.confidence_score,
  }))

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="session"
            stroke="#888"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#888"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a2e',
              border: '1px solid #444',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="fluency"
            name="🚀 Fluency"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="grammar"
            name="✅ Grammar"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="vocabulary"
            name="📚 Vocabulary"
            stroke="#a855f7"
            strokeWidth={2}
            dot={{ fill: '#a855f7', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="comprehension"
            name="🧠 Comprehension"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={{ fill: '#06b6d4', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="confidence"
            name="💪 Confidence"
            stroke="#eab308"
            strokeWidth={2}
            dot={{ fill: '#eab308', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-gray-500 text-xs text-center mt-2">
        Track your progress across all skill areas • Latest {metrics.length} sessions
      </p>
    </div>
  )
}

function getWeekStartDate(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}
