/**
 * Audio conversion utilities for Azure Speech SDK compatibility
 * Azure Speech SDK supports: WAV (PCM), Opus (in OGG), MP3, FLAC, etc.
 * WebM is NOT supported, so we need to convert it to WAV
 */

/**
 * Convert audio blob to 16kHz mono WAV format for Azure Speech SDK
 * Azure expects: 16kHz sample rate, 16-bit PCM, mono channel
 */
export async function convertToWav(blob: Blob): Promise<Blob> {
  try {
    console.log('[Audio Converter] Converting audio to 16kHz WAV format...', {
      originalType: blob.type,
      originalSize: blob.size,
    })

    // Create audio context with 16kHz sample rate (Azure requirement)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    })

    // Read blob as array buffer
    const arrayBuffer = await blob.arrayBuffer()
    console.log('[Audio Converter] ArrayBuffer size:', arrayBuffer.byteLength)

    // Decode audio data
    console.log('[Audio Converter] Decoding audio data...')
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    console.log('[Audio Converter] Decode successful')

    console.log('[Audio Converter] Audio decoded:', {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
    })

    // Resample to 16kHz if needed and convert to mono
    const resampled = await resampleTo16kHzMono(audioBuffer, audioContext)

    console.log('[Audio Converter] Resampled to 16kHz mono:', {
      duration: resampled.duration,
      sampleRate: resampled.sampleRate,
      channels: resampled.numberOfChannels,
    })

    // Convert to WAV
    const wavBlob = await audioBufferToWav(resampled)

    console.log('[Audio Converter] Conversion complete:', {
      wavSize: wavBlob.size,
      wavType: wavBlob.type,
    })

    // Clean up
    await audioContext.close()

    return wavBlob
  } catch (error) {
    console.error('[Audio Converter] Conversion failed:', error)
    throw new Error(`Failed to convert audio to WAV: ${error}`)
  }
}

/**
 * Resample audio to 16kHz mono for Azure compatibility
 */
async function resampleTo16kHzMono(
  audioBuffer: AudioBuffer,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const targetSampleRate = 16000
  const targetChannels = 1

  // If already correct format, return as-is
  if (audioBuffer.sampleRate === targetSampleRate && audioBuffer.numberOfChannels === targetChannels) {
    return audioBuffer
  }

  // Create offline context for resampling
  const offlineContext = new OfflineAudioContext(
    targetChannels,
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  )

  // Create buffer source
  const source = offlineContext.createBufferSource()
  source.buffer = audioBuffer

  // Connect to destination
  source.connect(offlineContext.destination)
  source.start(0)

  // Render
  return await offlineContext.startRendering()
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  // Get audio data
  const channelData: Float32Array[] = []
  for (let i = 0; i < numberOfChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i))
  }

  // Interleave channels
  const interleaved = interleaveChannels(channelData)

  // Convert to 16-bit PCM
  const pcmData = floatTo16BitPCM(interleaved)

  // Create WAV file
  const wavBuffer = createWavFile(pcmData, sampleRate, numberOfChannels, bitDepth)

  return new Blob([wavBuffer], { type: 'audio/wav' })
}

/**
 * Interleave multiple audio channels
 */
function interleaveChannels(channels: Float32Array[]): Float32Array {
  const length = channels[0].length
  const numberOfChannels = channels.length
  const interleaved = new Float32Array(length * numberOfChannels)

  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      interleaved[i * numberOfChannels + channel] = channels[channel][i]
    }
  }

  return interleaved
}

/**
 * Convert float samples to 16-bit PCM
 */
function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16Array
}

/**
 * Create WAV file from PCM data
 */
function createWavFile(
  pcmData: Int16Array,
  sampleRate: number,
  numberOfChannels: number,
  bitDepth: number
): ArrayBuffer {
  const bytesPerSample = bitDepth / 8
  const blockAlign = numberOfChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = pcmData.length * bytesPerSample
  const bufferSize = 44 + dataSize

  const buffer = new ArrayBuffer(bufferSize)
  const view = new DataView(buffer)

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // audio format (1 = PCM)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  // data sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Write PCM samples
  let offset = 44
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(offset, pcmData[i], true)
    offset += 2
  }

  return buffer
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
