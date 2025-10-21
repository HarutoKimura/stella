# 🎤 OpenAI Realtime Implementation - Complete Guide

## Overview

The Stella AI English Tutor now uses **OpenAI's Realtime API** (`gpt-realtime-mini-2025-10-06`) for ALL conversations - both voice and text. This provides:

- ✅ **Simultaneous voice + text input**
- ✅ **AI responds with both audio and text**
- ✅ **Low-latency WebRTC connection**
- ✅ **Unified conversational experience**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  useRealtime Hook                                      │ │
│  │  ├─ WebRTC PeerConnection (audio streaming)           │ │
│  │  ├─ RTCDataChannel (text messages)                    │ │
│  │  └─ Event handlers (transcript updates)               │ │
│  └────────────────────────────────────────────────────────┘ │
│                  ↕ WebRTC + Data Channel                     │
└─────────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────────┐
│            OpenAI Realtime API (WebRTC Endpoint)             │
│  Model: gpt-realtime-mini-2025-10-06                        │
│  - Bidirectional audio streaming                            │
│  - Text messaging via data channel                          │
│  - Real-time transcription                                  │
│  - Simultaneous modalities                                  │
└─────────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────────┐
│              Backend (Next.js API Routes)                    │
│  /api/realtime-token → Ephemeral token + session config    │
│  /api/planner → Lesson planning (gpt-5-nano)               │
│  /api/summarize → Save session metrics                     │
└─────────────────────────────────────────────────────────────┘
```

## Model Usage

### gpt-realtime-mini-2025-10-06
- **Purpose**: ALL real-time conversations (voice + text)
- **When**: User is in `/free_conversation` page
- **How**: WebRTC connection + data channel
- **Cost**: Usage-based (per minute of audio/text)

### gpt-5-nano-2025-08-07
- **Purpose**: ONLY lesson planning
- **When**: Generating micro-packs in `/api/planner`
- **How**: Standard Chat Completions API
- **Cost**: Per token

## Implementation Details

### 1. Session Initialization

**File**: `app/api/realtime-token/route.ts`

```typescript
// POST /api/realtime-token
// Returns: { token, model, prompt, activeTargets }

const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-realtime-mini-2025-10-06',
    voice: 'alloy',
    instructions: systemPrompt,
    modalities: ['text', 'audio'],  // BOTH enabled
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
  }),
})
```

### 2. WebRTC Connection

**File**: `lib/useRealtime.ts`

```typescript
// 1. Request microphone access
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1,
    sampleRate: 16000,
  },
  video: false,
})

// 2. Create peer connection
const peer = new RTCPeerConnection()
stream.getTracks().forEach((track) => peer.addTrack(track, stream))

// 3. Handle incoming audio
peer.ontrack = (event) => {
  const [remoteStream] = event.streams
  const audioElement = document.createElement('audio')
  audioElement.autoplay = true
  audioElement.srcObject = remoteStream
  document.body.appendChild(audioElement)
}

// 4. Create data channel for text
const channel = peer.createDataChannel('oai-events')

// 5. Negotiate SDP
const offer = await peer.createOffer()
await peer.setLocalDescription(offer)

const sdpResponse = await fetch(
  `https://api.openai.com/v1/realtime?model=gpt-realtime-mini-2025-10-06`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ephemeralToken}`,
      'Content-Type': 'application/sdp',
      'OpenAI-Beta': 'realtime=v1',
    },
    body: offer.sdp,
  }
)

await peer.setRemoteDescription({
  type: 'answer',
  sdp: await sdpResponse.text(),
})
```

### 3. Sending Text Messages

**File**: `lib/useRealtime.ts` (lines 241-278)

```typescript
const sendText = async (message: string) => {
  // Add to transcript (optimistic update)
  addTurn('user', message)

  // Send to OpenAI via data channel
  const packets = [
    {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: message }],
      },
    },
    {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],  // Request both
        instructions: 'Continue tutoring naturally.',
      },
    },
  ]

  packets.forEach((packet) => {
    channel.send(JSON.stringify(packet))
  })
}
```

### 4. Receiving Responses

**File**: `lib/useRealtime.ts` (lines 73-119)

