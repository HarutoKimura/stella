/**
 * Integration between Realtime API and Bubble System
 *
 * This module handles triggering bubbles based on:
 * 1. Realtime API function calls (corrections, target usage)
 * 2. Database-stored recurring errors
 * 3. Target phrase reminders
 */

import { bubbleHelpers } from './bubbleHelpers'
import { createClient } from './supabaseClient'

type CorrectionData = {
  type: 'grammar' | 'vocab' | 'pron'
  example: string
  correction: string
}

/**
 * Check for recurring errors in database and trigger bubble if needed
 */
export async function checkRecurringErrors(userId: string, newError: CorrectionData) {
  const supabase = createClient()

  // Check if this error exists in database
  const { data: existingError } = await supabase
    .from('errors')
    .select('*')
    .eq('user_id', userId)
    .eq('type', newError.type)
    .eq('example', newError.example)
    .single()

  if (existingError && existingError.count >= 2) {
    // Show recurring error bubble if seen 2+ times
    bubbleHelpers.showRecurringError(
      newError.type,
      newError.example,
      newError.correction,
      existingError.count + 1
    )
  } else {
    // Show regular correction bubble
    bubbleHelpers.showCorrection(
      newError.type,
      newError.example,
      newError.correction
    )
  }
}

/**
 * Handle correction from Realtime API
 */
export function handleRealtimeCorrection(correction: CorrectionData, userId: string) {
  // Check if it's a recurring error
  checkRecurringErrors(userId, correction)
}

/**
 * Handle target phrase reminder
 */
export function handleTargetReminder(phrase: string, turnCount: number) {
  // Show reminder after 2 turns if target not used
  if (turnCount >= 2) {
    bubbleHelpers.showTargetReminder(phrase)
  }
}

/**
 * Handle target phrase success
 */
export function handleTargetSuccess(phrase: string) {
  bubbleHelpers.showTargetSuccess(phrase)
}
