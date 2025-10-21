'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Phase 2: Audio Visualizer
 *
 * Shows waveform visualization during voice conversation.
 * Uses Web Audio API to analyze microphone input.
 */
export function AudioVisualizer({ isActive }: { isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const animationRef = useRef<number>()

  useEffect(() => {
    if (isActive && !audioContext) {
      initAudio()
    }

    if (!isActive && audioContext) {
      cleanup()
    }

    return () => {
      cleanup()
    }
  }, [isActive])

  const initAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const analyserNode = ctx.createAnalyser()
      analyserNode.fftSize = 256

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyserNode)

      setAudioContext(ctx)
      setAnalyser(analyserNode)

      // Start visualization
      visualize(analyserNode)
    } catch (error) {
      console.error('Failed to access microphone:', error)
    }
  }

  const cleanup = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (audioContext) {
      audioContext.close()
      setAudioContext(null)
    }
    setAnalyser(null)
  }

  const visualize = (analyserNode: AnalyserNode) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw)

      analyserNode.getByteFrequencyData(dataArray)

      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height

        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height)
        gradient.addColorStop(0, '#8b5cf6')
        gradient.addColorStop(1, '#3b82f6')

        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)

        x += barWidth + 1
      }
    }

    draw()
  }

  if (!isActive) return null

  return (
    <div className="fixed bottom-24 right-6 w-64 h-24 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-2">
      <canvas
        ref={canvasRef}
        width={240}
        height={80}
        className="w-full h-full"
      />
    </div>
  )
}
