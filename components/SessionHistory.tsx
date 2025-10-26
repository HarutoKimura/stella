'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'

type Session = {
  id: string
  started_at: string
  ended_at: string | null
  student_turns: number
  tutor_turns: number
  speaking_ms: number
}

export function SessionHistory() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadSessions()
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

      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', profile.id)
        .order('started_at', { ascending: false })
        .limit(20)

      setSessions(data || [])
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
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

  if (loading) {
    return <div className="text-white text-center py-8">Loading sessions...</div>
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📜</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Sessions Yet</h3>
        <p className="text-gray-400">Start practicing to see your session history here</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white mb-4">Session History</h2>

      {sessions.map((session) => (
        <div
          key={session.id}
          className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-blue-500/30"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-white font-semibold">
              {formatDate(session.started_at)}
            </div>
            <div className={`px-3 py-1 rounded-full text-sm ${
              session.ended_at ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {session.ended_at ? 'Completed' : 'In Progress'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400">{session.student_turns}</div>
              <div className="text-sm text-gray-400">Your Turns</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">{session.tutor_turns}</div>
              <div className="text-sm text-gray-400">Tutor Turns</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">
                {formatDuration(session.speaking_ms)}
              </div>
              <div className="text-sm text-gray-400">Duration</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
