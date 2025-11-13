'use client'

import React, { useEffect, useState } from 'react'
import ElectricBorder from './ElectricBorder'

export type PhraseCardData = {
  id: string
  phrase: string
  cefr: string
  exampleSentence: string
  category: string // e.g., "Expression", "Idiom", "Phrasal Verb"
}

type FloatingPhraseCardProps = {
  card: PhraseCardData
  index: number
  onDismiss: (id: string) => void
  topicCardCount: number
}

export const FloatingPhraseCard: React.FC<FloatingPhraseCardProps> = ({
  card,
  index,
  onDismiss,
  topicCardCount,
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)

  useEffect(() => {
    // Stagger entrance animation
    const timer = setTimeout(() => setIsVisible(true), index * 150)
    return () => clearTimeout(timer)
  }, [index])

  useEffect(() => {
    // Auto-dismiss after 30 seconds
    const dismissTimer = setTimeout(() => {
      handleDismiss()
    }, 30000)

    return () => clearTimeout(dismissTimer)
  }, [])

  const handleDismiss = () => {
    setIsDismissing(true)
    setTimeout(() => {
      onDismiss(card.id)
    }, 300)
  }

  // Position cards on the right side, stacked vertically (offset from topics)
  // Topic cards use 380px spacing, so offset phrase cards by (topicCardCount * 380px)
  // Phrase cards also use 380px spacing between them
  const topicOffset = topicCardCount * 380
  const phraseOffset = index * 380
  const position = {
    right: '2rem',
    top: `calc(6rem + ${topicOffset + phraseOffset}px)`,
  }

  return (
    <div
      className={`fixed z-40 transition-all duration-500 ease-out ${
        isVisible && !isDismissing
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95 translate-x-8'
      }`}
      style={{
        ...position,
        width: '420px',
        pointerEvents: 'auto',
      }}
    >
      <ElectricBorder
        color="#fbbf24"
        speed={1.2}
        chaos={0.6}
        thickness={2}
        style={{ borderRadius: 16 }}
      >
        <div className="bg-slate-900/95 backdrop-blur-md p-6 rounded-2xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-5xl">✨</span>
              <div>
                <h3 className="text-white font-semibold text-2xl leading-tight">
                  New Phrase
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-block text-sm px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {card.cefr}
                  </span>
                  <span className="text-xs text-gray-400">{card.category}</span>
                </div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDismiss()
              }}
              className="text-gray-500 hover:text-white transition-colors text-3xl leading-none -mt-1"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>

          {/* Phrase */}
          <div className="bg-slate-800/60 rounded-lg p-4 border border-amber-500/20 mb-3">
            <p className="text-2xl text-amber-200 font-semibold text-center">
              "{card.phrase}"
            </p>
          </div>

          {/* Example */}
          <div className="bg-slate-800/40 rounded-lg p-4 border border-amber-500/10">
            <p className="text-sm text-gray-400 mb-2">Example:</p>
            <p className="text-lg text-white leading-relaxed">
              "{card.exampleSentence}"
            </p>
          </div>

          {/* Try hint */}
          <p className="text-sm text-amber-400 text-center mt-4 animate-pulse">
            💬 Try using this phrase in your conversation!
          </p>
        </div>
      </ElectricBorder>
    </div>
  )
}
