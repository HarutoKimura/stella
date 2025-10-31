import { useSessionStore } from './sessionStore'
import { VoiceIntent } from './aiContracts'

/**
 * Intent Router
 *
 * Maps text/voice commands to actions.
 * Designed to work with both text input (Phase 1) and voice function calls (Phase 2).
 */

export type Intent =
  | { type: 'start'; destination: '/free_conversation' }
  | { type: 'stop' }
  | { type: 'navigate'; destination: '/home' | '/user_profile' | '/free_conversation' }
  | { type: 'add_target'; phrase: string }
  | { type: 'unknown' }

/**
 * Parse text command and extract intent
 */
export function parseTextIntent(input: string): Intent {
  const normalized = input.toLowerCase().trim()

  // Start session
  if (normalized === 'start' || normalized.includes('start session')) {
    return { type: 'start', destination: '/free_conversation' }
  }

  // Stop session
  if (
    normalized === 'stop' ||
    normalized === 'end' ||
    normalized.includes('stop session') ||
    normalized.includes('end session')
  ) {
    return { type: 'stop' }
  }

  // Navigation
  if (normalized === 'home' || normalized.includes('go home')) {
    return { type: 'navigate', destination: '/home' }
  }

  if (
    normalized === 'profile' ||
    normalized.includes('my profile') ||
    normalized.includes('user profile')
  ) {
    return { type: 'navigate', destination: '/user_profile' }
  }

  if (normalized.includes('conversation') || normalized.includes('practice')) {
    return { type: 'navigate', destination: '/free_conversation' }
  }

  // Add target phrase
  const addMatch = normalized.match(/add ["'](.+)["']/)
  if (addMatch) {
    return { type: 'add_target', phrase: addMatch[1] }
  }

  return { type: 'unknown' }
}

/**
 * Parse voice function call from Realtime API and convert to intent
 */
export function parseVoiceIntent(voiceIntent: VoiceIntent): Intent {
  switch (voiceIntent.type) {
    case 'start_session':
      return { type: 'start', destination: '/free_conversation' }
    case 'end_session':
      return { type: 'stop' }
    case 'navigate':
      return { type: 'navigate', destination: voiceIntent.destination }
    case 'add_target':
      return { type: 'add_target', phrase: voiceIntent.phrase }
    default:
      return { type: 'unknown' }
  }
}

/**
 * Execute intent action
 * Returns true if action was handled, false otherwise
 */
export async function executeIntent(intent: Intent): Promise<boolean> {
  const store = useSessionStore.getState()

  switch (intent.type) {
    case 'start':
      // Start session: call planner API, create session, navigate
      await startSessionFlow()
      return true

    case 'stop':
      // End session: call summarize API, reset state, navigate home
      await endSessionFlow()
      return true

    case 'navigate':
      // Navigate to destination
      if (typeof window !== 'undefined') {
        window.location.href = intent.destination
      }
      return true

    case 'add_target':
      // Add custom target phrase
      await addCustomTarget(intent.phrase)
      return true

    case 'unknown':
      return false
  }
}

/**
 * Start session flow
 */
async function startSessionFlow() {
  const store = useSessionStore.getState()

  if (!store.user) {
    console.error('No user logged in')
    return
  }

  try {
    store.setIntent('start')

    // Call planner API
    const plannerRes = await fetch('/api/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cefr: store.user.cefr }),
    })

    if (!plannerRes.ok) {
      throw new Error('Failed to generate micro-pack')
    }

    const microPack = await plannerRes.json()

    // Create session in database
    const supabaseRes = await fetch('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: store.user.id, targets: microPack.targets }),
    })

    const { sessionId } = await supabaseRes.json()

    // Update store
    store.startSession(
      sessionId,
      microPack.targets.map((t: { phrase: string }) => t.phrase)
    )

    // Navigate to conversation
    if (typeof window !== 'undefined') {
      window.location.href = '/free_conversation'
    }

    store.setIntent(null)
  } catch (error) {
    console.error('Failed to start session:', error)
    store.setIntent(null)
  }
}

/**
 * End session flow
 */
async function endSessionFlow() {
  const store = useSessionStore.getState()

  if (!store.sessionId) {
    console.error('No active session')
    return
  }

  try {
    store.setIntent('stop')

    // Collect used/missed targets
    const usedTargets = store.activeTargets.filter((t) => t.used).map((t) => t.phrase)
    const missedTargets = store.activeTargets.filter((t) => !t.used).map((t) => t.phrase)

    // Call summarize API with full transcript
    await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: store.sessionId,
        usedTargets,
        missedTargets,
        corrections: [], // Collected from transcript
        transcript: store.transcript, // Include full transcript before clearing
        metrics: {
          wpm: 0, // TODO: Calculate from timing
          filler_rate: 0,
          avg_pause_ms: 0,
        },
      }),
    })

    // Store sessionId before clearing
    const sessionIdForReview = store.sessionId

    // Reset store
    store.endSession()

    // Navigate to session review page
    if (typeof window !== 'undefined' && sessionIdForReview) {
      window.location.href = `/session-review/${sessionIdForReview}`
    }

    store.setIntent(null)
  } catch (error) {
    console.error('Failed to end session:', error)
    store.setIntent(null)
  }
}

/**
 * Add custom target phrase
 */
async function addCustomTarget(phrase: string) {
  const store = useSessionStore.getState()

  if (!store.user) {
    console.error('No user logged in')
    return
  }

  try {
    store.setIntent(`add "${phrase}"`)

    // Add to database
    await fetch('/api/targets/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: store.user.id, phrase }),
    })

    // Update local state if in active session
    if (store.sessionId) {
      store.startSession(store.sessionId, [
        ...store.activeTargets.map((t) => t.phrase),
        phrase,
      ])
    }

    store.setIntent(null)
  } catch (error) {
    console.error('Failed to add target:', error)
    store.setIntent(null)
  }
}
