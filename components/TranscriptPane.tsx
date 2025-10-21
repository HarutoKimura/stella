'use client'

import { useSessionStore } from '@/lib/sessionStore'
import { useEffect, useRef } from 'react'

/**
 * TranscriptPane - Shows conversation history
 */
export function TranscriptPane() {
  const transcript = useSessionStore((state) => state.transcript)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript])

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold text-white mb-4">Conversation</h2>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2">
        {transcript.length === 0 ? (
          <p className="text-gray-400 text-sm">Start the conversation...</p>
        ) : (
          transcript.map((turn, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg ${
                turn.role === 'user'
                  ? 'bg-blue-700/40 ml-8'
                  : 'bg-blue-500/30 mr-8'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-semibold uppercase ${
                    turn.role === 'user' ? 'text-blue-200' : 'text-blue-300'
                  }`}
                >
                  {turn.role === 'user' ? 'You' : 'Tutor'}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(turn.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-white">{turn.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
