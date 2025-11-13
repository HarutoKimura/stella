'use client'

import React from 'react'
import { FloatingPhraseCard, PhraseCardData } from './FloatingPhraseCard'

type FloatingPhraseContainerProps = {
  cards: PhraseCardData[]
  onDismiss: (id: string) => void
  topicCardCount: number // Number of topic cards currently showing (for offset calculation)
}

export const FloatingPhraseContainer: React.FC<FloatingPhraseContainerProps> = ({
  cards,
  onDismiss,
  topicCardCount,
}) => {
  if (cards.length === 0) return null

  return (
    <>
      {cards.map((card, index) => (
        <FloatingPhraseCard
          key={card.id}
          card={card}
          index={index}
          onDismiss={onDismiss}
          topicCardCount={topicCardCount}
        />
      ))}
    </>
  )
}
