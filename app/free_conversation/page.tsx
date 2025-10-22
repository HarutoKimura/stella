'use client'

import { OrbBG } from '@/components/OrbBG'
import { IntentCaption } from '@/components/IntentCaption'
import { BubbleContainer } from '@/components/BubbleContainer'
import Orb from '@/components/Orb'
import SpotlightCard from '@/components/SpotlightCard'
import { useSessionStore } from '@/lib/sessionStore'
import { useBubbleStore } from '@/lib/bubbleStore'
import { useRealtime } from '@/lib/useRealtime'
import { parseTextIntent, executeIntent } from '@/lib/intentRouter'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'

export default function FreeConversationPage() {
  const [input, setInput] = useState('')
  const sessionId = useSessionStore((state) => state.sessionId)
  const user = useSessionStore((state) => state.user)
  const startSession = useSessionStore((state) => state.startSession)
  const setUser = useSessionStore((state) => state.setUser)
  const addUserMessage = useBubbleStore((state) => state.addUserMessage)
  const showTutorTranscript = useBubbleStore((state) => state.showTutorTranscript)
  const toggleTutorTranscript = useBubbleStore((state) => state.toggleTutorTranscript)
  const router = useRouter()
  const supabase = createClient()

  // Realtime connection
  const { status, error, micActive, isTutorSpeaking, start, sendText, stop } = useRealtime()

  useEffect(() => {
    // Prevent double initialization in React strict mode
    let initialized = false

    const init = async () => {
      if (initialized) return
      initialized = true
      await initSession()
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const initSession = async () => {
    // Load user
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

    if (!profile) {
      router.push('/login')
      return
    }

    setUser({
      id: profile.id,
      displayName: profile.display_name,
      cefr: profile.cefr_level,
    })

    // If no active session, start one
    if (!sessionId) {
      await startNewSession(profile.id, profile.cefr_level)
    }
  }

  const startNewSession = async (userId: string, cefr: string) => {
    try {
      // Get micro-pack from planner
      const plannerRes = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cefr }),
      })

      const microPack = await plannerRes.json()

      // Create session in DB
      const { data: session } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
        })
        .select()
        .single()

      if (!session) throw new Error('Failed to create session')

      // Insert targets
      for (const target of microPack.targets) {
        await supabase.from('targets').insert({
          user_id: userId,
          phrase: target.phrase,
          cefr: target.cefr,
          status: 'planned',
        })
      }

      // Update store
      startSession(
        session.id,
        microPack.targets.map((t: any) => t.phrase)
      )

      // Start realtime connection
      await start({
        userId,
        sessionId: session.id,
      })
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    try {
      const message = input.trim()

      // Check if command
      const intent = parseTextIntent(message)
      if (intent.type !== 'unknown') {
        if (intent.type === 'stop') {
          stop()
        }
        await executeIntent(intent)
        setInput('')
        return
      }

      // Add user message as bubble
      addUserMessage(message)

      // Send via realtime (text message through data channel)
      await sendText(message)
      setInput('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  return (
    <OrbBG>
      <IntentCaption />
      <BubbleContainer />
      <div className="min-h-screen p-6 pb-40">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-white">Free Conversation</h1>
              {/* Connection status indicator */}
              <SpotlightCard className="!p-2 !rounded-lg" spotlightColor="rgba(59, 130, 246, 0.3)">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      status === 'connected'
                        ? 'bg-green-400 animate-pulse'
                        : status === 'connecting'
                        ? 'bg-yellow-400 animate-pulse'
                        : status === 'error'
                        ? 'bg-red-400'
                        : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-xs text-gray-300">
                    {status === 'connected' && micActive ? '🎤 Voice + Text' : status}
                  </span>
                </div>
              </SpotlightCard>

              {/* Session control buttons */}
              <div className="flex items-center gap-2">
                {status === 'idle' || status === 'disconnected' || status === 'error' ? (
                  <SpotlightCard className="!p-0 !rounded-lg" spotlightColor="rgba(34, 197, 94, 0.3)">
                    <button
                      onClick={() => user?.id && startNewSession(user.id, user.cefr)}
                      className="text-green-400 font-semibold px-3 py-1.5 text-xs w-full h-full"
                    >
                      ▶️ Start
                    </button>
                  </SpotlightCard>
                ) : null}
                {status === 'connected' || status === 'connecting' ? (
                  <SpotlightCard className="!p-0 !rounded-lg" spotlightColor="rgba(239, 68, 68, 0.3)">
                    <button
                      onClick={stop}
                      className="text-red-400 font-semibold px-3 py-1.5 text-xs w-full h-full"
                    >
                      ⏹️ Stop
                    </button>
                  </SpotlightCard>
                ) : null}
                {/* Toggle tutor transcript visibility */}
                <SpotlightCard
                  className="!p-0 !rounded-lg"
                  spotlightColor={showTutorTranscript ? "rgba(59, 130, 246, 0.3)" : "rgba(156, 163, 175, 0.3)"}
                >
                  <button
                    onClick={toggleTutorTranscript}
                    className={`${
                      showTutorTranscript
                        ? 'text-blue-400'
                        : 'text-gray-400'
                    } font-semibold px-3 py-1.5 text-xs w-full h-full`}
                    title={showTutorTranscript ? 'Hide tutor transcript' : 'Show tutor transcript'}
                  >
                    {showTutorTranscript ? '👁️ Tutor' : '🚫 Tutor'}
                  </button>
                </SpotlightCard>
              </div>
            </div>
            <a
              href="/home"
              className="text-white hover:text-blue-300 transition-colors text-xs"
            >
              ← Home
            </a>
          </div>

          {error && (
            <SpotlightCard className="mb-4 !border-red-500/50" spotlightColor="rgba(239, 68, 68, 0.2)">
              <div className="text-red-300 text-sm">
                {error}
              </div>
            </SpotlightCard>
          )}

          {/* Centered Orb - Static AI Tutor Visual */}
          <div className="flex flex-col items-center justify-center mt-12">
            <div style={{ width: '100%', maxWidth: '600px', height: '600px', position: 'relative' }}>
              <Orb
                hue={0}
                hoverIntensity={0}
                rotateOnHover={false}
                forceHoverState={false}
              />
            </div>
            {isTutorSpeaking && (
              <SpotlightCard className="mt-6 !p-4" spotlightColor="rgba(59, 130, 246, 0.3)">
                <p className="text-xl text-blue-300 animate-pulse font-medium">
                  AI Tutor is speaking...
                </p>
              </SpotlightCard>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent p-4 backdrop-blur-sm">
        <div className="max-w-xl mx-auto">
          <form onSubmit={handleSend} className="relative">
            <SpotlightCard className="!p-0 w-full" spotlightColor="rgba(59, 130, 246, 0.3)">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    micActive
                      ? 'Speak freely or type here...'
                      : status === 'connected'
                      ? 'Type to chat (mic off)'
                      : 'Connecting...'
                  }
                  className="w-full px-4 py-3 pr-24 bg-transparent text-white text-base placeholder-gray-400 focus:outline-none"
                  disabled={status !== 'connected'}
                />
                <button
                  type="submit"
                  disabled={status !== 'connected' || !input.trim()}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 ${
                    status === 'connected' && input.trim()
                      ? 'text-blue-400 hover:text-blue-300'
                      : 'text-gray-600'
                  } font-semibold text-sm transition-colors disabled:cursor-not-allowed`}
                >
                  Send
                </button>
              </div>
            </SpotlightCard>
          </form>

          {micActive && (
            <p className="text-sm text-gray-400 mt-3 text-center">
              💡 You can speak or type - AI responds with voice + text
            </p>
          )}
        </div>
      </div>
    </OrbBG>
  )
}
