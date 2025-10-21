'use client'

import { useEffect, useState } from 'react'
import { Bubble, BubbleType } from '@/lib/bubbleStore'

type FloatingBubbleProps = {
  bubble: Bubble
  index: number
  onDismiss: (id: string) => void
}

const bubbleConfig: Record<
  BubbleType,
  { emoji: string; bgColor: string; borderColor: string; textColor: string }
> = {
  grammar: {
    emoji: '📝',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-400/50',
    textColor: 'text-red-200',
  },
  vocab: {
    emoji: '📚',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-400/50',
    textColor: 'text-blue-200',
  },
  pron: {
    emoji: '🗣️',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-400/50',
    textColor: 'text-green-200',
  },
  target: {
    emoji: '🎯',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-400/50',
    textColor: 'text-yellow-200',
  },
  recurring: {
    emoji: '⚠️',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-400/50',
    textColor: 'text-orange-200',
  },
  tutor: {
    emoji: '🤖',
    bgColor: 'bg-blue-600/30',
    borderColor: 'border-blue-400/40',
    textColor: 'text-blue-100',
  },
  user: {
    emoji: '👤',
    bgColor: 'bg-purple-600/30',
    borderColor: 'border-purple-400/40',
    textColor: 'text-purple-100',
  },
}

export function FloatingBubble({ bubble, index, onDismiss }: FloatingBubbleProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const config = bubbleConfig[bubble.type]

  // Stagger appearance
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 150)
    return () => clearTimeout(timer)
  }, [index])

  const handleDismiss = () => {
    setIsLeaving(true)
    setTimeout(() => {
      onDismiss(bubble.id)
    }, 400) // Match animation duration
  }

  // Determine if this is a conversation bubble or correction/tip bubble
  const isConversation = bubble.type === 'tutor' || bubble.type === 'user'

  // Position from bottom (stagger vertically upward)
  const bottomPosition = 120 + index * 160 // 120px from bottom, 160px spacing

  // Random float animation delay for each bubble
  const floatDelay = Math.random() * 2

  return (
    <div
      className={`fixed z-50 ${
        isConversation ? 'left-6' : 'right-6'
      }`}
      style={{
        bottom: `${bottomPosition}px`,
        animation: isVisible && !isLeaving ? `float 3s ease-in-out ${floatDelay}s infinite` : 'none'
      }}
    >
      <div
        className={`${config.bgColor} ${config.borderColor} backdrop-blur-md rounded-3xl border-2 p-6 shadow-2xl cursor-pointer max-w-2xl w-full transition-all duration-500 ${
          isVisible && !isLeaving
            ? 'opacity-100 scale-100'
            : isLeaving
            ? 'opacity-0 scale-75 translate-y-4'
            : 'opacity-0 scale-50 translate-y-12'
        }`}
        style={{
          transform: isVisible && !isLeaving ? 'translateY(0) scale(1)' : '',
          transition: 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        }}
        onClick={handleDismiss}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{config.emoji}</span>
          <div className="flex-1">
            <h3 className={`${config.textColor} font-bold text-xs uppercase tracking-wide`}>
              {bubble.title}
              {bubble.count && bubble.count > 1 && (
                <span className="ml-2 text-[10px] opacity-75">({bubble.count}x)</span>
              )}
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/60 hover:text-white/90 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Message */}
        <p className="text-white text-xl leading-relaxed whitespace-pre-line font-medium">
          {bubble.message}
        </p>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  )
}
