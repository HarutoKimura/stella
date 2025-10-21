# Phase 2: OpenAI Realtime API Integration Guide

This document provides step-by-step instructions for implementing voice mode in the Stella AI English Tutor.

## Overview

The codebase is **already structured** for Phase 2. All necessary scaffolding exists:
- Voice client wrapper (`lib/realtimeVoiceClient.ts`)
- Intent parser for voice (`lib/voiceIntentParser.ts`)
- Audio metrics calculator (`lib/audioMetrics.ts`)
- UI components (`VoiceControl`, `AudioVisualizer`)
- API routes with stubs (`/api/realtime-token`, `/api/realtime-session`)

**What's needed:** Complete the `TODO Phase 2` sections with actual OpenAI Realtime API SDK calls.

---

## Step 1: Get OpenAI Realtime API Access

1. **Check Model Access**
   - Visit https://platform.openai.com/
   - Ensure you have access to `gpt-realtime-mini-2025-10-06` model
   - See: https://platform.openai.com/docs/models/gpt-realtime-mini

2. **Verify API Key**
   - Your existing `OPENAI_API_KEY` in `.env.local` should work
   - No additional keys needed

---

## Step 2: Implement Ephemeral Token Generation

### File: `app/api/realtime-token/route.ts`

**Current State:** Returns 501 (Not Implemented)

**Implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabaseServer'

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Request ephemeral token from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-realtime-mini-2025-10-06',
        voice: 'alloy',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('OpenAI API error:', error)
      throw new Error('Failed to create realtime session')
    }

    const data = await response.json()

    return NextResponse.json({
      token: data.client_secret.value,
      expires_at: data.client_secret.expires_at,
    })
  } catch (error) {
    console.error('Realtime token error:', error)
    return NextResponse.json(
      { error: 'Failed to generate realtime token' },
      { status: 500 }
    )
  }
}
```

**Test:**
```bash
curl http://localhost:3000/api/realtime-token \
  -H "Cookie: sb-access-token=..." \
  -H "Cookie: sb-refresh-token=..."

# Expected output:
# {
#   "token": "ek_...",
#   "expires_at": 1234567890
# }
```

---

## Step 3: Complete RealtimeVoiceClient

### File: `lib/realtimeVoiceClient.ts`

**Current State:** Skeleton with TODO comments

**Implementation:**

#### 3.1 Update Connect Method

```typescript
async connect(token: string, instructions: string, functions: any[]) {
  try {
    // Create agent with instructions
    this.agent = new RealtimeAgent({
      name: 'Tutor',
      instructions,
    })

    // Add function definitions
    for (const func of functions) {
      this.agent.addFunction(
        func.name,
        func.description,
        func.parameters,
        async (args: any) => {
          this.handleFunctionCall(func.name, args)
          return { status: 'success' } // Return value for the model
        }
      )
    }

    // Create session
    this.session = new RealtimeSession(this.agent, {
      model: 'gpt-realtime-mini-2025-10-06',
    })

    // Connect with ephemeral token
    await this.session.connect({
      apiKey: token,
    })

    this.isConnected = true
    this.emit('connected')

    // Setup event listeners
    this.setupEventListeners()
  } catch (error) {
    console.error('Failed to connect to Realtime API:', error)
    this.emit('error', error as Error)
    throw error
  }
}
```

#### 3.2 Update setupEventListeners Method

```typescript
private setupEventListeners() {
  if (!this.session) return

  // User speech transcription
  this.session.on('input_audio_transcript', (data: any) => {
    if (data.transcript) {
      this.emit('transcript', data.transcript, 'user')
    }
  })

  // Tutor response (text)
  this.session.on('response_audio_transcript', (data: any) => {
    if (data.transcript) {
      this.emit('transcript', data.transcript, 'tutor')
    }
  })

  // Tutor response (audio done)
  this.session.on('response_audio_done', (data: any) => {
    if (data.transcript) {
      this.emit('response', data.transcript)
    }
  })

  // Function calls
  this.session.on('response_function_call', (data: any) => {
    this.handleFunctionCall(data.name, data.arguments)
  })

  // Error handling
  this.session.on('error', (error: any) => {
    console.error('Session error:', error)
    this.emit('error', error)
  })

  // Connection state
  this.session.on('disconnected', () => {
    this.isConnected = false
    this.emit('disconnected')
  })
}
```

#### 3.3 Update Disconnect Method

```typescript
async disconnect() {
  if (this.session) {
    try {
      await this.session.disconnect()
    } catch (error) {
      console.error('Error disconnecting:', error)
    }
    this.session = null
  }
  this.agent = null
  this.isConnected = false
  this.emit('disconnected')
}
```

**Note:** Exact event names may differ. Consult the official @openai/agents SDK documentation:
https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/

---

## Step 4: Enable Voice UI Components

### File: `app/free_conversation/page.tsx`

Add voice controls to the conversation page:

```typescript
import { VoiceControl } from '@/components/VoiceControl'
import { AudioVisualizer } from '@/components/AudioVisualizer'

