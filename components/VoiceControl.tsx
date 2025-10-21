'use client'

import { useState, useEffect } from 'react'
import { getVoiceClient } from '@/lib/realtimeVoiceClient'
import { handleVoiceFunctionCall, handleVoiceTranscript } from '@/lib/voiceIntentParser'
import { useSessionStore } from '@/lib/sessionStore'

/**
 * Phase 2: Voice Control Component
 *
 * Manages voice mode toggle and Realtime API connection.
 * Shows speaking indicator when active.
 */
export function VoiceControl() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isVoiceMode = useSessionStore((state) => state.isVoiceMode)
  const setVoiceMode = useSessionStore((state) => state.setVoiceMode)

  const voiceClient = getVoiceClient()

  useEffect(() => {
    // Setup event listeners
    voiceClient.on('transcript', (text, role) => {
      handleVoiceTranscript(text, role)
    })

    voiceClient.on('functionCall', async (intent) => {
      // Handle function calls from Realtime API
      if (intent.type === 'mark_target_used') {
        const store = useSessionStore.getState()
        store.markTargetUsed(intent.phrase)
      }
      // Add more handlers as needed
    })

    voiceClient.on('error', (err) => {
      setError(err.message)
      setVoiceMode(false)
    })

    voiceClient.on('connected', () => {
      setIsConnecting(false)
    })

    voiceClient.on('disconnected', () => {
      setVoiceMode(false)
    })
  }, [])

  const toggleVoiceMode = async () => {
    if (isVoiceMode) {
      // Disconnect
      await voiceClient.disconnect()
      setVoiceMode(false)
    } else {
      // Connect
      setIsConnecting(true)
      setError(null)

      try {
        // Fetch token and session config
        const [tokenRes, configRes] = await Promise.all([
          fetch('/api/realtime-token'),
          fetch('/api/realtime-session', { method: 'POST' }),
        ])

        if (!tokenRes.ok || !configRes.ok) {
          throw new Error('Failed to initialize voice session')
        }

        const { token } = await tokenRes.json()
        const { instructions, functions } = await configRes.json()

        // Connect to Realtime API
        await voiceClient.connect(token, instructions, functions)

        setVoiceMode(true)
      } catch (err: any) {
        setError(err.message || 'Failed to enable voice mode')
        setIsConnecting(false)
      }
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={toggleVoiceMode}
        disabled={isConnecting}
        className={`relative flex items-center gap-3 px-6 py-4 rounded-full shadow-lg transition-all ${
          isVoiceMode
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white font-semibold disabled:opacity-50`}
      >
        {isConnecting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Connecting...</span>
          </>
        ) : isVoiceMode ? (
          <>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span>Voice Active</span>
          </>
        ) : (
          <>
            <span className="text-2xl">🎤</span>
            <span>Enable Voice</span>
          </>
        )}
      </button>

      {error && (
        <div className="mt-2 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm max-w-xs">
          {error}
        </div>
      )}
    </div>
  )
}
