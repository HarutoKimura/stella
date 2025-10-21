/**
 * Phase 2: Voice Intent Parser
 *
 * Maps function calls from OpenAI Realtime API to intent actions.
 * This module bridges the gap between voice function calls and the intent router.
 */

import { VoiceIntent } from './aiContracts'
import { Intent, parseVoiceIntent, executeIntent } from './intentRouter'
import { useSessionStore } from './sessionStore'

/**
 * Handle function call from Realtime API
 */
export async function handleVoiceFunctionCall(
  functionName: string,
  args: Record<string, any>
): Promise<void> {
  const voiceIntent = mapFunctionToVoiceIntent(functionName, args)

  if (!voiceIntent) {
    console.warn(`Unknown function call: ${functionName}`)
    return
  }

  // Convert voice intent to general intent
  const intent = parseVoiceIntent(voiceIntent)

  // Execute intent
  await executeIntent(intent)
}

/**
 * Map function call to VoiceIntent
 */
function mapFunctionToVoiceIntent(
  functionName: string,
  args: Record<string, any>
): VoiceIntent | null {
  switch (functionName) {
    case 'mark_target_used':
      return {
        type: 'mark_target_used',
        phrase: args.phrase,
      }

    case 'add_correction':
      return {
        type: 'add_correction',
        correctionType: args.type as 'grammar' | 'vocab' | 'pron',
        example: args.example,
        correction: args.correction,
      }

    case 'end_session':
      return { type: 'end_session' }

    case 'navigate':
      return {
        type: 'navigate',
        destination: args.destination,
      }

    case 'start_session':
      return { type: 'start_session' }

    case 'add_target':
      return {
        type: 'add_target',
        phrase: args.phrase,
      }

    default:
      return null
  }
}

/**
 * Handle transcript update from Realtime API
 */
export function handleVoiceTranscript(text: string, role: 'user' | 'tutor') {
  const store = useSessionStore.getState()
  store.addTurn(role, text)
}

/**
 * Handle target phrase usage detected in speech
 */
export function handleTargetUsed(phrase: string) {
  const store = useSessionStore.getState()
  store.markTargetUsed(phrase)
}
