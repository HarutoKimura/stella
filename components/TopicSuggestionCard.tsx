'use client'

import React, { useEffect, useState } from 'react'
import ElectricBorder from './ElectricBorder'

export type TopicSuggestion = {
  title: string
  description: string
  icon: string
  cefr: string
}

type TopicSuggestionCardProps = {
  isVisible: boolean
  suggestions: TopicSuggestion[]
  onSelectTopic: (topic: TopicSuggestion) => void
  onDismiss: () => void
}

export const TopicSuggestionCard: React.FC<TopicSuggestionCardProps> = ({
  isVisible,
  suggestions,
  onSelectTopic,
  onDismiss,
}) => {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true)
    } else {
      const timer = setTimeout(() => setIsAnimating(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  if (!isAnimating && !isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ pointerEvents: isVisible ? 'auto' : 'none' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onDismiss}
      />

      {/* Card Container */}
      <div
        className={`relative max-w-2xl w-full transition-all duration-300 transform ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        <ElectricBorder
          color="#7df9ff"
          speed={1.5}
          chaos={0.7}
          thickness={3}
          style={{ borderRadius: 24 }}
          className="overflow-hidden"
        >
          <div className="bg-slate-900/95 backdrop-blur-md p-8 rounded-3xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  💡 Need a conversation topic?
                </h2>
                <p className="text-gray-400 text-sm">
                  Select a topic below to get the conversation flowing
                </p>
              </div>
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Topic Suggestions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((topic, index) => (
                <button
                  key={index}
                  onClick={() => onSelectTopic(topic)}
                  className="group relative text-left"
                >
                  <ElectricBorder
                    color="#5227FF"
                    speed={0.8}
                    chaos={0.3}
                    thickness={2}
                    style={{ borderRadius: 16 }}
                    className="h-full transition-all duration-200 group-hover:scale-[1.02]"
                  >
                    <div className="bg-slate-800/80 backdrop-blur-sm p-5 rounded-2xl h-full flex flex-col group-hover:bg-slate-800/95 transition-colors">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-3xl">{topic.icon}</span>
                        <div className="flex-1">
                          <h3 className="text-white font-semibold text-lg mb-1">
                            {topic.title}
                          </h3>
                          <span className="inline-block text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {topic.cefr}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm flex-1">
                        {topic.description}
                      </p>
                      <div className="mt-3 text-blue-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to discuss →
                      </div>
                    </div>
                  </ElectricBorder>
                </button>
              ))}
            </div>

            {/* Footer Hint */}
            <div className="mt-6 text-center text-gray-500 text-xs">
              Press ESC or click outside to dismiss
            </div>
          </div>
        </ElectricBorder>
      </div>
    </div>
  )
}

// Hook for keyboard shortcuts
export const useTopicCardKeyboard = (onDismiss: () => void, isVisible: boolean) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        onDismiss()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss, isVisible])
}