```typescript
const handleRealtimeEvent = (raw: string) => {
  const events = JSON.parse(raw)
  const eventList = Array.isArray(events) ? events : [events]

  eventList.forEach((event) => {
    switch (event.type) {
      // Text deltas (streaming)
      case 'response.delta':
      case 'response.text.delta':
      case 'response.audio_transcript.delta':
      case 'response.output_text.delta': {
        const chunk = extractDeltaText(event.delta)
        if (chunk) {
          buffer += chunk
        }
        break
      }

      // Response complete
      case 'response.completed':
      case 'response.text.done':
      case 'response.audio_transcript.done':
      case 'response.output_text.done': {
        if (buffer.trim()) {
          addTurn('tutor', buffer.trim())
          buffer = ''
        }
        break
      }

      // Errors
      case 'response.error':
      case 'error': {
        const message = event.error?.message ?? 'Realtime error'
        setError(message)
        break
      }
    }
  })
}

// Audio plays automatically via WebRTC (peer.ontrack)
```

### 5. UI Integration

**File**: `app/free_conversation/page.tsx`

```typescript
export default function FreeConversationPage() {
  const { status, error, micActive, start, sendText, stop } = useRealtime()

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      // 1. Create DB session + get targets from planner
      // 2. Start WebRTC connection
      await start({ userId, sessionId })
    }
    initSession()
  }, [])

  // Send text via data channel
  const handleSend = async (e) => {
    e.preventDefault()
    await sendText(input)
    setInput('')
  }

  return (
    <div>
      {/* Connection status */}
      <div>
        Status: {status}
        {micActive && '🎤 Voice + Text'}
      </div>

      {/* Transcript */}
      <TranscriptPane />

      {/* Text input (always available) */}
      <form onSubmit={handleSend}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            micActive
              ? 'Speak freely or type here...'
              : 'Type to chat (mic off)'
          }
          disabled={status !== 'connected'}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
```

## User Experience

### Voice Input (Speaking)
1. Microphone captures audio automatically
2. Audio streams to OpenAI via WebRTC
3. AI processes speech in real-time
4. AI responds with voice (audio plays automatically)
5. Transcript appears in text form

### Text Input (Typing)
1. User types message in input box
2. Message sent via data channel
3. AI receives text and responds
4. AI response includes both audio + text
5. Transcript updated immediately

### Simultaneous Modes
- User can **speak OR type at any time**
- AI always responds with **both voice and text**
- Seamless switching between input methods

## Connection States

| State | Description | UI Indicator |
|-------|-------------|--------------|
| `idle` | Not connected | Gray dot |
| `connecting` | Establishing connection | Yellow dot (pulsing) |
| `connected` | Ready for communication | Green dot (pulsing) |
| `error` | Connection failed | Red dot |
| `disconnected` | Session ended | Gray dot |

## Event Flow

```
User speaks → Audio via WebRTC → OpenAI processes
                                    ↓
                              AI generates response
                                    ↓
                    Audio via WebRTC + Text via data channel
                                    ↓
                          Browser receives both
                                    ↓
                    Audio plays + Text shows in transcript
```

## Key Features

### 1. Automatic Audio Streaming
- Microphone audio flows continuously
- No manual start/stop needed
- VAD (Voice Activity Detection) handled by OpenAI

### 2. Text Messaging Anytime
- Input box always available
- Send text even while speaking
- AI responds appropriately to both

### 3. Unified Transcript
- All turns (voice + text) appear in same transcript
- Real-time updates as AI speaks/writes
- Persistent across session

### 4. Low Latency
- WebRTC peer-to-peer connection
- No server relay for audio
- ~200-300ms response time

## Error Handling

### Common Errors

**1. Microphone Permission Denied**
```typescript
// Fallback: Text-only mode
if (error.name === 'NotAllowedError') {
  setMicActive(false)
  // Continue with text-only
}
```

**2. Network Disruption**
```typescript
peer.oniceconnectionstatechange = () => {
  if (peer.iceConnectionState === 'failed') {
    // Attempt reconnection
    await start(config)
  }
}
```

