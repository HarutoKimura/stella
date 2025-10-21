/**
 * Helper functions to trigger different types of bubbles
 */

import { useBubbleStore } from './bubbleStore'

type CorrectionType = 'grammar' | 'vocab' | 'pron'

export const bubbleHelpers = {
  /**
   * Show a correction bubble
   */
  showCorrection: (type: CorrectionType, example: string, correction: string) => {
    const { addBubble } = useBubbleStore.getState()

    const titles = {
      grammar: 'Grammar',
      vocab: 'Vocabulary',
      pron: 'Pronunciation',
    }

    addBubble({
      type,
      title: titles[type],
      message: `"${example}"\n→ "${correction}"`,
    })
  },

  /**
   * Show a recurring error bubble
   */
  showRecurringError: (type: CorrectionType, example: string, correction: string, count: number) => {
    const { addBubble } = useBubbleStore.getState()

    addBubble({
      type: 'recurring',
      title: 'Common Mistake',
      message: `"${example}"\n→ "${correction}"`,
      count,
    })
  },

  /**
   * Show a target phrase reminder
   */
  showTargetReminder: (phrase: string) => {
    const { addBubble } = useBubbleStore.getState()

    addBubble({
      type: 'target',
      title: 'Try Using',
      message: `"${phrase}"`,
    })
  },

  /**
   * Show target phrase success
   */
  showTargetSuccess: (phrase: string) => {
    const { addBubble } = useBubbleStore.getState()

    addBubble({
      type: 'target',
      title: 'Great Job! ✨',
      message: `You used: "${phrase}"`,
    })
  },

  /**
   * Show multiple corrections from tutor response
   */
  showCorrections: (corrections: Array<{ type: CorrectionType; example: string; correction: string }>) => {
    corrections.forEach((correction, index) => {
      // Stagger multiple corrections slightly
      setTimeout(() => {
        bubbleHelpers.showCorrection(correction.type, correction.example, correction.correction)
      }, index * 500)
    })
  },
}