export default function FreeConversationPage() {
  const isVoiceMode = useSessionStore((state) => state.isVoiceMode)

  return (
    <OrbBG>
      <IntentCaption />

      {/* Existing content... */}

      {/* Add voice controls */}
      <VoiceControl />
      <AudioVisualizer isActive={isVoiceMode} />
    </OrbBG>
  )
}
```

---

## Step 5: Test Voice Mode

### 5.1 Start Development Server

```bash
pnpm dev
```

### 5.2 Test Flow

1. **Login** → Navigate to `/login`, create account
2. **Start Session** → Type "start" or click "Start Session"
3. **Enable Voice** → Click floating "Enable Voice" button (bottom right)
4. **Grant Mic Permission** → Allow microphone access when prompted
5. **Speak** → Say something like:
   ```
   "I want to reach out to my team tomorrow"
   ```
6. **Listen** → AI tutor responds with voice
7. **Check Transcript** → Verify text appears in TranscriptPane
8. **Use Target Phrase** → Say a target phrase correctly
9. **Verify Tracking** → Check TargetsPanel marks it as "Used"
10. **End Session** → Say "stop" or "end"
11. **Check Metrics** → Navigate to `/user_profile`, verify fluency data

### 5.3 Debugging Tips

**If voice doesn't work:**

- Check browser console for errors
- Verify `/api/realtime-token` returns 200 (not 501)
- Check microphone permissions in browser settings
- Ensure OpenAI API key has Realtime API access

**If transcript is empty:**

- Check `setupEventListeners()` event names match SDK docs
- Verify `emit('transcript', ...)` is being called
- Look for console errors in voiceClient

**If function calls don't work:**

- Check function definitions in `/api/realtime-session`
- Verify `handleFunctionCall()` is correctly mapping names
- Test with simple function first (e.g., `end_session`)

---

## Step 6: Advanced Features

### 6.1 Audio Interruption Handling

Allow user to interrupt tutor mid-speech:

```typescript
// In VoiceControl.tsx
const handleInterrupt = () => {
  const client = getVoiceClient()
  // TODO: Implement session.interrupt() if SDK supports it
}
```

### 6.2 Voice Selection

Let users choose voice (alloy, echo, fable, onyx, nova, shimmer):

```typescript
// In user_profile page, add voice selector
const [voice, setVoice] = useState('alloy')

// Pass to realtime-session config
const configRes = await fetch('/api/realtime-session', {
  method: 'POST',
  body: JSON.stringify({ voice }),
})
```

### 6.3 Real-time Metrics

Display WPM while speaking:

```typescript
// In TranscriptPane, calculate live
useEffect(() => {
  const metrics = calculateAudioMetrics(transcript, speakingMs)
  setLiveWPM(metrics.wpm)
}, [transcript])
```

---

## Step 7: Production Deployment

### 7.1 Environment Variables

Ensure all envs are set in production:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
NEXT_PUBLIC_ENABLE_VOICE=true
```

### 7.2 HTTPS Requirement

WebRTC requires HTTPS. Deploy to:
- Vercel (automatic HTTPS)
- Netlify
- Or custom domain with SSL

### 7.3 Rate Limiting

Add rate limiting to realtime-token endpoint:

