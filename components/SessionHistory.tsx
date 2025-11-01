'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'
import SpotlightCard from '@/components/SpotlightCard'
import { useRouter } from 'next/navigation'

type Session = {
  id: string
  started_at: string
  ended_at: string | null
  student_turns: number
  tutor_turns: number
  speaking_ms: number
  summary: {
    corrections?: any[]
    usedTargets?: string[]
  }
}

export function SessionHistory() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSessions = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) return

      // Load all completed sessions (only those with ended_at)
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', profile.id)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })

      setSessions(data || [])
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <SpotlightCard className="!p-8">
        <p className="text-gray-400 text-center">Loading your sessions...</p>
      </SpotlightCard>
    )
  }

  if (sessions.length === 0) {
    return (
      <SpotlightCard className="!p-8">
        <div className="text-center">
          <div className="text-5xl mb-4">🎯</div>
          <p className="text-gray-400 text-lg mb-2">No sessions yet</p>
          <p className="text-gray-500 text-sm">
            Start your first practice session to see your progress here!
          </p>
        </div>
      </SpotlightCard>
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const date = new Date(session.started_at)
        const duration = session.ended_at
          ? Math.round((new Date(session.ended_at).getTime() - date.getTime()) / 1000 / 60)
          : 0
        const corrections = session.summary?.corrections?.length || 0
        const usedTargets = session.summary?.usedTargets?.length || 0

        return (
          <SpotlightCard
            key={session.id}
            className="!p-4 cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={() => router.push(`/session-review/${session.id}`)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl">📝</div>
                <div>
                  <h3 className="text-white font-semibold">
                    {date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {date.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} • {duration} min
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-white font-bold">{session.student_turns + session.tutor_turns}</p>
                  <p className="text-gray-400 text-xs">Turns</p>
                </div>
                <div className="text-center">
                  <p className="text-green-400 font-bold">{usedTargets}</p>
                  <p className="text-gray-400 text-xs">Phrases</p>
                </div>
                <div className="text-center">
                  <p className={`font-bold ${corrections > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {corrections}
                  </p>
                  <p className="text-gray-400 text-xs">Errors</p>
                </div>
                <div className="text-blue-400 text-xl">→</div>
              </div>
            </div>
          </SpotlightCard>
        )
      })}
    </div>
  )
}
