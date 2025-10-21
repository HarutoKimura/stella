/**
 * Bubble Store - Manages floating conversation and feedback bubbles
 */

import { create } from 'zustand'

export type BubbleType = 'grammar' | 'vocab' | 'pron' | 'target' | 'recurring' | 'tutor' | 'user'

export type Bubble = {
  id: string
  type: BubbleType
  title: string
  message: string
  count?: number // for recurring errors
  createdAt: number
}

type BubbleStore = {
  bubbles: Bubble[]
  addBubble: (bubble: Omit<Bubble, 'id' | 'createdAt'>) => void
  addTutorMessage: (message: string) => void
  addUserMessage: (message: string) => void
  removeBubble: (id: string) => void
  clearAll: () => void
}

export const useBubbleStore = create<BubbleStore>((set) => ({
  bubbles: [],

  addBubble: (bubbleData) => {
    const bubble: Bubble = {
      ...bubbleData,
      id: `bubble-${Date.now()}-${Math.random()}`,
      createdAt: Date.now(),
    }

    set((state) => {
      const newBubbles = [...state.bubbles, bubble]

      // For correction/target bubbles, keep all (no auto-remove)
      // For conversation bubbles (tutor/user), keep only last 3
      const correctionTypes: BubbleType[] = ['grammar', 'vocab', 'pron', 'target', 'recurring']

      if (correctionTypes.includes(bubble.type)) {
        // Keep all correction bubbles (persistent)
        return { bubbles: newBubbles }
      } else {
        // For conversation bubbles, keep only last 3
        const conversationBubbles = newBubbles.filter(b =>
          b.type === 'tutor' || b.type === 'user'
        )
        const correctionBubbles = newBubbles.filter(b =>
          correctionTypes.includes(b.type)
        )

        // Keep all corrections + last 3 conversation
        const recentConversation = conversationBubbles.slice(-3)

        return { bubbles: [...correctionBubbles, ...recentConversation] }
      }
    })
  },

  addTutorMessage: (message: string) => {
    const { addBubble } = useBubbleStore.getState()
    addBubble({
      type: 'tutor',
      title: 'Tutor',
      message,
    })
  },

  addUserMessage: (message: string) => {
    const { addBubble } = useBubbleStore.getState()
    addBubble({
      type: 'user',
      title: 'You',
      message,
    })
  },

  removeBubble: (id) =>
    set((state) => ({
      bubbles: state.bubbles.filter((b) => b.id !== id),
    })),

  clearAll: () => set({ bubbles: [] }),
}))
