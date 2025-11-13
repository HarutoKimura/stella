'use client'

import React, { useEffect, useState } from 'react'
import ElectricBorder from './ElectricBorder'

export type TopicCardData = {
  id: string
  topic: string
  exampleSentence: string
  cefr: string
  icon: string
  usefulPhrases: string[]
}

type FloatingTopicCardProps = {
  card: TopicCardData
  index: number
  onDismiss: (id: string) => void
}

export const FloatingTopicCard: React.FC<FloatingTopicCardProps> = ({
  card,
  index,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)

  useEffect(() => {
    // Stagger entrance animation
    const timer = setTimeout(() => setIsVisible(true), index * 150)
    return () => clearTimeout(timer)
  }, [index])

  useEffect(() => {
    // Auto-dismiss after 30 seconds (increased for flip interaction)
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

  // Position cards on the right side, stacked vertically with more spacing
  const position = {
    right: '2rem',
    top: `calc(6rem + ${index * 380}px)`,
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
        width: '460px',
        pointerEvents: 'auto',
        perspective: '1000px',
      }}
    >
      {/* Flip Container */}
      <div
        className="relative w-full cursor-pointer"
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front Side */}
        <div
          className="w-full"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <ElectricBorder
            color="#7df9ff"
            speed={1.2}
            chaos={0.6}
            thickness={2}
            style={{ borderRadius: 16 }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md p-7 rounded-2xl">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <span className="text-6xl">{card.icon}</span>
                  <div>
                    <h3 className="text-white font-semibold text-3xl leading-tight">
                      {card.topic}
                    </h3>
                    <span className="inline-block text-base px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mt-2">
                      {card.cefr}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDismiss()
                  }}
                  className="text-gray-500 hover:text-white transition-colors text-4xl leading-none -mt-1"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>

              {/* Example Sentence */}
              <div className="bg-slate-800/60 rounded-lg p-6 border border-cyan-500/20 mb-5">
                <p className="text-xl text-gray-400 mb-4 font-medium">Try saying:</p>
                <p className="text-2xl text-white leading-relaxed">
                  "{card.exampleSentence}"
                </p>
              </div>

              {/* Flip hint */}
              <p className="text-base text-cyan-400 text-center animate-pulse">
                👆 Click to see useful phrases
              </p>
            </div>
          </ElectricBorder>
        </div>

        {/* Back Side */}
        <div
          className="absolute top-0 left-0 w-full"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <ElectricBorder
            color="#ff6b9d"
            speed={1.2}
            chaos={0.6}
            thickness={2}
            style={{ borderRadius: 16 }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md p-7 rounded-2xl">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <span className="text-6xl">💬</span>
                  <div>
                    <h3 className="text-white font-semibold text-3xl leading-tight">
                      Useful Phrases
                    </h3>
                    <span className="inline-block text-base px-3 py-1.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 mt-2">
                      {card.topic}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDismiss()
                  }}
                  className="text-gray-500 hover:text-white transition-colors text-4xl leading-none -mt-1"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>

              {/* Useful Phrases List */}
              <div className="bg-slate-800/60 rounded-lg p-6 border border-pink-500/20 mb-5">
                <ul className="space-y-4">
                  {card.usefulPhrases.map((phrase, idx) => (
                    <li key={idx} className="text-2xl text-white leading-relaxed flex items-start gap-3">
                      <span className="text-pink-400 mt-1 text-2xl">•</span>
                      <span>"{phrase}"</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Flip back hint */}
              <p className="text-base text-pink-400 text-center animate-pulse">
                👆 Click to flip back
              </p>
            </div>
          </ElectricBorder>
        </div>
      </div>
    </div>
  )
}
