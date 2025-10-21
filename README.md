
# Stella - AI English Tutor MVP

An AI-powered English tutor designed for Japanese learners, built with Next.js, Supabase, and OpenAI.

## Features

### Phase 1 (Current - Text Mode)
- ✅ User authentication via Supabase
- ✅ Personalized learning with CEFR level tracking
- ✅ Micro-pack generation (3 target phrases per session)
- ✅ Text-based conversation with AI tutor
- ✅ Target phrase enforcement and tracking
- ✅ Error correction and fluency metrics
- ✅ Progress dashboard with charts
- ✅ Intent-based command system

### Phase 2 (Voice Mode - Ready to Implement)
- 🔨 OpenAI Realtime API integration
- 🔨 Voice conversation with WebRTC
- 🔨 Real-time speech-to-text transcription
- 🔨 Audio visualization
- 🔨 Voice-driven intent detection
- 🔨 Advanced fluency metrics (WPM, filler detection, pause analysis)

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Styling**: TailwindCSS with animated orb backgrounds
- **State Management**: Zustand
- **Database & Auth**: Supabase (PostgreSQL with RLS)
- **AI**: OpenAI GPT-5-nano-2025-08-07 (Chat API for text) & GPT-realtime-mini-2025-10-06 (Realtime API for voice)
- **Charts**: Recharts
- **Voice** (Phase 2): @openai/agents SDK

## Prerequisites

- Node.js 18+ and pnpm
- Supabase account and project
- OpenAI API key

## Setup Instructions

### 1. Clone and Install

```bash
cd stella
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-openai-key
```

### 3. Setup Supabase Database

Run the SQL schema in your Supabase dashboard:

1. Go to SQL Editor in Supabase
2. Copy contents from `sql/schema.sql`
3. Execute the script

This will create:
- `users`, `sessions`, `targets`, `errors`, `fluency_snapshots` tables
- Row Level Security (RLS) policies
- Indexes for performance

### 4. Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000` and you'll be redirected to `/login`.

## Testing the Application

### Text Mode (Phase 1)

1. **Sign Up / Login**
   - Navigate to `/login`
   - Create an account with email/password
   - You'll be redirected to `/home`

2. **Start a Session**
   - Click "Start Session" or type `start` in the command box
   - The planner API will generate 3 target phrases
   - You'll be redirected to `/free_conversation`

3. **Practice Conversation**
   - Type messages in the input box
   - AI tutor responds and tracks target phrase usage
   - Watch the Targets Panel update when you use phrases correctly

4. **End Session**
   - Type `stop` or `end` in the input box
   - Session summary is saved to database
   - You'll be redirected to `/home`

5. **View Progress**
   - Navigate to `/user_profile`
   - See total mastered phrases and weekly progress
   - View fluency trend chart

### Command System

In any input box, you can use these commands:

- `start` - Start new practice session
- `stop` / `end` - End current session
- `home` - Navigate to home page
- `profile` - Navigate to profile page
- `add "phrase"` - Add custom target phrase

## Project Structure

```
stella/
├── app/
│   ├── (routes)/
│   │   ├── login/page.tsx          # Authentication
│   │   ├── home/page.tsx           # Dashboard
│   │   ├── free_conversation/      # Practice session
│   │   └── user_profile/           # Progress & settings
│   ├── api/
│   │   ├── planner/route.ts        # Generate micro-packs
│   │   ├── tutor/route.ts          # AI tutor responses
│   │   ├── summarize/route.ts      # Save session data
│   │   ├── realtime-token/route.ts # Phase 2: Ephemeral tokens
│   │   └── realtime-session/       # Phase 2: Session config
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── OrbBG.tsx                   # Animated background
│   ├── IntentCaption.tsx           # Shows detected intents
│   ├── TargetsPanel.tsx            # Target phrases display
│   ├── TranscriptPane.tsx          # Conversation history
│   ├── ProfileCards.tsx            # Stats & charts
│   ├── VoiceControl.tsx            # Phase 2: Voice toggle
│   └── AudioVisualizer.tsx         # Phase 2: Waveform viz
├── lib/
│   ├── supabaseClient.ts           # Supabase setup
│   ├── sessionStore.ts             # Zustand state
│   ├── intentRouter.ts             # Command parser
│   ├── aiContracts.ts              # Type definitions
│   ├── schema.ts                   # Zod schemas
│   ├── realtimeVoiceClient.ts      # Phase 2: Voice client
│   ├── voiceIntentParser.ts        # Phase 2: Voice intents
│   └── audioMetrics.ts             # Phase 2: Metrics calc
├── sql/
│   └── schema.sql                  # Database schema
└── README.md
```

