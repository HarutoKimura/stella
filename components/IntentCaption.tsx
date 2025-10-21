'use client'

import { useSessionStore } from '@/lib/sessionStore'

/**
 * IntentCaption - Shows recognized intent from text/voice commands
 */
export function IntentCaption() {
  const currentIntent = useSessionStore((state) => state.currentIntent)

  if (!currentIntent) return null

  return (
    <div className="fixed top-4 right-4 z-50 bg-blue-700/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-sm font-medium">Intent: {currentIntent}</span>
      </div>
    </div>
  )
}
