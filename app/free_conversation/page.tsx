'use client'

import { OrbBG } from '@/components/OrbBG'
import { IntentCaption } from '@/components/IntentCaption'
import { BubbleContainer } from '@/components/BubbleContainer'
import Orb from '@/components/Orb'
import SpotlightCard from '@/components/SpotlightCard'
import { Stopwatch } from '@/components/Stopwatch'
import { useSessionStore } from '@/lib/sessionStore'
import { useBubbleStore } from '@/lib/bubbleStore'
import { useRealtime } from '@/lib/useRealtime'
import { parseTextIntent, executeIntent } from '@/lib/intentRouter'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { FloatingTopicContainer } from '@/components/FloatingTopicContainer'
import { TopicCardData } from '@/components/FloatingTopicCard'
import { detectConversationStruggle, generateFloatingTopicCards } from '@/lib/topicSuggestions'

export default function FreeConversationPage() {
  const [input, setInput] = useState('')
  const sessionId = useSessionStore((state) => state.sessionId)
  const user = useSessionStore((state) => state.user)
  const transcript = useSessionStore((state) => state.transcript)
  const startSession = useSessionStore((state) => state.startSession)
  const setUser = useSessionStore((state) => state.setUser)
  const addUserMessage = useBubbleStore((state) => state.addUserMessage)
  const showTutorTranscript = useBubbleStore((state) => state.showTutorTranscript)
  const toggleTutorTranscript = useBubbleStore((state) => state.toggleTutorTranscript)
  const router = useRouter()
  const supabase = createClient()

  // Floating topic cards state
  const [floatingCards, setFloatingCards] = useState<TopicCardData[]>([])
  const [hasShownCards, setHasShownCards] = useState(false)

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

  // Monitor conversation for struggle patterns and show cards automatically
  useEffect(() => {
    if (!user || !sessionId || transcript.length < 4 || hasShownCards) return

    const isStruggling = detectConversationStruggle(transcript)

    if (isStruggling && floatingCards.length === 0) {
      // Generate 2-3 floating topic cards based on user's CEFR level
      const cards = generateFloatingTopicCards(user.cefr)
      setFloatingCards(cards)
      setHasShownCards(true)

      // Reset the flag after 60 seconds so cards can appear again if needed
      setTimeout(() => {
        setHasShownCards(false)
      }, 60000)
    }
  }, [transcript, user, sessionId, floatingCards, hasShownCards])

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

    // Auto-start session with gentle mode (no selection needed)
    if (profile.id && profile.cefr_level && !sessionId) {
      await startNewSession(profile.id, profile.cefr_level)
    }
  }

  const startNewSession = async (userId: string, cefr: string) => {
    try {
      // Always use gentle mode for the best balance
      await supabase
        .from('users')
        .update({ correction_mode: 'gentle' })
        .eq('id', userId)

      // Get micro-pack from planner
      const plannerRes = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cefr }),
      })

      if (!plannerRes.ok) {
        const errorData = await plannerRes.json()
        console.error('Planner API error:', errorData)
        throw new Error(errorData.error || 'Failed to generate micro-pack')
      }

      const microPack = await plannerRes.json()

      if (!microPack.targets || !Array.isArray(microPack.targets)) {
        console.error('Invalid microPack response:', microPack)
        throw new Error('Invalid response from planner')
      }

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

      // Start realtime connection with gentle mode
      await start({
        userId,
        sessionId: session.id,
      })
    } catch (error) {
      console.error('Failed to start session:', error)
    }
  }

  const handleDismissFloatingCard = (cardId: string) => {
    setFloatingCards((prev) => prev.filter((card) => card.id !== cardId))
  }

  const handleStopSession = async () => {
    // Stop WebRTC connection
    stop()

    // Save session and redirect to review
    const activeTargets = useSessionStore.getState().activeTargets
    const currentTranscript = useSessionStore.getState().transcript
    const currentCorrections = useSessionStore.getState().corrections
    const currentSessionId = useSessionStore.getState().sessionId

    if (!currentSessionId) return

    try {
      // Collect used/missed targets
      const usedTargets = activeTargets.filter((t) => t.used).map((t) => t.phrase)
      const missedTargets = activeTargets.filter((t) => !t.used).map((t) => t.phrase)

      // Call summarize API with full transcript and corrections
      await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          usedTargets,
          missedTargets,
          corrections: currentCorrections,
          transcript: currentTranscript,
          metrics: {
            wpm: 0,
            filler_rate: 0,
            avg_pause_ms: 0,
          },
        }),
      })

      // Clear session from store
      useSessionStore.getState().endSession()

      // Navigate to review page
      router.push(`/session-review/${currentSessionId}`)
    } catch (error) {
      console.error('Failed to save session:', error)
      // Still redirect to home on error
      router.push('/home')
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
          await handleStopSession()
        } else {
          await executeIntent(intent)
        }
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

      {/* Floating Topic Cards */}
      <FloatingTopicContainer
        cards={floatingCards}
        onDismiss={handleDismissFloatingCard}
      />

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

              {/* Stopwatch - Session Timer */}
              {status === 'connected' && (
                <SpotlightCard className="!p-2 !rounded-lg" spotlightColor="rgba(139, 92, 246, 0.3)">
                  <Stopwatch isRunning={status === 'connected'} className="text-purple-300" />
                </SpotlightCard>
              )}

              {/* Session control buttons */}
              <div className="flex items-center gap-2">
                {/* Start button removed - users choose correction mode cards instead */}
                {status === 'connected' || status === 'connecting' ? (
                  <SpotlightCard className="!p-0 !rounded-lg" spotlightColor="rgba(239, 68, 68, 0.3)">
                    <button
                      onClick={handleStopSession}
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
                {/* Topic suggestions button */}
                <SpotlightCard className="!p-0 !rounded-lg" spotlightColor="rgba(125, 249, 255, 0.3)">
                  <button
                    onClick={() => {
                      if (user && floatingCards.length === 0) {
                        const cards = generateFloatingTopicCards(user.cefr)
                        setFloatingCards(cards)
                      }
                    }}
                    className="text-cyan-400 font-semibold px-3 py-1.5 text-xs w-full h-full"
                    title="Get topic suggestions"
                    disabled={floatingCards.length > 0}
                  >
                    💡 Topics
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

          {/* Centered Orb */}
          <div className="flex flex-col items-center justify-center mt-12 relative">
            {/* Orb Background */}
            <div style={{ width: '100%', maxWidth: '600px', height: '600px', position: 'relative' }}>
              <Orb
                hue={0}
                hoverIntensity={0}
                rotateOnHover={false}
                forceHoverState={false}
              />
            </div>

            {/* AI Tutor speaking indicator - shown during active session */}
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
