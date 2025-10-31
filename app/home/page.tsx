'use client'

import { OrbBG } from '@/components/OrbBG'
import { IntentCaption } from '@/components/IntentCaption'
import { useSessionStore } from '@/lib/sessionStore'
import { createClient } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SpotlightCard from '@/components/SpotlightCard'

type RecentSession = {
  id: string
  started_at: string
  ended_at: string | null
  student_turns: number
  tutor_turns: number
  summary: {
    corrections?: any[]
    usedTargets?: string[]
  }
}

export default function HomePage() {
  const setUser = useSessionStore((state) => state.setUser)
  const router = useRouter()
  const supabase = createClient()
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  useEffect(() => {
    loadUser()
    loadRecentSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadUser = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('id, display_name, cefr_level')
      .eq('auth_user_id', authUser.id)
      .single()

    if (profile) {
      setUser({
        id: profile.id,
        displayName: profile.display_name,
        cefr: profile.cefr_level,
      })
    }
  }

  const loadRecentSessions = async () => {
    try {
      setLoadingSessions(true)

      // Get authenticated user
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) return

      // Get user profile
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) return

      // Load recent sessions (last 5, only completed ones)
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', profile.id)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(5)

      setRecentSessions(sessions || [])
      setLoadingSessions(false)
    } catch (error) {
      console.error('Failed to load sessions:', error)
      setLoadingSessions(false)
    }
  }

  return (
    <OrbBG>
      <IntentCaption />
      <div className="min-h-screen flex flex-col items-center justify-center p-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            Ready to practice?
          </h1>
          <p className="text-xl text-gray-300">
            Choose an option to get started
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full mb-16">
          <a
            href="/free_conversation"
            className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <div className="text-4xl mb-3">💬</div>
            <h3 className="text-white text-xl font-bold mb-2">Start Session</h3>
            <p className="text-gray-300 text-sm">
              Begin practicing with your AI tutor
            </p>
          </a>

          <a
            href="/user_profile"
            className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-white text-xl font-bold mb-2">My Progress</h3>
            <p className="text-gray-300 text-sm">
              View your learning statistics
            </p>
          </a>
        </div>

        {/* Recent Sessions Section */}
        <div className="w-full max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">📚 Recent Sessions</h2>
            {recentSessions.length > 0 && (
              <a
                href="/user_profile"
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                View all →
              </a>
            )}
          </div>

          {loadingSessions ? (
            <SpotlightCard className="!p-8">
              <p className="text-gray-400 text-center">Loading your sessions...</p>
            </SpotlightCard>
          ) : recentSessions.length === 0 ? (
            <SpotlightCard className="!p-8">
              <div className="text-center">
                <div className="text-5xl mb-4">🎯</div>
                <p className="text-gray-400 text-lg mb-2">No sessions yet</p>
                <p className="text-gray-500 text-sm">
                  Start your first practice session to see your progress here!
                </p>
              </div>
            </SpotlightCard>
          ) : (
            <div className="space-y-3">
              {recentSessions.map((session) => {
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
          )}
        </div>
      </div>
    </OrbBG>
  )
}
