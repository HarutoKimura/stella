/**
 * useRealtime Hook
 *
 * Manages OpenAI Realtime API connection via WebRTC
 * Supports both voice (audio) and text (data channel) communication
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSessionStore } from './sessionStore'
import { useBubbleStore } from './bubbleStore'
import { usePronunciationStore } from './pronunciationStore'
import { parseCorrections, containsCorrection } from './correctionParser'

type VADState = {
  audioContext: AudioContext | null
  analyser: AnalyserNode | null
  dataArray: Uint8Array | null
  rafId: number | null
  speaking: boolean
  silenceStartedAt: number | null
  recordingStartedAt: number | null
  speechConsistencyCount: number // Track consecutive speech detections
}

const SPEECH_RMS_THRESHOLD = 0.05 // Increased from 0.02 to reduce background noise sensitivity
const SILENCE_DURATION_MS = 2000 // Increased from 750ms to 2000ms to capture longer phrases
const MIN_UTTERANCE_MS = 800 // Increased from 500ms to filter out very short noise bursts
const SPEECH_CONSISTENCY_CHECKS = 3 // Number of consecutive frames needed to confirm speech

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

type RealtimeConfig = {
  userId: string
  sessionId: string
  feedbackContext?: Array<{
    category: string
    original_sentence: string
    corrected_sentence: string
    tip: string
    severity: string
  }>
}

export function useRealtime() {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [micActive, setMicActive] = useState(false)
  const [isTutorSpeaking, setIsTutorSpeaking] = useState(false)

  const peerRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const bufferRef = useRef<string>('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const vadRef = useRef<VADState>({
    audioContext: null,
    analyser: null,
    dataArray: null,
    rafId: null,
    speaking: false,
    silenceStartedAt: null,
    recordingStartedAt: null,
    speechConsistencyCount: 0,
  })

  const addTurn = useSessionStore((state) => state.addTurn)
  const addCorrection = useSessionStore((state) => state.addCorrection)
  const addTutorMessage = useBubbleStore((state) => state.addTutorMessage)
  const addUserMessage = useBubbleStore((state) => state.addUserMessage)
  const addAudioSegment = usePronunciationStore((state) => state.addAudioSegment)

  const lastUserMessageRef = useRef<string>('')
  const isActiveRef = useRef(false)

  // Check if text is likely English (to avoid sending non-English to Azure)
  const isLikelyEnglish = (text: string): boolean => {
    if (!text || text.length === 0) return false

    // Check for non-English scripts (Japanese, Korean, Chinese, etc.)
    const hasNonEnglishChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0400-\u04FF]/.test(text)

    if (hasNonEnglishChars) {
      console.log('[Language Filter] Non-English text detected, skipping pronunciation assessment:', text)
      return false
    }

    // Check if text has mostly English characters (letters, numbers, common punctuation)
    const englishChars = text.match(/[a-zA-Z0-9\s.,!?'"()-]/g)
    const ratio = englishChars ? englishChars.length / text.length : 0

    if (ratio < 0.7) {
      console.log('[Language Filter] Low English ratio, skipping pronunciation assessment:', text)
      return false
    }

    return true
  }

  const processTranscription = useCallback(
    async (blob: Blob) => {
      // Don't process if session is no longer active
      if (!isActiveRef.current) {
        console.log('[Transcription] Skipped - session inactive')
        return
      }

      try {
        const formData = new FormData()
        formData.append('audio', blob, 'speech.webm')

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        })

        let data: any = null
        try {
          data = await response.json()
        } catch {
          data = null
        }

        if (!response.ok || !data) {
          // Don't throw if session is inactive - just log silently
          if (!isActiveRef.current) {
            console.log('[Transcription] Failed but session ended - ignoring')
            return
          }

          const message =
            (data && typeof data.error === 'string' && data.error) ||
            `Transcription request failed (${response.status})`
          console.warn('[Transcription Warning]', message)
          return // Don't throw, just return
        }

        const text = typeof data.text === 'string' ? data.text.trim() : ''

        if (text && isActiveRef.current) {
          addTurn('user', text)
          addUserMessage(text)
          lastUserMessageRef.current = text

          // Only save audio segment for pronunciation assessment if it's English
          if (isLikelyEnglish(text)) {
            addAudioSegment(blob, text)
          }
        }
      } catch (err) {
        // Only log if session is still active
        if (isActiveRef.current) {
          console.error('[Transcription Error]', err)
        } else {
          console.log('[Transcription] Error during cleanup - ignoring')
        }
      }
    },
    [addTurn, addUserMessage, addAudioSegment]
  )

  const startRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') return

    audioChunksRef.current = []

    try {
      recorder.start()
      vadRef.current.recordingStartedAt = Date.now()
    } catch (error) {
      console.error('[MediaRecorder] start failed', error)
    }
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state !== 'recording') return

    try {
      recorder.stop()
    } catch (error) {
      console.error('[MediaRecorder] stop failed', error)
    }
  }, [])

  const setupMediaRecorder = useCallback(
    (stream: MediaStream) => {
      if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
        console.warn('[MediaRecorder] not supported in this environment')
        return
      }

      try {
        const options: MediaRecorderOptions = {}
        if (typeof MediaRecorder.isTypeSupported === 'function') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options.mimeType = 'audio/webm;codecs=opus'
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options.mimeType = 'audio/webm'
          }
        }

        const recorder = new MediaRecorder(stream, options)
        mediaRecorderRef.current = recorder

        recorder.addEventListener('dataavailable', (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        })

        recorder.addEventListener('stop', async () => {
          const chunks = audioChunksRef.current
          audioChunksRef.current = []

          const startedAt = vadRef.current.recordingStartedAt
          vadRef.current.recordingStartedAt = null

          if (!chunks.length) {
            return
          }

          if (startedAt && Date.now() - startedAt < MIN_UTTERANCE_MS) {
            return
          }

          const mimeType = recorder.mimeType || 'audio/webm'
          const blob = new Blob(chunks, { type: mimeType })

          await processTranscription(blob)
        })
      } catch (error) {
        console.error('[MediaRecorder] initialization failed', error)
        mediaRecorderRef.current = null
      }
    },
    [processTranscription]
  )

  const setupVoiceActivityDetection = useCallback(
    (stream: MediaStream) => {
      if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
        console.warn('[VAD] AudioContext not available')
        return
      }

      try {
        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 1024

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.fftSize)

        vadRef.current.audioContext = audioContext
        vadRef.current.analyser = analyser
        vadRef.current.dataArray = dataArray
        vadRef.current.rafId = null
        vadRef.current.speaking = false
        vadRef.current.silenceStartedAt = null
        vadRef.current.recordingStartedAt = null
        vadRef.current.speechConsistencyCount = 0

        const detect = () => {
          const { analyser, dataArray } = vadRef.current
          if (!analyser || !dataArray) {
            return
          }

          analyser.getByteTimeDomainData(dataArray as any)

          let sumSquares = 0
          for (let i = 0; i < dataArray.length; i++) {
            const value = (dataArray[i] - 128) / 128
            sumSquares += value * value
          }

          const rms = Math.sqrt(sumSquares / dataArray.length)
          const now = performance.now()

          if (rms > SPEECH_RMS_THRESHOLD) {
            vadRef.current.silenceStartedAt = null

            // Increment consistency count
            vadRef.current.speechConsistencyCount++

            // Only start recording if we've had consistent speech detection
            if (!vadRef.current.speaking && vadRef.current.speechConsistencyCount >= SPEECH_CONSISTENCY_CHECKS) {
              vadRef.current.speaking = true
              startRecording()
            }
          } else {
            // Reset consistency count when no speech detected
            vadRef.current.speechConsistencyCount = 0

            if (vadRef.current.speaking) {
              if (vadRef.current.silenceStartedAt === null) {
                vadRef.current.silenceStartedAt = now
              } else if (now - vadRef.current.silenceStartedAt > SILENCE_DURATION_MS) {
                vadRef.current.speaking = false
                vadRef.current.silenceStartedAt = null
                stopRecording()
              }
            }
          }

          vadRef.current.rafId = requestAnimationFrame(detect)
        }

        vadRef.current.rafId = requestAnimationFrame(detect)
      } catch (error) {
        console.error('[VAD] initialization failed', error)
      }
    },
    [startRecording, stopRecording]
  )

  const teardownVoiceActivityDetection = useCallback(() => {
    if (vadRef.current.rafId !== null) {
      cancelAnimationFrame(vadRef.current.rafId)
      vadRef.current.rafId = null
    }

    const context = vadRef.current.audioContext
    if (context) {
      context.close().catch(() => null)
    }

    vadRef.current.audioContext = null
    vadRef.current.analyser = null
    vadRef.current.dataArray = null
    vadRef.current.speaking = false
    vadRef.current.silenceStartedAt = null
    vadRef.current.recordingStartedAt = null
    vadRef.current.speechConsistencyCount = 0
  }, [])

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
          // Response started - tutor is speaking
          case 'response.created':
          case 'response.started': {
            setIsTutorSpeaking(true)
            break
          }

          // ONLY capture audio transcript deltas (what was actually spoken)
          case 'response.audio_transcript.delta': {
            const chunk = extractDeltaText(event.delta)
            if (chunk) {
              console.log('[Audio Transcript Delta]', chunk)
              bufferRef.current += chunk
            }
            break
          }

          // ONLY capture audio transcript completion (what was actually spoken)
          case 'response.audio_transcript.done': {
            if (bufferRef.current.trim()) {
              const message = bufferRef.current.trim()
              console.log('[Audio Transcript Complete]', message)
              addTurn('tutor', message)
              addTutorMessage(message)

              // Parse and store corrections if detected (only for English user messages)
              if (containsCorrection(message) && lastUserMessageRef.current && isLikelyEnglish(lastUserMessageRef.current)) {
                const detectedCorrections = parseCorrections(message, lastUserMessageRef.current)
                detectedCorrections.forEach((correction) => {
                  console.log('[Correction Detected]', correction)
                  addCorrection(correction)
                })
              } else if (containsCorrection(message) && lastUserMessageRef.current && !isLikelyEnglish(lastUserMessageRef.current)) {
                console.log('[Correction Filter] Skipping correction for non-English text:', lastUserMessageRef.current)
              }

              bufferRef.current = ''
            }
            break
          }

          // Response fully completed - stop speaking indicator
          case 'response.done':
          case 'response.completed': {
            setIsTutorSpeaking(false)
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

          // User speech transcription event from Realtime API
          case 'conversation.item.input_audio_transcription.completed': {
            const transcript =
              typeof event.transcript === 'string'
                ? event.transcript
                : typeof event.text === 'string'
                ? event.text
                : ''

            if (transcript) {
              lastUserMessageRef.current = transcript.trim()
            }
            break
          }

          // Function calls (from Realtime API tools)
          case 'response.function_call_arguments.done': {
            console.log('[Function Call]', event)
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
      // Prevent multiple simultaneous connections
      if (peerRef.current) {
        console.warn('[Start] Connection already exists, cannot start new one')
        return
      }

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

      setupMediaRecorder(stream)
      setupVoiceActivityDetection(stream)

      // 2. Create session via backend (get ephemeral token)
      console.log('[2/6] Creating session...')
      console.log('[Realtime] Sending feedback context length:', config.feedbackContext?.length || 0)
      const response = await fetch('/api/realtime-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: config.userId,
          sessionId: config.sessionId,
          feedbackContext: config.feedbackContext,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Realtime Token] API error:', response.status, errorData)
        throw new Error(errorData.error || `Failed to create session (${response.status})`)
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

      // Handle incoming audio - ONLY create one audio element
      peer.ontrack = (event) => {
        console.log('[Audio Track]', event.track.kind, event.streams.length)

        // Only handle audio tracks, ignore any other tracks
        if (event.track.kind !== 'audio') {
          console.log('[Skipping non-audio track]', event.track.kind)
          return
        }

        // If we already have an audio element, just update its stream
        if (audioElementRef.current) {
          console.log('[Reusing existing audio element]')
          const [remoteStream] = event.streams
          audioElementRef.current.srcObject = remoteStream
          return
        }

        // Create single audio element only once
        console.log('[Creating new audio element]')
        const [remoteStream] = event.streams
        const audioElement = document.createElement('audio')
        audioElement.autoplay = true
        audioElement.srcObject = remoteStream
        document.body.appendChild(audioElement)
        audioElementRef.current = audioElement
      }

      // 4. Create data channel for text
      console.log('[4/6] Creating data channel...')
      const channel = peer.createDataChannel('oai-events')
      channelRef.current = channel

      channel.addEventListener('open', () => {
        console.log('[Data Channel] Opened')
        setStatus('connected')
        isActiveRef.current = true // Mark session as active

        // Send session configuration with stricter VAD settings
        const sessionConfig = {
          type: 'session.update',
          session: {
            instructions: prompt,
            modalities: ['text', 'audio'],
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.9, // Much higher = only pick up close/loud speech (default 0.5)
              prefix_padding_ms: 300,
              silence_duration_ms: 1200, // Longer silence required to end turn
            },
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
        isActiveRef.current = false // Mark as inactive when channel closes
        setStatus('disconnected')
      })

      channel.addEventListener('error', (err) => {
        console.error('[Data Channel Error]', err)
        isActiveRef.current = false // Mark as inactive on error
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
      isActiveRef.current = false // Mark as inactive on error
      cleanup()
    }
  }, [handleRealtimeEvent, setupMediaRecorder, setupVoiceActivityDetection])

  // Send text message via data channel
  const sendText = useCallback(async (message: string) => {
    if (!message.trim()) {
      return
    }

    const channel = channelRef.current
    if (!channel || channel.readyState !== 'open') {
      throw new Error('Connection is not ready')
    }

    // Store user's message for correction parsing
    lastUserMessageRef.current = message

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
    // Mark session as inactive to prevent processing in-flight transcriptions
    isActiveRef.current = false

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

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null
      audioElementRef.current.remove()
      audioElementRef.current = null
    }

    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current
      if (recorder.state === 'recording') {
        try {
          recorder.stop()
        } catch (error) {
          console.error('[MediaRecorder] cleanup stop failed', error)
        }
      }
      mediaRecorderRef.current = null
    }

    audioChunksRef.current = []
    teardownVoiceActivityDetection()

    setMicActive(false)
    bufferRef.current = ''

    // Note: Don't clear pronunciation store here - we need it for post-session assessment
    // It will be cleared when a new session starts
  }, [teardownVoiceActivityDetection])

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
    isTutorSpeaking,
    start,
    sendText,
    stop,
  }
}
