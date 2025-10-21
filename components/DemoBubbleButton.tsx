'use client'

import { bubbleHelpers } from '@/lib/bubbleHelpers'
import { useBubbleStore } from '@/lib/bubbleStore'

/**
 * Demo button to test bubble functionality
 * Remove this component in production
 */
export function DemoBubbleButton() {
  const addTutorMessage = useBubbleStore((state) => state.addTutorMessage)
  const addUserMessage = useBubbleStore((state) => state.addUserMessage)

  const testBubbles = () => {
    // Show conversation bubbles
    setTimeout(() => {
      addUserMessage("I go to store yesterday")
    }, 500)

    setTimeout(() => {
      addTutorMessage("Great! Tell me more about your visit.")
    }, 1500)

    // Show correction bubble (persistent)
    setTimeout(() => {
      bubbleHelpers.showCorrection(
        'grammar',
        'I go to store yesterday',
        'I went to the store yesterday'
      )
    }, 2500)

    setTimeout(() => {
      addUserMessage("I buy new shoes there")
    }, 4000)

    setTimeout(() => {
      bubbleHelpers.showTargetReminder('How was your day?')
    }, 5000)
  }

  return (
    <button
      onClick={testBubbles}
      className="fixed bottom-6 left-6 z-50 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm border border-white/30 transition-all"
    >
      🧪 Test Bubbles
    </button>
  )
}
