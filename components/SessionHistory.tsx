'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'
import { DbSession } from '@/lib/schema'
import SpotlightCard from './SpotlightCard'

type SessionWithDetails = DbSession & {
  targetsUsed?: string[]
  errorCount?: number
}

export function SessionHistory() {
  const [sessions, setSessions] = useState<SessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) return

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) return

      // Get last 10 sessions
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', profile.id)
        .order('started_at', { ascending: false })
        .limit(10)

      if (sessionsData) {
        // Enrich with summary data
        const enriched = sessionsData.map((s) => ({
          ...s,
          targetsUsed: s.summary?.usedTargets || [],
          errorCount: s.summary?.corrections?.length || 0,
        }))
        setSessions(enriched)
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (startStr: string, endStr: string | null) => {
    if (!endStr) return 'In progress'
    const start = new Date(startStr).getTime()
    const end = new Date(endStr).getTime()
    const durationMs = end - start
    const minutes = Math.floor(durationMs / 60000)
    return `${minutes} min`
  }

  if (loading) {
    return (
      <div className="text-white text-center py-8">
        Loading session history...
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <SpotlightCard className="!p-6" spotlightColor="rgba(59, 130, 246, 0.2)">
        <div className="text-center">
          <p className="text-gray-300 text-lg mb-2">No sessions yet</p>
          <p className="text-gray-400 text-sm">
            Start your first conversation to see your history here!
          </p>
        </div>
      </SpotlightCard>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white mb-4">Session History</h2>

      {sessions.map((session) => {
        const isExpanded = expandedSession === session.id

        return (
          <div
            key={session.id}
            onClick={() => setExpandedSession(isExpanded ? null : session.id)}
            className="cursor-pointer"
          >
            <SpotlightCard
              className="!p-4 hover:border-blue-400 transition-colors"
              spotlightColor="rgba(59, 130, 246, 0.2)"
            >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-white font-semibold">
                    {formatDate(session.started_at)}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {formatDuration(session.started_at, session.ended_at)}
                  </span>
                  {!session.ended_at && (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                      Active
                    </span>
                  )}
                </div>

                <div className="flex gap-4 text-sm text-gray-300">
                  <div>
                    <span className="text-gray-400">Turns:</span>{' '}
                    {session.student_turns + session.tutor_turns}
                  </div>
                  <div>
                    <span className="text-gray-400">Phrases:</span>{' '}
                    {session.targetsUsed?.length || 0}
                  </div>
                  <div>
                    <span className="text-gray-400">Corrections:</span>{' '}
                    {session.errorCount || 0}
                  </div>
                </div>

                {isExpanded && session.summary && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    {session.targetsUsed && session.targetsUsed.length > 0 && (
                      <div className="mb-3">
                        <p className="text-gray-400 text-sm mb-2">Phrases Used:</p>
                        <div className="flex flex-wrap gap-2">
                          {session.targetsUsed.map((phrase, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full"
                            >
                              {phrase}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {session.summary.corrections && session.summary.corrections.length > 0 && (
                      <div>
                        <p className="text-gray-400 text-sm mb-2">Corrections:</p>
                        <div className="space-y-2">
                          {session.summary.corrections.slice(0, 3).map((correction: any, idx: number) => (
                            <div key={idx} className="text-sm">
                              <span className="text-red-400">{correction.example}</span>
                              {' → '}
                              <span className="text-green-400">{correction.correction}</span>
                            </div>
                          ))}
                          {session.summary.corrections.length > 3 && (
                            <p className="text-gray-500 text-xs">
                              +{session.summary.corrections.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="text-gray-400">
                {isExpanded ? '▼' : '▶'}
              </div>
            </div>
            </SpotlightCard>
          </div>
        )
      })}
    </div>
  )
}
