'use client'

import React, { useEffect, useState } from 'react'
import ElectricBorder from './ElectricBorder'

export type TopicCardData = {
  id: string
  topic: string
  exampleSentence: string
  cefr: string
  icon: string
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

  useEffect(() => {
    // Stagger entrance animation
    const timer = setTimeout(() => setIsVisible(true), index * 150)
    return () => clearTimeout(timer)
  }, [index])

  useEffect(() => {
    // Auto-dismiss after 20 seconds
    const dismissTimer = setTimeout(() => {
      handleDismiss()
    }, 20000)

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
        maxWidth: '280px',
        pointerEvents: 'auto',
      }}
    >
      <ElectricBorder
        color="#7df9ff"
        speed={1.2}
        chaos={0.6}
        thickness={2}
        style={{ borderRadius: 16 }}
      >
        <div className="bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{card.icon}</span>
              <div>
                <h3 className="text-white font-semibold text-sm leading-tight">
                  {card.topic}
                </h3>
                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mt-1">
                  {card.cefr}
                </span>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-500 hover:text-white transition-colors text-lg leading-none -mt-1"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>

          {/* Example Sentence */}
          <div className="bg-slate-800/60 rounded-lg p-3 border border-cyan-500/20">
            <p className="text-xs text-gray-400 mb-1 font-medium">Try saying:</p>
            <p className="text-sm text-white leading-relaxed">
              "{card.exampleSentence}"
            </p>
          </div>

          {/* Auto-dismiss hint */}
          <p className="text-[10px] text-gray-600 mt-2 text-center">
            Auto-dismisses in 20s
          </p>
        </div>
      </ElectricBorder>
    </div>
  )
}