## API Routes

### POST /api/planner
Generate a micro-pack (3 phrases + grammar + pronunciation)

**Input:**
```json
{
  "cefr": "B1",
  "lastErrors": ["grammar issue"],
  "interests": ["tech", "startup"]
}
```

**Output:**
```json
{
  "targets": [
    { "phrase": "reach out to", "cefr": "B2" },
    { "phrase": "follow up on", "cefr": "B2" },
    { "phrase": "circle back", "cefr": "B2" }
  ],
  "grammar": "Phrasal verbs in business context",
  "pron": "Reduction in 'going to' → 'gonna'"
}
```

### POST /api/tutor
Get AI tutor response with corrections

**Input:**
```json
{
  "userText": "I want to reach out the team tomorrow",
  "cefr": "B1",
  "activeTargets": ["reach out to", "follow up on"],
  "mode": "gentle"
}
```

**Output:**
```json
{
  "reply": "Great! You almost used 'reach out' correctly. What will you discuss with them?",
  "corrections": [
    {
      "type": "grammar",
      "example": "reach out the team",
      "correction": "reach out to the team"
    }
  ],
  "usedTargets": ["reach out to"],
  "missedTargets": ["follow up on"]
}
```

### POST /api/summarize
Save session summary and metrics

**Input:**
```json
{
  "sessionId": "uuid",
  "usedTargets": ["reach out to"],
  "missedTargets": ["follow up on"],
  "corrections": [...],
  "metrics": { "wpm": 120, "filler_rate": 2.5 }
}
```

### GET /api/realtime-token (Phase 2)
Generate ephemeral token for Realtime API

**Output:**
```json
{
  "token": "ek_...",
  "expires_at": 1234567890
}
```

### POST /api/realtime-session (Phase 2)
Get session config for Realtime API

**Output:**
```json
{
  "model": "gpt-realtime-mini-2025-10-06",
  "voice": "alloy",
  "instructions": "You are a strict but friendly English tutor...",
  "functions": [...],
  "activeTargets": ["phrase1", "phrase2"]
}
```

## Phase 2: Voice Mode Implementation Guide

### Overview

Phase 2 adds voice conversation using OpenAI's Realtime API. The codebase is already structured to support this with minimal changes.

### Architecture

```
Browser ↔ WebRTC ↔ OpenAI Realtime API
   ↓
RealtimeVoiceClient (lib/realtimeVoiceClient.ts)
   ↓
VoiceIntentParser (lib/voiceIntentParser.ts)
   ↓
IntentRouter (lib/intentRouter.ts) [SHARED]
   ↓
Zustand Store [SHARED]
```

### Implementation Steps

#### 1. Implement Ephemeral Token Generation

Update `app/api/realtime-token/route.ts`:

```typescript
// Replace the 501 response with actual implementation
const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-realtime-preview',
    voice: 'alloy',
  }),
});

const data = await response.json();

return NextResponse.json({
  token: data.client_secret.value,
  expires_at: data.client_secret.expires_at,
});
```

#### 2. Complete RealtimeVoiceClient

Update `lib/realtimeVoiceClient.ts` with @openai/agents SDK integration:

```typescript
// Add event listeners based on SDK documentation
private setupEventListeners() {
  this.session.on('transcript', (data) => {
    this.emit('transcript', data.text, data.role)
  })

  this.session.on('function_call', (data) => {
    this.handleFunctionCall(data.name, data.arguments)
  })

  // ... more events
}
```

#### 3. Add VoiceControl to Conversation Page

Update `app/free_conversation/page.tsx`:

```tsx
import { VoiceControl } from '@/components/VoiceControl'
import { AudioVisualizer } from '@/components/AudioVisualizer'

export default function FreeConversationPage() {
  const isVoiceMode = useSessionStore((state) => state.isVoiceMode)

  return (
    <OrbBG>
      {/* ... existing code ... */}
      <VoiceControl />
      <AudioVisualizer isActive={isVoiceMode} />
    </OrbBG>
  )
}
```

