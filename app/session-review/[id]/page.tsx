'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { OrbBG } from '@/components/OrbBG'
import SpotlightCard from '@/components/SpotlightCard'

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

type SessionData = {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  student_turns: number
  tutor_turns: number
  summary: {
    transcript?: TranscriptTurn[]
    corrections?: Correction[]
    usedTargets?: string[]
    missedTargets?: string[]
  }
}

export default function SessionReviewPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const sessionId = params.id as string

  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  const [newPhrase, setNewPhrase] = useState('')
  const [savedPhrases, setSavedPhrases] = useState<string[]>([])

  useEffect(() => {
    loadSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const loadSession = async () => {
    try {
      setLoading(true)

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!profile) {
        setError('User profile not found')
        setLoading(false)
        return
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', profile.id)
        .single()

      if (sessionError || !sessionData) {
        setError('Session not found')
        setLoading(false)
        return
      }

      setSession(sessionData as SessionData)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load session:', err)
      setError('Failed to load session data')
      setLoading(false)
    }
  }

  const handleAddPhrase = async () => {
    if (!newPhrase.trim()) return

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

      await supabase.from('targets').insert({
        user_id: profile.id,
        phrase: newPhrase.trim(),
        status: 'planned',
      })

      setSavedPhrases([...savedPhrases, newPhrase.trim()])
      setNewPhrase('')
    } catch (error) {
      console.error('Failed to save phrase:', error)
    }
  }

  if (loading) {
    return (
      <OrbBG>
        <div className="min-h-screen flex items-center justify-center">
          <SpotlightCard className="!p-8">
            <p className="text-white text-xl">Loading session...</p>
          </SpotlightCard>
        </div>
      </OrbBG>
    )
  }

  if (error || !session) {
    return (
      <OrbBG>
        <div className="min-h-screen flex items-center justify-center">
          <SpotlightCard className="!p-8 !border-red-500/50" spotlightColor="rgba(239, 68, 68, 0.2)">
            <p className="text-red-300 text-xl mb-4">{error || 'Session not found'}</p>
            <button
              onClick={() => router.push('/home')}
              className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              ← Back to Home
            </button>
          </SpotlightCard>
        </div>
      </OrbBG>
    )
  }

  const transcript = session.summary?.transcript || []
  const corrections = session.summary?.corrections || []
  const missedTargets = session.summary?.missedTargets || []

  const sessionDuration = session.started_at && session.ended_at
    ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60)
    : 0

  const totalTurns = session.student_turns + session.tutor_turns
  const speakingPercentage = totalTurns > 0 ? Math.round((session.student_turns / totalTurns) * 100) : 0

  // Get top 3 corrections for "Key Feedback"
  const keyCorrections = corrections.slice(0, 3)

  // Combine missed targets and wishlist
  const allPhrasesToPractice = [...missedTargets]

  return (
    <OrbBG>
      <div className="min-h-screen p-6">
        <div className="max-w-3xl mx-auto">
          {/* Compact Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-white">Session Summary</h1>
              <button
                onClick={() => router.push('/home')}
                className="px-4 py-2 bg-gray-500/20 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-colors text-sm font-semibold"
              >
                ← Home
              </button>
            </div>

            {/* Compact Stats - Only if non-zero */}
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>🗓 {new Date(session.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              {sessionDuration > 0 && <span>⏱ {sessionDuration} min</span>}
              {speakingPercentage > 0 && (
                <span className={speakingPercentage >= 65 ? 'text-green-400' : 'text-yellow-400'}>
                  🗣 Speaking: {speakingPercentage}%
                </span>
              )}
            </div>
          </div>

          {/* Key Feedback Section */}
          {keyCorrections.length > 0 ? (
            <SpotlightCard className="!p-6 mb-6" spotlightColor="rgba(59, 130, 246, 0.2)">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>🔍</span>
                <span>Key Feedback</span>
              </h2>
              <div className="space-y-4">
                {keyCorrections.map((correction, idx) => (
                  <div key={idx} className="border-l-2 border-blue-500 pl-4">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-red-300 text-sm">❌</span>
                      <p className="text-gray-300 text-sm flex-1">"{correction.example}"</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-300 text-sm">✅</span>
                      <p className="text-white text-sm flex-1 font-medium">"{correction.correction}"</p>
                    </div>
                  </div>
                ))}
              </div>
              {corrections.length > 3 && (
                <p className="text-gray-400 text-xs mt-4">
                  + {corrections.length - 3} more corrections in transcript below
                </p>
              )}
            </SpotlightCard>
          ) : (
            <SpotlightCard className="!p-6 mb-6" spotlightColor="rgba(34, 197, 94, 0.2)">
              <div className="text-center">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-green-300 mb-2">Great session!</h2>
                <p className="text-gray-400 text-sm">
                  {transcript.length > 0
                    ? "Nice effort! Keep practicing to build fluency."
                    : "Every conversation is a step forward. Keep it up!"}
                </p>
              </div>
            </SpotlightCard>
          )}

          {/* Phrases to Try Next Time */}
          <SpotlightCard className="!p-6 mb-6" spotlightColor="rgba(168, 85, 247, 0.2)">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>💬</span>
              <span>Phrases to Try Next Time</span>
            </h2>

            {/* Missed Targets */}
            {allPhrasesToPractice.length > 0 && (
              <div className="mb-6">
                <p className="text-gray-400 text-sm mb-3">
                  These phrases were planned for practice but didn't come up naturally:
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {allPhrasesToPractice.map((phrase, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm"
                    >
                      "{phrase}"
                    </div>
                  ))}
                </div>
                <button
                  className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg text-sm hover:bg-purple-500/30 transition-colors w-full"
                  onClick={() => router.push('/free_conversation')}
                >
                  ✓ Practice these in next session
                </button>
              </div>
            )}

            {/* Add New Phrase */}
            <div className="border-t border-purple-500/20 pt-6">
              <p className="text-gray-300 text-sm mb-3 font-medium">
                💭 Wished you'd said something else?
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPhrase()}
                  placeholder='e.g., "Could you elaborate on that?"'
                  className="flex-1 px-4 py-3 bg-gray-800 text-white border border-purple-500/30 rounded-lg focus:outline-none focus:border-purple-500/60 transition-colors placeholder-gray-500"
                />
                <button
                  onClick={handleAddPhrase}
                  disabled={!newPhrase.trim()}
                  className="px-6 py-3 bg-purple-500/30 text-purple-300 border border-purple-500/50 rounded-lg font-semibold hover:bg-purple-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add
                </button>
              </div>

              {savedPhrases.length > 0 && (
                <div className="mt-4 space-y-1">
                  {savedPhrases.map((phrase, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-green-300">
                      <span>✓</span>
                      <span>"{phrase}" added to next session</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SpotlightCard>

          {/* Collapsible Transcript */}
          {transcript.length > 0 && (
            <SpotlightCard className="!p-6 mb-6">
              <button
                onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
              >
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📖</span>
                  <span>Full Transcript</span>
                  <span className="text-gray-400 text-sm font-normal">({transcript.length} turns)</span>
                </h2>
                <span className="text-gray-400 text-sm">
                  {transcriptExpanded ? '▲ Hide' : '▼ Show'}
                </span>
              </button>

              {transcriptExpanded && (
                <div className="mt-6 space-y-3 max-h-96 overflow-y-auto">
                  {transcript.map((turn, idx) => (
                    <div key={idx} className={`p-3 rounded-lg ${
                      turn.role === 'user'
                        ? 'bg-blue-500/10 border border-blue-500/20'
                        : 'bg-gray-700/30 border border-gray-600/20'
                    }`}>
                      <div className="text-xs text-gray-400 mb-1 uppercase font-semibold">
                        {turn.role === 'user' ? '👤 You' : '🤖 AI Tutor'}
                      </div>
                      <p className="text-white text-sm">{turn.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </SpotlightCard>
          )}

          {/* Continue Button */}
          <div className="text-center">
            <button
              onClick={() => router.push('/free_conversation')}
              className="px-8 py-4 bg-blue-500/30 text-blue-300 border border-blue-500/50 rounded-lg font-bold text-lg hover:bg-blue-500/40 transition-colors"
            >
              Continue from here →
            </button>
            <p className="text-gray-500 text-xs mt-3">
              💡 Small steps count. Keep practicing to build confidence!
            </p>
          </div>
        </div>
      </div>
    </OrbBG>
  )
}
