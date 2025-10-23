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

  // Calculate random position around the orb using entire screen space
  // Avoid only the bottom input box area
  const [position] = useState(() => {
    // All possible positions spread across the entire screen
    const allPositions = [
      { angle: -90, distance: 320 },   // Top
      { angle: -135, distance: 340 },  // Top-left
      { angle: -45, distance: 340 },   // Top-right
      { angle: 180, distance: 350 },   // Left
      { angle: 0, distance: 350 },     // Right
      { angle: -160, distance: 300 },  // Far left
      { angle: -20, distance: 300 },   // Far right
      { angle: -110, distance: 380 },  // Upper-left far
      { angle: -70, distance: 380 },   // Upper-right far
      { angle: 150, distance: 330 },   // Lower-left
      { angle: 30, distance: 330 },    // Lower-right
    ]

    // Randomly select a position
    const randomIndex = Math.floor(Math.random() * allPositions.length)
    const pos = allPositions[randomIndex]
    const angleInRadians = (pos.angle * Math.PI) / 180

    // Calculate position relative to center
    const xOffset = Math.cos(angleInRadians) * pos.distance
    const yOffset = Math.sin(angleInRadians) * pos.distance

    return {
      left: `calc(50% + ${xOffset}px)`,
      top: `calc(50% + ${yOffset}px)`,
      transform: 'translate(-50%, -50%)',
    }
  })

  return (
    <div
      className={`fixed z-40 transition-all duration-500 ease-out ${
        isVisible && !isDismissing
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95'
      }`}
      style={{
        ...position,
        width: '360px',
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
            <div className="bg-slate-900/95 backdrop-blur-md p-5 rounded-2xl">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{card.icon}</span>
                  <div>
                    <h3 className="text-white font-semibold text-base leading-tight">
                      {card.topic}
                    </h3>
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mt-1">
                      {card.cefr}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDismiss()
                  }}
                  className="text-gray-500 hover:text-white transition-colors text-2xl leading-none -mt-1"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>

              {/* Example Sentence */}
              <div className="bg-slate-800/60 rounded-lg p-4 border border-cyan-500/20 mb-3">
                <p className="text-sm text-gray-400 mb-2 font-medium">Try saying:</p>
                <p className="text-base text-white leading-relaxed">
                  "{card.exampleSentence}"
                </p>
              </div>

              {/* Flip hint */}
              <p className="text-xs text-cyan-400 text-center animate-pulse">
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
            <div className="bg-slate-900/95 backdrop-blur-md p-5 rounded-2xl">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">💬</span>
                  <div>
                    <h3 className="text-white font-semibold text-base leading-tight">
                      Useful Phrases
                    </h3>
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 mt-1">
                      {card.topic}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDismiss()
                  }}
                  className="text-gray-500 hover:text-white transition-colors text-2xl leading-none -mt-1"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>

              {/* Useful Phrases List */}
              <div className="bg-slate-800/60 rounded-lg p-4 border border-pink-500/20 mb-3">
                <ul className="space-y-3">
                  {card.usefulPhrases.map((phrase, idx) => (
                    <li key={idx} className="text-sm text-white leading-relaxed flex items-start gap-2">
                      <span className="text-pink-400 mt-1 text-base">•</span>
                      <span>"{phrase}"</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Flip back hint */}
              <p className="text-xs text-pink-400 text-center animate-pulse">
                👆 Click to flip back
              </p>
            </div>
          </ElectricBorder>
        </div>
      </div>
    </div>
  )
}
