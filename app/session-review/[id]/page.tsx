'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { OrbBG } from '@/components/OrbBG'
import SpotlightCard from '@/components/SpotlightCard'
import { TranscriptReview } from '@/components/SessionReview/TranscriptReview'
import { CorrectionComparison } from '@/components/SessionReview/CorrectionComparison'
import { PhraseWishlist } from '@/components/SessionReview/PhraseWishlist'
import { exportSessionToPDF } from '@/lib/exportPDF'

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
  const [activeTab, setActiveTab] = useState<'transcript' | 'corrections'>('transcript')

  useEffect(() => {
    loadSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const loadSession = async () => {
    try {
      setLoading(true)

      // Get authenticated user
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      // Get user profile
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

      // Load session data
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

  const handleDownloadPDF = () => {
    if (!session) return

    exportSessionToPDF({
      sessionId: session.id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      studentTurns: session.student_turns,
      tutorTurns: session.tutor_turns,
      transcript: session.summary?.transcript || [],
      corrections: session.summary?.corrections || [],
      usedTargets: session.summary?.usedTargets || [],
      missedTargets: session.summary?.missedTargets || [],
    })
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
            <p className="text-red-300 text-xl">{error || 'Session not found'}</p>
            <button
              onClick={() => router.push('/home')}
              className="mt-4 px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
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
  const usedTargets = session.summary?.usedTargets || []
  const missedTargets = session.summary?.missedTargets || []

  const sessionDuration = session.started_at && session.ended_at
    ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000 / 60)
    : 0

  return (
    <OrbBG>
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Session Review</h1>
              <p className="text-gray-400 text-sm">
                {new Date(session.started_at).toLocaleDateString()} at{' '}
                {new Date(session.started_at).toLocaleTimeString()} • {sessionDuration} minutes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm font-semibold"
              >
                📄 Download PDF
              </button>
              <button
                onClick={() => router.push('/home')}
                className="px-4 py-2 bg-gray-500/20 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-colors text-sm font-semibold"
              >
                ← Home
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <SpotlightCard className="!p-4">
              <p className="text-gray-400 text-xs mb-1">Your Turns</p>
              <p className="text-white text-2xl font-bold">{session.student_turns || 0}</p>
            </SpotlightCard>
            <SpotlightCard className="!p-4">
              <p className="text-gray-400 text-xs mb-1">Tutor Turns</p>
              <p className="text-white text-2xl font-bold">{session.tutor_turns || 0}</p>
            </SpotlightCard>
            <SpotlightCard className="!p-4" spotlightColor="rgba(34, 197, 94, 0.3)">
              <p className="text-gray-400 text-xs mb-1">Phrases Used</p>
              <p className="text-green-300 text-2xl font-bold">{usedTargets.length}</p>
            </SpotlightCard>
            <SpotlightCard className="!p-4" spotlightColor="rgba(239, 68, 68, 0.3)">
              <p className="text-gray-400 text-xs mb-1">Corrections</p>
              <p className="text-red-300 text-2xl font-bold">{corrections.length}</p>
            </SpotlightCard>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('transcript')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'transcript'
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/30 hover:bg-gray-500/20'
              }`}
            >
              📝 Transcript ({transcript.length} turns)
            </button>
            <button
              onClick={() => setActiveTab('corrections')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'corrections'
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                  : 'bg-gray-500/10 text-gray-400 border border-gray-500/30 hover:bg-gray-500/20'
              }`}
            >
              ✏️ Corrections ({corrections.length})
            </button>
          </div>

          {/* Content */}
          {activeTab === 'transcript' ? (
            <div className="space-y-6">
              <TranscriptReview transcript={transcript} corrections={corrections} />
              <PhraseWishlist sessionId={sessionId} usedTargets={usedTargets} missedTargets={missedTargets} />
            </div>
          ) : (
            <CorrectionComparison corrections={corrections} />
          )}
        </div>
      </div>
    </OrbBG>
  )
}
