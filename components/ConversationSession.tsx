'use client'

import { useState, useRef, useEffect } from 'react'
import type { ConversationMessage } from '@/types/coach'

type ConversationSessionProps = {
  focusAreas: string[]
  level: string
  weekId: number
  insightSummary?: string
  onClose?: () => void
}

export function ConversationSession({
  focusAreas,
  level,
  weekId,
  insightSummary,
  onClose,
}: ConversationSessionProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send initial greeting from AI
  useEffect(() => {
    if (messages.length === 0) {
      const greeting: ConversationMessage = {
        role: 'assistant',
        text: `Hi! I'm excited to practice ${focusAreas.join(' and ')} with you today. What would you like to talk about?`,
        timestamp: new Date().toISOString(),
      }
      setMessages([greeting])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ConversationMessage = {
      role: 'user',
      text: input.trim(),
      timestamp: new Date().toISOString(),
    }

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: userMessage.text,
          focusAreas,
          level,
          messages,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to get response')
      }

      const data = await res.json()

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        text: data.reply,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      // Add error message
      const errorMessage: ConversationMessage = {
        role: 'assistant',
        text: "I'm sorry, I'm having trouble responding right now. Could you try again?",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const endSession = async () => {
    if (messages.length < 2) {
      alert('Please have at least one exchange before ending the session.')
      return
    }

    setIsSaving(true)

    try {
      const res = await fetch('/api/session/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekId,
          focusAreas,
          transcript: messages,
          insightSummary,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to save session')
      }

      const data = await res.json()
      setFeedback(data.feedback)
    } catch (error) {
      console.error('Error ending session:', error)
      alert('Failed to save your conversation. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // If feedback is shown, display feedback view
  if (feedback) {
    return (
      <div className="p-6 bg-gradient-to-br from-green-800/20 to-teal-800/20 rounded-xl border border-green-700/30">
        <div className="text-center mb-4">
          <span className="text-5xl">✨</span>
          <h3 className="text-xl font-semibold text-green-300 mt-2">Session Complete!</h3>
        </div>

        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-400 mb-2">Your Feedback:</p>
          <p className="text-gray-200 leading-relaxed">{feedback}</p>
        </div>

        <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3 mb-4">
          <p className="text-xs text-teal-200">
            💾 Your conversation has been saved. You practiced {messages.length} exchanges
            focusing on {focusAreas.join(', ')}.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
          >
            Close
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-indigo-300 flex items-center gap-2">
          <span className="text-2xl">🎙️</span> Apply in Conversation
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-700/30 px-2 py-1 rounded">
            {messages.length} exchanges
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              title="Close without saving"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Focus areas display */}
      <div className="flex flex-wrap gap-2 mb-3">
        {focusAreas.map((area, idx) => (
          <span
            key={idx}
            className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300"
          >
            {area}
          </span>
        ))}
      </div>

      {/* Messages container */}
      <div className="h-80 overflow-y-auto p-3 bg-slate-900/40 rounded-lg mb-3 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600/30 border border-blue-500/30'
                  : 'bg-purple-600/20 border border-purple-500/20'
              }`}
            >
              <p className="text-xs font-semibold mb-1 opacity-70">
                {msg.role === 'user' ? 'You' : 'AI Coach'}
              </p>
              <p className="text-gray-200 text-sm leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-purple-600/20 border border-purple-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-300"></div>
                <span className="text-xs text-gray-400">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading || isSaving}
          className="flex-1 rounded-lg bg-slate-700/50 border border-slate-600/50 px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
          placeholder="Type your message..."
          maxLength={500}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading || isSaving}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '...' : 'Send'}
        </button>
        <button
          onClick={endSession}
          disabled={isSaving || isLoading}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            'End'
          )}
        </button>
      </div>

      {/* Tips */}
      <div className="mt-3 text-xs text-gray-400 flex items-start gap-2">
        <span>💡</span>
        <p>
          Practice naturally! The AI will gently guide you and provide feedback at the end.
          Press Enter to send, or click "End" when you're ready to finish.
        </p>
      </div>
    </div>
  )
}
