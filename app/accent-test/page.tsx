'use client'

import { OrbBG } from '@/components/OrbBG'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { AccentTestResult } from '@/components/AccentTestResult'
import { convertToWav } from '@/lib/audioConverter'

type TestState = 'idle' | 'recording' | 'uploading' | 'analyzing' | 'completed'

interface AccentTestResults {
  test_id: string
  egi_score: number
  cefr_level: string
  scores: {
    pronunciation: number
    fluency: number
    grammar: number
    vocabulary: number
    confidence: number
  }
  recognized_text: string
  feedback: {
    strengths: string[]
    improvements: string[]
    next_steps: string
  }
  semantic_feedback?: Array<{
    category: string
    original: string
    corrected: string
    tip: string
    explanation: string
    severity: string
  }>
}

export default function AccentTestPage() {
  const [testState, setTestState] = useState<TestState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<AccentTestResults | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    setIsAuthenticated(true)
  }

  const startRecording = async () => {
    try {
      setError(null)
      audioChunksRef.current = []
      setRecordingTime(0)

      // Request microphone permission with specific constraints for better quality
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono
          sampleRate: 16000, // 16kHz is optimal for speech recognition
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Try to use the best available audio format for Azure Speech
      let mimeType = 'audio/webm;codecs=opus' // Default to Opus codec
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
        console.log('[Recording] Using WebM with Opus codec')
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
        console.log('[Recording] Using OGG with Opus codec')
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
        console.log('[Recording] Using WebM default codec')
      } else {
        console.warn('[Recording] No optimal codec found, using browser default')
      }

      const options = { mimeType }
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      console.log('[Recording] MediaRecorder created with:', {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        handleRecordingComplete()
      }

      // Start recording
      mediaRecorder.start()
      setTestState('recording')

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1
          // Auto-stop at 20 seconds
          if (newTime >= 20) {
            stopRecording()
          }
          return newTime
        })
      }, 1000)
    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Could not access microphone. Please check your permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && testState === 'recording') {
      mediaRecorderRef.current.stop()
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setTestState('uploading')
    }
  }

  const handleRecordingComplete = async () => {
    try {
      if (audioChunksRef.current.length === 0) {
        setError('No audio recorded. Please try again.')
        setTestState('idle')
        return
      }

      const recorder = mediaRecorderRef.current
      if (!recorder) {
        setError('Recording error. Please try again.')
        setTestState('idle')
        return
      }

      // Get the actual MIME type used by the recorder
      const mimeType = recorder.mimeType || 'audio/webm'
      console.log('[Processing] Creating blob with MIME type:', mimeType)

      // Create blob from recorded audio with correct MIME type
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })

      console.log('[Processing] Audio blob created:', {
        size: audioBlob.size,
        type: audioBlob.type,
        chunks: audioChunksRef.current.length
      })

      // Check minimum audio size (at least 10KB for meaningful audio)
      if (audioBlob.size < 10000) {
        setError('Recording too short or empty. Please speak for at least 5 seconds.')
        setTestState('idle')
        return
      }

      // Convert to WAV format for Azure Speech SDK compatibility
      console.log('[Processing] Converting to WAV format...')
      setTestState('uploading')

      const wavBlob = await convertToWav(audioBlob)

      console.log('[Processing] WAV conversion complete:', {
        originalSize: audioBlob.size,
        wavSize: wavBlob.size,
        wavType: wavBlob.type
      })

      const formData = new FormData()
      formData.append('audio', wavBlob, 'recording.wav')

      setTestState('analyzing')

      // Send to API
      const response = await fetch('/api/accent-test', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze speech')
      }

      const data = await response.json()
      setResults(data)
      setTestState('completed')
    } catch (err) {
      console.error('Error processing recording:', err)
      setError(err instanceof Error ? err.message : 'Failed to process recording')
      setTestState('idle')
    }
  }

  const resetTest = () => {
    setTestState('idle')
    setResults(null)
    setError(null)
    setRecordingTime(0)
    audioChunksRef.current = []
  }

  if (!isAuthenticated) {
    return (
      <OrbBG>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </OrbBG>
    )
  }

  if (testState === 'completed' && results) {
    return (
      <OrbBG>
        <div className="min-h-screen p-8">
          <AccentTestResult results={results} onRetake={resetTest} />
        </div>
      </OrbBG>
    )
  }

  return (
    <OrbBG>
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        {/* Header */}
        <div className="text-center mb-12 max-w-2xl">
          <h1 className="text-5xl font-bold text-white mb-4">
            AI Accent Test
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Speak naturally for 10-20 seconds
          </p>
          <p className="text-sm text-gray-400">
            We'll analyze your pronunciation, fluency, grammar, and vocabulary
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-lg w-full">
          {/* Recording Instructions */}
          {testState === 'idle' && (
            <div className="text-center">
              <div className="text-6xl mb-6">🎤</div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Ready to begin?
              </h2>
              <p className="text-gray-300 mb-6 text-sm">
                Tips for best results:
              </p>
              <ul className="text-left text-gray-300 text-sm mb-8 space-y-2">
                <li>• Find a quiet environment</li>
                <li>• Speak clearly and naturally</li>
                <li>• Talk about any topic you like</li>
                <li>• Aim for 10-20 seconds of speech</li>
              </ul>
              <button
                onClick={startRecording}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full transition-colors"
              >
                Start Recording
              </button>
            </div>
          )}

          {/* Recording State */}
          {testState === 'recording' && (
            <div className="text-center">
              <div className="relative mb-8">
                <div className="text-6xl animate-pulse">🎙️</div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 border-4 border-red-500 rounded-full animate-ping opacity-20" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Recording...
              </h2>
              <div className="text-5xl font-mono text-blue-400 mb-6">
                {recordingTime}s
              </div>
              <p className="text-gray-300 mb-6 text-sm">
                Speak naturally about any topic
              </p>
              <button
                onClick={stopRecording}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-full transition-colors"
              >
                Stop Recording
              </button>
            </div>
          )}

          {/* Uploading State */}
          {testState === 'uploading' && (
            <div className="text-center">
              <div className="text-6xl mb-6 animate-bounce">📤</div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Uploading...
              </h2>
              <p className="text-gray-300 text-sm">
                Preparing your audio for analysis
              </p>
            </div>
          )}

          {/* Analyzing State */}
          {testState === 'analyzing' && (
            <div className="text-center">
              <div className="text-6xl mb-6 animate-spin">🧠</div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Analyzing your speech...
              </h2>
              <p className="text-gray-300 text-sm mb-4">
                Our AI is evaluating your:
              </p>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>✓ Pronunciation accuracy</li>
                <li>✓ Fluency and rhythm</li>
                <li>✓ Grammar usage</li>
                <li>✓ Vocabulary richness</li>
              </ul>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-200 text-sm">{error}</p>
              <button
                onClick={resetTest}
                className="mt-4 text-white underline text-sm"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.push('/home')}
          className="mt-8 text-gray-400 hover:text-white transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    </OrbBG>
  )
}
