'use client'

import { useBubbleStore } from '@/lib/bubbleStore'
import { FloatingBubble } from './FloatingBubble'

/**
 * BubbleContainer - Renders all active floating bubbles
 * Left side: conversation (tutor/user)
 * Right side: corrections/tips (grammar/vocab/pron/target/recurring)
 */
export function BubbleContainer() {
  const bubbles = useBubbleStore((state) => state.bubbles)
  const removeBubble = useBubbleStore((state) => state.removeBubble)

  // Separate bubbles into left (conversation) and right (corrections)
  const conversationBubbles = bubbles.filter(b => b.type === 'tutor' || b.type === 'user')
  const correctionBubbles = bubbles.filter(b =>
    b.type === 'grammar' || b.type === 'vocab' || b.type === 'pron' || b.type === 'target' || b.type === 'recurring'
  )

  return (
    <>
      {/* Left side: conversation bubbles */}
      {conversationBubbles.map((bubble, index) => (
        <FloatingBubble
          key={bubble.id}
          bubble={bubble}
          index={index}
          onDismiss={removeBubble}
        />
      ))}

      {/* Right side: correction/tip bubbles */}
      {correctionBubbles.map((bubble, index) => (
        <FloatingBubble
          key={bubble.id}
          bubble={bubble}
          index={index}
          onDismiss={removeBubble}
        />
      ))}
    </>
  )
}