```typescript
// Using Vercel KV or Redis
import { Ratelimit } from '@upstash/ratelimit'

const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
})

const { success } = await ratelimit.limit(user.id)
if (!success) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}
```

### 7.4 Cost Optimization

Realtime API is expensive (~$0.06/min audio). Consider:

- Session time limits (e.g., 10 min max)
- Daily usage caps per user
- Premium tier for unlimited access

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                     Browser UI                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  VoiceControl (enable/disable)                     │ │
│  │  AudioVisualizer (waveform)                        │ │
│  │  TranscriptPane (real-time transcript)            │ │
│  │  TargetsPanel (live updates)                      │ │
│  └────────────────────────────────────────────────────┘ │
│                        ↕                                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │  RealtimeVoiceClient                               │ │
│  │  - Manages WebRTC connection                       │ │
│  │  - Handles function calls                          │ │
│  │  - Emits events (transcript, response, etc.)      │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                         ↕ WebRTC
┌─────────────────────────────────────────────────────────┐
│               OpenAI Realtime API                        │
│  - gpt-4o-realtime-preview                              │
│  - Bidirectional audio streaming                        │
│  - Real-time transcription                              │
│  - Function calling (target tracking, corrections)      │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│            Next.js API Routes (Backend)                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  /api/realtime-token → Ephemeral token            │ │
│  │  /api/realtime-session → Config + functions       │ │
│  │  /api/summarize → Save metrics                    │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                   Supabase (Database)                    │
│  - sessions, targets, fluency_snapshots                 │
│  - errors, users                                        │
└─────────────────────────────────────────────────────────┘
```

---

## Troubleshooting Common Issues

### Issue: "Failed to connect to Realtime API"

**Cause:** Invalid or expired token

**Fix:**
- Check `/api/realtime-token` returns valid token
- Verify OpenAI API key has Realtime access
- Check OpenAI account has credits

### Issue: "Microphone not detected"

**Cause:** Permissions not granted or browser doesn't support WebRTC

**Fix:**
- Check browser settings → Privacy → Microphone
- Use Chrome/Edge (best WebRTC support)
- Ensure HTTPS (required for mic access)

### Issue: "Transcript not appearing"

**Cause:** Event listeners not set up correctly

**Fix:**
- Console.log in `setupEventListeners()` to verify events fire
- Check event names match SDK documentation exactly
- Verify `emit('transcript', ...)` is called

### Issue: "Function calls not working"

**Cause:** Function definitions mismatch or not registered

**Fix:**
- Ensure function names in `realtime-session` match `handleFunctionCall()`
- Check function parameters match schema
- Test with simple function first (e.g., `end_session` with no params)

---

## Performance Optimization

### Reduce Latency

1. **Use WebRTC (not WebSocket)** - Already default in @openai/agents
2. **Enable audio streaming** - Process audio chunks as they arrive
3. **Optimize function calls** - Keep logic lightweight

### Reduce Costs

1. **VAD (Voice Activity Detection)** - Only send audio when user speaks
2. **Session timeout** - Auto-disconnect after inactivity
3. **Compression** - Use Opus codec (default)

### Improve UX

1. **Show connection status** - "Connecting...", "Connected", "Disconnected"
2. **Buffer indicator** - Show when processing speech
3. **Error recovery** - Auto-reconnect on disconnect

---

## Next Steps After Phase 2

1. **Mobile App** - React Native with same backend
2. **Pronunciation Scoring** - Use phoneme data from Realtime API
3. **Group Sessions** - Multiple users in one room
4. **Custom Voices** - Train voice on user's preferred accent
5. **Offline Mode** - Local speech recognition fallback

---

## Resources

- **OpenAI Agents SDK Docs**: https://openai.github.io/openai-agents-js/
- **Realtime API Guide**: https://platform.openai.com/docs/guides/realtime
- **WebRTC Troubleshooting**: https://webrtc.org/getting-started/
- **Supabase Realtime**: https://supabase.com/docs/guides/realtime

---

**Ready to implement?** Follow steps 1-5 above, and you'll have voice mode working in ~2 hours!

Good luck! 🚀