**3. Token Expiration**
```typescript
// Ephemeral tokens expire after ~60 minutes
// Client should request new token if needed
if (error.code === 'token_expired') {
  const newToken = await fetch('/api/realtime-token')
  // Reconnect with new token
}
```

## Performance Optimization

### 1. Audio Quality
- **Sample rate**: 16kHz (optimal for speech)
- **Format**: PCM16 (lossless)
- **Channels**: Mono (1 channel)

### 2. Connection Reuse
- Keep WebRTC connection alive for entire session
- Only close when user explicitly ends session
- Avoid reconnection overhead

### 3. Buffering
- Text responses buffered until complete
- Prevents partial message display
- Cleaner transcript

## Testing

### Manual Testing Checklist

**Connection:**
- [ ] Microphone permission requested on session start
- [ ] Green dot appears when connected
- [ ] Audio indicator shows "🎤 Voice + Text"

**Voice Input:**
- [ ] Speak into microphone
- [ ] AI responds with voice (audio plays)
- [ ] Transcript shows both user speech and AI response

**Text Input:**
- [ ] Type message and press Enter
- [ ] AI responds with voice + text
- [ ] Transcript updates correctly

**Error Handling:**
- [ ] Deny microphone → Text-only mode works
- [ ] Network disconnect → Error message appears
- [ ] Reconnect → Session resumes

**Session End:**
- [ ] Type "stop" → Connection closes
- [ ] Data saved to database
- [ ] Redirect to home page

## Debugging

### Enable Console Logs

The `useRealtime` hook includes detailed logging:

```typescript
console.log('[1/6] Requesting microphone access...')
console.log('[2/6] Creating session...')
console.log('[3/6] Setting up WebRTC...')
console.log('[4/6] Creating data channel...')
console.log('[5/6] Negotiating connection...')
console.log('[6/6] Connection established!')
console.log('[Realtime Event]', event.type, event)
```

### Check WebRTC Stats

```javascript
// In browser console
const peer = peerRef.current
if (peer) {
  const stats = await peer.getStats()
  console.log('WebRTC Stats:', stats)
}
```

### Verify Data Channel

```javascript
const channel = channelRef.current
console.log('Channel state:', channel?.readyState)
console.log('Channel buffered amount:', channel?.bufferedAmount)
```

## Cost Estimation

### Realtime API Pricing (Estimated)

- **Audio streaming**: ~$0.06/minute
- **Text messages**: Minimal (included in session)
- **Total for 10-min session**: ~$0.60

### Comparison with Old Architecture

| Feature | Old (Text API) | New (Realtime API) |
|---------|----------------|-------------------|
| Text conversations | $0.01/session | $0.60/session |
| Voice support | ❌ Not available | ✅ Included |
| Latency | ~500ms | ~200ms |
| User experience | Text only | Voice + Text |

**Recommendation**: Offer voice as premium feature or limit session duration.

## Troubleshooting

### Issue: No audio playing

**Solution:**
1. Check browser console for errors
2. Verify `peer.ontrack` event fires
3. Ensure audio element is created and appended
4. Check browser audio permissions

### Issue: Text not sending

**Solution:**
1. Check data channel state: `channel.readyState === 'open'`
2. Verify connection status: `status === 'connected'`
3. Check console for data channel errors

### Issue: Connection fails

**Solution:**
1. Verify OpenAI API key is valid
2. Check `/api/realtime-token` returns 200
3. Ensure HTTPS (required for WebRTC)
4. Check firewall/network settings

## Future Enhancements

1. **Voice Activity Detection (VAD)** - Only send audio when speaking
2. **Multiple Voices** - Let users choose tutor voice
3. **Audio Visualization** - Show waveform during speaking
4. **Session Recording** - Save audio for playback
5. **Pronunciation Analysis** - Real-time pronunciation feedback

---

## Summary

The new implementation provides a **unified conversational experience**:

- ✅ Single `useRealtime` hook manages everything
- ✅ Simultaneous voice + text input
- ✅ Low-latency WebRTC connection
- ✅ AI responds with both modalities
- ✅ Seamless user experience

**Next Steps**: Test with real users and gather feedback!

---

**Documentation**: https://platform.openai.com/docs/models/gpt-realtime-mini
**Support**: See main README.md for setup instructions
