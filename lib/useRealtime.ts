/**
 * useRealtime Hook
 *
 * Manages OpenAI Realtime API connection via WebRTC
 * Supports both voice (audio) and text (data channel) communication
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSessionStore, TranscriptTurn } from './sessionStore'
import { useBubbleStore } from './bubbleStore'

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

type RealtimeConfig = {
  userId: string
  sessionId: string
}

export function useRealtime() {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [micActive, setMicActive] = useState(false)

  const peerRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const bufferRef = useRef<string>('')

  const addTurn = useSessionStore((state) => state.addTurn)
  const markTargetUsed = useSessionStore((state) => state.markTargetUsed)
  const addTutorMessage = useBubbleStore((state) => state.addTutorMessage)

  // Extract text from nested delta structure
  const extractDeltaText = (delta: any): string => {
    if (!delta) return ''
    if (typeof delta === 'string') return delta

    if (Array.isArray(delta)) {
      return delta.map((item) => extractDeltaText(item)).join('')
    }

    if (typeof delta === 'object') {
      const maybeText = delta.text
      if (typeof maybeText === 'string') return maybeText

      const maybeValue = delta.value
      if (typeof maybeValue === 'string') return maybeValue

      const maybeContent = delta.content
      if (Array.isArray(maybeContent)) {
        return maybeContent.map((item) => extractDeltaText(item)).join('')
      }

      const nestedDelta = delta.delta
      if (nestedDelta) {
        return extractDeltaText(nestedDelta)
      }
    }

    return ''
  }

  // Handle realtime events from OpenAI
  const handleRealtimeEvent = useCallback((raw: string) => {
    try {
      const events = JSON.parse(raw)
      const eventList = Array.isArray(events) ? events : [events]

      eventList.forEach((event: any) => {
        console.log('[Realtime Event]', event.type, event)

        switch (event.type) {
          // Text deltas (streaming response)
          case 'response.delta':
          case 'response.text.delta':
          case 'response.audio_transcript.delta':
          case 'response.output_text.delta': {
            const chunk = extractDeltaText(event.delta)
            if (chunk) {
              bufferRef.current += chunk
            }
            break
          }

          // Response completion - commit to transcript and show as bubble
          case 'response.completed':
          case 'response.text.done':
          case 'response.audio_transcript.done':
          case 'response.output_text.done': {
            if (bufferRef.current.trim()) {
              const message = bufferRef.current.trim()
              addTurn('tutor', message)
              addTutorMessage(message)
              bufferRef.current = ''
            }
            break
          }

          // Error handling
          case 'response.error':
          case 'error': {
            const message = event.error?.message ?? 'Realtime error'
            console.error('[Realtime Error]', message, event)
            setError(message)
            break
          }

          // Function calls (from Realtime API tools)
          case 'response.function_call_arguments.done':
          case 'conversation.item.input_audio_transcription.completed': {
            console.log('[Function Call]', event)
            // These would be handled by the realtime session config
            break
          }

          // Session events
          case 'session.created':
          case 'session.updated': {
            console.log('[Session]', event.type)
            break
          }
        }
      })
    } catch (err) {
      console.error('[Event Parse Error]', err, raw)
    }
  }, [addTurn, addTutorMessage])

  // Start realtime session
  const start = useCallback(async (config: RealtimeConfig) => {
    try {
      setStatus('connecting')
      setError(null)

      // 1. Get microphone permission
      console.log('[1/6] Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        },
        video: false,
      })
      streamRef.current = stream
      setMicActive(true)

      // 2. Create session via backend (get ephemeral token)
      console.log('[2/6] Creating session...')
      const response = await fetch('/api/realtime-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        throw new Error('Failed to create session')
      }

      const { token, model, prompt } = await response.json()
      console.log('[Session Created]', { model, hasToken: !!token })

      // 3. Create WebRTC peer connection
      console.log('[3/6] Setting up WebRTC...')
      const peer = new RTCPeerConnection()
      peerRef.current = peer

      // Add audio tracks
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream)
      })

      // Handle incoming audio
      peer.ontrack = (event) => {
        console.log('[Audio Track]', event.streams[0])
        const [remoteStream] = event.streams
        const audioElement = document.createElement('audio')
        audioElement.autoplay = true
        audioElement.srcObject = remoteStream
        document.body.appendChild(audioElement)
      }

      // 4. Create data channel for text
      console.log('[4/6] Creating data channel...')
      const channel = peer.createDataChannel('oai-events')
      channelRef.current = channel

      channel.addEventListener('open', () => {
        console.log('[Data Channel] Opened')
        setStatus('connected')

        // Send session configuration only
        // Don't trigger response.create here - let the AI initiate naturally
        const sessionConfig = {
          type: 'session.update',
          session: {
            instructions: prompt,
            modalities: ['text', 'audio'],
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
          },
        }

        channel.send(JSON.stringify(sessionConfig))
      })

      channel.addEventListener('message', (messageEvent) => {
        const { data } = messageEvent
        if (typeof data === 'string') {
          handleRealtimeEvent(data)
        }
      })

      channel.addEventListener('close', () => {
        console.log('[Data Channel] Closed')
        setStatus('disconnected')
      })

      channel.addEventListener('error', (err) => {
        console.error('[Data Channel Error]', err)
        setError('Data channel error')
      })

      // 5. Negotiate SDP with OpenAI
      console.log('[5/6] Negotiating connection...')
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)

      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime?model=${model}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/sdp',
            'OpenAI-Beta': 'realtime=v1',
          },
          body: offer.sdp,
        }
      )

      if (!sdpResponse.ok) {
        throw new Error('Failed to negotiate connection')
      }

      const answerSdp = await sdpResponse.text()
      await peer.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      })

      console.log('[6/6] Connection established!')
    } catch (err: any) {
      console.error('[Start Error]', err)
      setError(err.message || 'Failed to start session')
      setStatus('error')
      cleanup()
    }
  }, [handleRealtimeEvent])

  // Send text message via data channel
  const sendText = useCallback(async (message: string) => {
    if (!message.trim()) {
      return
    }

    const channel = channelRef.current
    if (!channel || channel.readyState !== 'open') {
      throw new Error('Connection is not ready')
    }

    // Add to transcript immediately (optimistic update)
    addTurn('user', message)

    // Send to OpenAI
    const packets = [
      {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: message,
            },
          ],
        },
      },
      {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: 'Continue tutoring using the established persona and session context.',
        },
      },
    ]

    packets.forEach((packet) => {
      channel.send(JSON.stringify(packet))
    })
  }, [])

  // Cleanup
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.close()
      channelRef.current = null
    }

    if (peerRef.current) {
      peerRef.current.close()
      peerRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    setMicActive(false)
    bufferRef.current = ''
  }, [])

  // Stop session
  const stop = useCallback(() => {
    cleanup()
    setStatus('idle')
  }, [cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    status,
    error,
    micActive,
    start,
    sendText,
    stop,
  }
}
