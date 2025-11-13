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
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { FloatingTopicContainer } from '@/components/FloatingTopicContainer'
import { TopicCardData } from '@/components/FloatingTopicCard'
import { detectConversationStruggle, generateFloatingTopicCards } from '@/lib/topicSuggestions'
import { assessPronunciation, usePronunciationStore } from '@/lib/pronunciationStore'
import { FloatingPhraseContainer } from '@/components/FloatingPhraseContainer'
import { PhraseCardData } from '@/components/FloatingPhraseCard'
import { generateFloatingPhraseCardsFromDb } from '@/lib/phraseSuggestions'

function FreeConversationContent() {
  const [input, setInput] = useState('')
  const sessionId = useSessionStore((state) => state.sessionId)
  const user = useSessionStore((state) => state.user)
  const transcript = useSessionStore((state) => state.transcript)
  const activeTargets = useSessionStore((state) => state.activeTargets)
  const startSession = useSessionStore((state) => state.startSession)
  const setUser = useSessionStore((state) => state.setUser)
  const addUserMessage = useBubbleStore((state) => state.addUserMessage)
  const showTutorTranscript = useBubbleStore((state) => state.showTutorTranscript)
  const toggleTutorTranscript = useBubbleStore((state) => state.toggleTutorTranscript)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Floating topic cards state
  const [floatingCards, setFloatingCards] = useState<TopicCardData[]>([])
  const [hasShownCards, setHasShownCards] = useState(false)

  // Floating phrase cards state (weakness-based suggestions)
  const [floatingPhraseCards, setFloatingPhraseCards] = useState<PhraseCardData[]>([])
  const [hasShownPhraseCards, setHasShownPhraseCards] = useState(false)

  // Context from accent test (if redirected from test results)
  const [accentTestFeedback, setAccentTestFeedback] = useState<any[] | null>(null)

  // Context from coach practice session (if redirected from practice)
  const [coachSessionContext, setCoachSessionContext] = useState<{
    sessionId: string
    focusAreas: string[]
    level: string
    weekId: number
    insightSummary?: string
  } | null>(null)

  // Realtime connection
  const { status, error, micActive, isTutorSpeaking, start, sendText, stop } = useRealtime()

  // Fetch feedback from accent test if coming from test results
  const [feedbackLoaded, setFeedbackLoaded] = useState(false)

  useEffect(() => {
    const fromTestId = searchParams.get('from_test')
    const coachSessionId = searchParams.get('coach_session_id')
    const focusAreasParam = searchParams.get('focus_areas')
    const levelParam = searchParams.get('level')
    const weekIdParam = searchParams.get('week_id')
    const insightSummaryParam = searchParams.get('insight_summary')

    // Extract coach session context if present
    if (coachSessionId && focusAreasParam && levelParam && weekIdParam) {
      console.log('[Coach Session Context] Detected practice session context')
      setCoachSessionContext({
        sessionId: coachSessionId,
        focusAreas: focusAreasParam.split(','),
        level: levelParam,
        weekId: parseInt(weekIdParam, 10),
        insightSummary: insightSummaryParam || undefined,
      })
    }

    const fetchFeedback = async () => {
      if (!fromTestId) {
        // No test context, mark as loaded and continue
        setFeedbackLoaded(true)
        return
      }

      console.log('[Accent Test Context] Loading feedback for test:', fromTestId)
      const { data: feedback } = await supabase
        .from('feedback_tips')
        .select('category, original_sentence, corrected_sentence, tip, severity')
        .eq('accent_test_id', fromTestId)
        .order('severity', { ascending: false }) // High severity first

      if (feedback && feedback.length > 0) {
        console.log('[Accent Test Context] Loaded', feedback.length, 'feedback tips')
        setAccentTestFeedback(feedback)
      } else {
        console.log('[Accent Test Context] No feedback found for test')
      }

      setFeedbackLoaded(true)
    }

    fetchFeedback()
  }, [searchParams, supabase])

  useEffect(() => {
    // Wait for feedback to load before starting session
    if (!feedbackLoaded) {
      console.log('[Init] Waiting for feedback to load...')
      return
    }

    // Prevent double initialization in React strict mode
    let initialized = false

    const init = async () => {
      if (initialized) return
      initialized = true
      console.log('[Init] Starting session with feedback context:', accentTestFeedback ? `${accentTestFeedback.length} tips` : 'none')
      await initSession()
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackLoaded])

  // Monitor conversation for struggle patterns and show topic cards automatically
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

  // Auto-show phrase suggestions after some conversation (using database weaknesses)
  useEffect(() => {
    if (!user || !sessionId || hasShownPhraseCards || transcript.length < 8) return

    const autoShow = async () => {
      if (floatingPhraseCards.length > 0) return

      console.log('[Auto Phrase Suggestions] Triggering after', transcript.length, 'turns')
      const existingPhrases = activeTargets.map((t) => t.phrase)

      const phraseCards = await generateFloatingPhraseCardsFromDb(user.id, user.cefr, existingPhrases, 2)

      if (phraseCards.length > 0) {
        console.log('[Auto Phrase Suggestions] Showing', phraseCards.length, 'weakness-based phrases')
        setFloatingPhraseCards(phraseCards)
        setHasShownPhraseCards(true)

        // Reset the flag after 90 seconds so cards can appear again
        setTimeout(() => {
          setHasShownPhraseCards(false)
        }, 90000)
      }
    }

    autoShow()
  }, [transcript.length, user, sessionId, activeTargets, floatingPhraseCards, hasShownPhraseCards])

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
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ cefr }),
      })

      if (!plannerRes.ok) {
        const errorData = await plannerRes.json().catch(() => ({ error: 'Unknown error' }))
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

      // Start realtime connection with gentle mode and accent test feedback if available
      console.log('[Frontend] Preparing realtime token request', {
        userId,
        sessionId: session.id,
        feedbackContextLength: accentTestFeedback?.length || 0,
      })

      await start({
        userId,
        sessionId: session.id,
        feedbackContext: accentTestFeedback || [],
      })
    } catch (error) {
      console.error('Failed to start session:', error)
      // Show error to user
      alert(`Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleDismissFloatingCard = (cardId: string) => {
    setFloatingCards((prev) => prev.filter((card) => card.id !== cardId))
  }

  const handleDismissPhraseCard = (cardId: string) => {
    setFloatingPhraseCards((prev) => prev.filter((card) => card.id !== cardId))
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

      // STEP 1: Assess pronunciation FIRST (before summarize) so scores are saved
      console.log('[Stop Session] Starting pronunciation assessment...')
      try {
        const pronunciationResult = await assessPronunciation(currentSessionId)
        if (pronunciationResult) {
          console.log('[Pronunciation Assessment] Complete:', pronunciationResult.averageScores)

          // Save clarity focus words to database
          if (pronunciationResult.clarityFocusWords && pronunciationResult.clarityFocusWords.length > 0) {
            console.log('[Clarity Focus] Saving', pronunciationResult.clarityFocusWords.length, 'words')

            // Get user profile for user_id
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (authUser) {
              const { data: profile } = await supabase
                .from('users')
                .select('id')
                .eq('auth_user_id', authUser.id)
                .single()

              if (profile) {
                // Insert clarity focus words
                const clarityFocusRecords = pronunciationResult.clarityFocusWords.map((word) => ({
                  session_id: currentSessionId,
                  user_id: profile.id,
                  word: word.word,
                  accuracy_score: word.accuracy,
                  segment_index: word.segmentIndex,
                  phonemes: word.phonemes || null,
                }))

                console.log('[Clarity Focus] Records to save:', JSON.stringify(clarityFocusRecords, null, 2))

                const { error: clarityError } = await supabase
                  .from('clarity_focus')
                  .insert(clarityFocusRecords)

                if (clarityError) {
                  console.error('[Clarity Focus] Failed to save:', clarityError)
                } else {
                  console.log('[Clarity Focus] Successfully saved', clarityFocusRecords.length, 'words')
                }
              }
            }
          }
        } else {
          console.log('[Pronunciation Assessment] No audio segments to assess')
        }
      } catch (error) {
        console.error('[Pronunciation Assessment] Failed:', error)
        // Continue anyway - don't block the user
      }

      // STEP 2: Now call summarize API (after pronunciation scores are saved)
      console.log('[Stop Session] Calling summarize API with complete data...')
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

      // STEP 3: If this conversation came from a coach practice session, save the link
      if (coachSessionContext) {
        console.log('[Coach Session Context] Saving conversation session with link to practice')

        // Convert transcript format to match ConversationMessage type
        const conversationTranscript = currentTranscript.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          text: msg.text,
          timestamp: new Date().toISOString(),
        }))

        await fetch('/api/session/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weekId: coachSessionContext.weekId,
            focusAreas: coachSessionContext.focusAreas,
            transcript: conversationTranscript,
            insightSummary: coachSessionContext.insightSummary,
            coachSessionId: coachSessionContext.sessionId,
          }),
        })

        console.log('[Coach Session Context] Conversation session saved with practice link')
      }

      // Clear session from store
      useSessionStore.getState().endSession()

      // Clear pronunciation store for next session
      usePronunciationStore.getState().clearAudioSegments()

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

      {/* Floating Phrase Cards (weakness-based suggestions) */}
      <FloatingPhraseContainer
        cards={floatingPhraseCards}
        onDismiss={handleDismissPhraseCard}
        topicCardCount={floatingCards.length}
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
                {/* Phrase suggestions button - based on historical weaknesses */}
                <SpotlightCard className="!p-0 !rounded-lg" spotlightColor="rgba(251, 191, 36, 0.3)">
                  <button
                    onClick={async () => {
                      if (!user || floatingPhraseCards.length > 0) {
                        console.log('[Phrase Button] Skipped - cards already showing or no user')
                        return
                      }

                      console.log('[Phrase Button] Fetching phrases from database...')
                      const existingPhrases = activeTargets.map((t) => t.phrase)

                      const phraseCards = await generateFloatingPhraseCardsFromDb(user.id, user.cefr, existingPhrases, 2)

                      if (phraseCards.length > 0) {
                        console.log('[Manual Phrase Suggestion] Showing', phraseCards.length, 'weakness-based phrases')
                        setFloatingPhraseCards(phraseCards)
                      } else {
                        console.log('[Manual Phrase Suggestion] No phrases found')
                        alert('No phrase suggestions available yet. Keep practicing to build your error history!')
                      }
                    }}
                    className="text-amber-400 font-semibold px-3 py-1.5 text-xs w-full h-full"
                    title="Get phrase suggestions based on your past mistakes"
                    disabled={floatingPhraseCards.length > 0}
                  >
                    ✨ Phrases
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

          {/* Coach Session Context - Applying Practice */}
          {coachSessionContext && (
            <SpotlightCard className="mb-4 !border-purple-400/30" spotlightColor="rgba(168, 85, 247, 0.2)">
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🎓</span>
                  <h3 className="font-semibold text-purple-300">Applying Your Practice Session</h3>
                </div>
                <p className="text-sm text-gray-300 mb-2">
                  This conversation applies what you learned in your structured practice session.
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-400">Focus areas:</span>
                  {coachSessionContext.focusAreas.map((area, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 rounded border bg-purple-500/20 text-purple-300 border-purple-400/30"
                    >
                      {area}
                    </span>
                  ))}
                  <span className="text-xs text-gray-400 ml-2">Level:</span>
                  <span className="text-xs px-2 py-1 rounded border bg-indigo-500/20 text-indigo-300 border-indigo-400/30">
                    {coachSessionContext.level}
                  </span>
                </div>
              </div>
            </SpotlightCard>
          )}

          {/* Session Memory Display - Personalized Context */}
          {accentTestFeedback && accentTestFeedback.length > 0 && (
            <SpotlightCard className="mb-4 !border-blue-400/30" spotlightColor="rgba(59, 130, 246, 0.2)">
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🎯</span>
                  <h3 className="font-semibold text-blue-300">Personalized Session</h3>
                </div>
                <p className="text-sm text-gray-300 mb-2">
                  This session is customized using your recent accent test ({new Date().toLocaleDateString()}).
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-400">Focus areas:</span>
                  {accentTestFeedback.map((fb, idx) => {
                    const severityColors: Record<string, string> = {
                      high: 'bg-red-500/20 text-red-300 border-red-400/30',
                      medium: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
                      low: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
                    }
                    const severityColor = severityColors[fb.severity] || 'bg-gray-500/20 text-gray-300 border-gray-400/30'

                    return (
                      <span
                        key={idx}
                        className={`text-xs px-2 py-1 rounded border ${severityColor}`}
                      >
                        {fb.category} ({fb.severity})
                      </span>
                    )
                  })}
                </div>
              </div>
            </SpotlightCard>
          )}

          {/* Centered Orb */}
          <div className="flex flex-col items-center justify-center mt-12 relative">
            {/* Orb Background - distorted during loading */}
            <div style={{ width: '100%', maxWidth: '600px', height: '600px', position: 'relative' }}>
              <Orb
                hue={200}
                hoverIntensity={1.5}
                rotateOnHover={true}
                forceHoverState={status === 'connecting' || status === 'idle'}
              />

              {/* Loading overlay text - shown during setup */}
              {(status === 'connecting' || status === 'idle') && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <SpotlightCard className="!p-6" spotlightColor="rgba(59, 130, 246, 0.4)">
                    <div className="text-center">
                      <p className="text-2xl text-blue-300 animate-pulse font-bold mb-2">
                        Setting up your session...
                      </p>
                      <p className="text-sm text-gray-400">
                        {status === 'idle' ? 'Preparing AI tutor' : 'Connecting to voice system'}
                      </p>
                    </div>
                  </SpotlightCard>
                </div>
              )}
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

export default function FreeConversationPage() {
  return (
    <Suspense fallback={
      <OrbBG>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </OrbBG>
    }>
      <FreeConversationContent />
    </Suspense>
  )
}