#### 4. Enable Voice Mode Feature Flag

Update `.env.local`:

```env
NEXT_PUBLIC_ENABLE_VOICE=true
```

### Testing Voice Mode

1. Ensure microphone permissions are granted
2. Click "Enable Voice" button in `/free_conversation`
3. Speak naturally - the AI will respond with voice
4. Say "stop" to end the session
5. Check transcript and metrics are recorded correctly

### Voice-Specific Metrics

The `audioMetrics.ts` module calculates:

- **WPM (Words Per Minute)**: Speaking speed
- **Filler Rate**: Frequency of "um", "uh", "like", etc. per 100 words
- **Average Pause**: Time between user speech and tutor response

These are automatically saved to `fluency_snapshots` table.

## Database Schema

### Users Table
- `id`: UUID (primary key)
- `auth_user_id`: UUID (Supabase auth)
- `display_name`: Text
- `native_language`: Text (default: 'ja')
- `cefr_level`: Enum ('A1' to 'C2')
- `created_at`: Timestamp

### Sessions Table
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key)
- `started_at`, `ended_at`: Timestamps
- `speaking_ms`, `student_turns`, `tutor_turns`: Integers
- `adoption_score`: Integer
- `summary`: JSONB

### Targets Table
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key)
- `phrase`: Text
- `cefr`: Text
- `status`: Enum ('planned', 'attempted', 'mastered')
- `first_seen_at`, `last_seen_at`: Timestamps

### Errors Table
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key)
- `type`: Enum ('grammar', 'vocab', 'pron')
- `example`, `correction`: Text
- `count`: Integer
- `last_seen_at`: Timestamp

### Fluency Snapshots Table
- `id`: UUID (primary key)
- `user_id`, `session_id`: UUID (foreign keys)
- `wpm`, `filler_rate`, `avg_pause_ms`: Numeric
- `created_at`: Timestamp

## Row Level Security (RLS)

All tables have RLS enabled. Users can only access their own data via policies like:

```sql
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = auth_user_id);
```

## Design Decisions

### Intent Router Pattern

The intent router decouples input modality (text/voice) from actions:

1. User types "start" or says "start"
2. Text → `parseTextIntent()` or Voice → `parseVoiceIntent()`
3. Both produce `Intent` object
4. `executeIntent()` handles the action
5. Same code path for text and voice

This makes voice integration seamless.

### Zustand for State

Chosen for simplicity over Redux. Store includes:
- User profile
- Active session ID
- Transcript history
- Target phrase status
- Speaking metrics

### Micro-pack Strategy

Instead of overwhelming users with 20+ phrases, we use "micro-packs":
- 3 target phrases per session
- Slightly above current CEFR level
- Practical for everyday conversations and common situations
- Rotate based on errors and interests

### OpenAI Model Choices

- **Text Mode**: `gpt-5-nano-2025-08-07` (latest nano model, fast & cost-effective)
- **Voice Mode**: `gpt-realtime-mini-2025-10-06` (optimized for real-time speech)

## Troubleshooting

### "Unauthorized" errors
- Check Supabase credentials in `.env.local`
- Ensure user is logged in
- Verify RLS policies are enabled

### OpenAI API errors
- Check `OPENAI_API_KEY` is valid
- Ensure you have credits
- For Realtime API, verify beta access

### Session not starting
- Check browser console for errors
- Verify `sql/schema.sql` was run correctly
- Ensure targets are being inserted

### Voice mode not working
- Verify microphone permissions
- Check `/api/realtime-token` returns 200 (not 501)
- Ensure `@openai/agents` is installed
- Review browser console for WebRTC errors

## Next Steps

After completing Phase 2, consider:

1. **Passkey Authentication**: Replace password with WebAuthn
2. **Advanced Analytics**: Track long-term progress, streaks
3. **Custom Micro-packs**: Let users create phrase lists
4. **Pronunciation Scoring**: Use Realtime API phoneme data
5. **Mobile App**: React Native with same backend
6. **Group Sessions**: Multi-user practice rooms

## Contributing

This is an MVP for demonstration. Feel free to fork and extend!

## License

MIT

---

Built with ❤️ for Japanese learners of English
