'use client'

import React, { useState } from 'react'
import { TopicSuggestionCard, TopicSuggestion } from './TopicSuggestionCard'
import ElectricBorder from './ElectricBorder'

/**
 * Demo component to showcase the TopicSuggestionCard
 * This can be used for testing or as a standalone demo page
 */
export const TopicCardDemo: React.FC = () => {
  const [showCard, setShowCard] = useState(false)

  const demoSuggestions: TopicSuggestion[] = [
    {
      title: 'Career Goals',
      description: 'Discuss your career aspirations and professional interests',
      icon: '💼',
      cefr: 'B1',
    },
    {
      title: 'Technology Impact',
      description: 'Share your thoughts on how technology affects daily life',
      icon: '📱',
      cefr: 'B1',
    },
    {
      title: 'Cultural Differences',
      description: 'Compare cultural practices between different countries',
      icon: '🌍',
      cefr: 'B1',
    },
    {
      title: 'Personal Challenge',
      description: 'Describe a challenge you overcame and what you learned',
      icon: '🎖️',
      cefr: 'B1',
    },
  ]

  const handleSelectTopic = (topic: TopicSuggestion) => {
    console.log('Selected topic:', topic)
    alert(`You selected: ${topic.title}`)
    setShowCard(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-4">
          Topic Suggestion Card Demo
        </h1>
        <p className="text-gray-400 mb-8">
          This popup appears when the AI detects a user struggling with conversation topics
        </p>

        <ElectricBorder
          color="#5227FF"
          speed={1}
          chaos={0.5}
          thickness={2}
          style={{ borderRadius: 16 }}
        >
          <div className="bg-slate-900/80 p-6 rounded-2xl">
            <h2 className="text-2xl font-semibold text-white mb-4">
              How It Works
            </h2>
            <ul className="space-y-3 text-gray-300 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <span>
                  The system monitors conversation patterns to detect when users give short responses
                  or use many filler words
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <span>
                  When struggle is detected, a beautiful popup with topic suggestions appears
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <span>
                  Topics are tailored to the user's CEFR level (A1, A2, B1, B2, C1, C2)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                <span>
                  Uses the ElectricBorder component for eye-catching, animated borders
                </span>
              </li>
            </ul>

            <button
              onClick={() => setShowCard(true)}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02]"
            >
              Show Topic Suggestions
            </button>
          </div>
        </ElectricBorder>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ElectricBorder color="#7df9ff" speed={0.8} chaos={0.3} thickness={2} style={{ borderRadius: 12 }}>
            <div className="bg-slate-900/60 p-4 rounded-xl">
              <h3 className="text-white font-semibold mb-2">Features</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>✓ Automatic struggle detection</li>
                <li>✓ CEFR-level appropriate topics</li>
                <li>✓ Smooth animations</li>
                <li>✓ ESC key to dismiss</li>
                <li>✓ Click outside to close</li>
              </ul>
            </div>
          </ElectricBorder>

          <ElectricBorder color="#ff6b9d" speed={0.8} chaos={0.3} thickness={2} style={{ borderRadius: 12 }}>
            <div className="bg-slate-900/60 p-4 rounded-xl">
              <h3 className="text-white font-semibold mb-2">Customization</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Adjustable colors & effects</li>
                <li>• Custom topic categories</li>
                <li>• Flexible trigger conditions</li>
                <li>• Themeable design</li>
              </ul>
            </div>
          </ElectricBorder>
        </div>
      </div>

      <TopicSuggestionCard
        isVisible={showCard}
        suggestions={demoSuggestions}
        onSelectTopic={handleSelectTopic}
        onDismiss={() => setShowCard(false)}
      />
    </div>
  )
}
