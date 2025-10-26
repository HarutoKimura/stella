'use client'

import React from 'react'
import { FloatingTopicCard, TopicCardData } from './FloatingTopicCard'

type FloatingTopicContainerProps = {
  cards: TopicCardData[]
  onDismiss: (id: string) => void
}

export const FloatingTopicContainer: React.FC<FloatingTopicContainerProps> = ({
  cards,
  onDismiss,
}) => {
  if (cards.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {cards.map((card, index) => (
        <FloatingTopicCard
          key={card.id}
          card={card}
          index={index}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  )
}
