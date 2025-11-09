# AI English Tutor - Complete Workflow Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Schema & Supabase Integration](#database-schema--supabase-integration)
3. [Authentication Flow](#authentication-flow)
4. [State Management](#state-management)
5. [API Routes](#api-routes)
6. [Page Workflows](#page-workflows)
7. [Session Lifecycle](#session-lifecycle)
8. [Realtime Voice Integration](#realtime-voice-integration)
9. [AI Workflow (Planner → Tutor → Summarize)](#ai-workflow-planner--tutor--summarize)
10. [Component Architecture](#component-architecture)
11. [Data Flow Diagrams](#data-flow-diagrams)

---

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Styling**: TailwindCSS + custom components (OrbBG, SpotlightCard, FloatingBubbles)
- **State Management**: Zustand (multiple stores: session, bubble, pronunciation)
- **Database & Auth**: Supabase (PostgreSQL with Row-Level Security)
- **AI**: OpenAI GPT-4o-mini (text), OpenAI Realtime API (voice)
- **Voice Processing**: WebRTC, MediaRecorder, Voice Activity Detection (VAD)
- **Audio Analysis**: Azure Pronunciation Assessment API

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface (React)                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐  │
│  │  /login  │  │  /home   │  │/free_conv  │  │ /profile │  │
│  └──────────┘  └──────────┘  └────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Zustand State Management                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ sessionStore │ │ bubbleStore  │ │pronunciationStore│    │
│  └──────────────┘ └──────────────┘ └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Routes (Next.js)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ /planner │ │ /tutor   │ │/summarize│ │/realtime-*   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────────┐  ┌──────────────┐   ┌──────────────────┐
│  Supabase DB     │  │  OpenAI API  │   │ Azure Pronun.    │
│  (PostgreSQL)    │  │  (Text+Voice)│   │ Assessment       │
└──────────────────┘  └──────────────┘   └──────────────────┘
```

---

## Database Schema & Supabase Integration

### Core Tables

#### 1. **users** (User profiles)
```sql
- id: uuid (PK)
- auth_user_id: uuid (unique, links to Supabase Auth)
- display_name: text
- native_language: text (default: 'ja')
- cefr_level: text (A1-C2, default: 'B1')
- correction_mode: text (immediate/balanced/gentle)
- created_at: timestamptz
```

**Purpose**: Stores user profile data and learning preferences.

**RLS Policies**: Users can only view/update their own profile (`auth.uid() = auth_user_id`).

#### 2. **sessions** (Practice sessions)
```sql
- id: uuid (PK)
- user_id: uuid (FK → users.id)
- started_at: timestamptz (default: now())
- ended_at: timestamptz
- speaking_ms: int (total speaking time)
- student_turns: int
- tutor_turns: int
- adoption_score: int
- summary: jsonb (stores transcript, corrections, complexity analysis)
```

**Purpose**: Tracks each conversation session with the AI tutor.

**RLS Policies**: Users can view/insert/update only their own sessions.

#### 3. **targets** (Learning phrases)
```sql
- id: uuid (PK)
- user_id: uuid (FK → users.id)
- phrase: text (e.g., "I'd like to emphasize that...")
- cefr: text (difficulty level)
- status: text (planned/attempted/mastered)
- first_seen_at: timestamptz
- last_seen_at: timestamptz
```

**Purpose**: Tracks vocabulary/phrases the user should learn and master.

**RLS Policies**: Users can view/insert/update only their own targets.

#### 4. **errors** (Common mistakes)
```sql
- id: uuid (PK)
- user_id: uuid (FK → users.id)
- type: text (grammar/vocab/pron)
- example: text (what user said)
- correction: text (correct version)
- count: int (frequency)
- last_seen_at: timestamptz
```

**Purpose**: Tracks recurring errors to personalize future lessons.

**RLS Policies**: Users can view/insert/update only their own errors.

#### 5. **fluency_snapshots** (Performance metrics)
```sql
- id: uuid (PK)
- user_id: uuid (FK → users.id)
- session_id: uuid (FK → sessions.id)
- wpm: numeric (words per minute)
- filler_rate: numeric
- avg_pause_ms: int
- mean_utterance_length: numeric
- unique_words_count: int
- total_words_count: int
- grammar_accuracy: numeric
- pronunciation_score: numeric
- accuracy_score, fluency_score, prosody_score, completeness_score: numeric
- turn_ratio: numeric
- confidence_score: numeric
- created_at: timestamptz
```

**Purpose**: Records detailed performance metrics for each session.

**RLS Policies**: Users can view/insert only their own snapshots.

#### 6. **progress_metrics** (Session-level progress)
```sql
- user_id, session_id: uuid (FKs)
- fluency_score, grammar_score, vocabulary_score, comprehension_score: numeric
- total_words, unique_words: int
- lexical_diversity: numeric
- cefr_distribution: jsonb
- grammar_errors, vocab_errors, pronunciation_errors, total_errors: int
- response_time_avg_ms: int
- topic_switches: int
- egi_score: numeric (English Global Index)
```

**Purpose**: Comprehensive metrics calculated post-session for progress tracking.

#### 7. **weekly_progress** (Aggregated weekly stats)
```sql
- user_id: uuid
- week_start_date: date
- total_sessions, total_minutes: int
- avg_fluency_score, avg_grammar_score, avg_vocabulary_score, avg_egi_score: numeric
- phrases_mastered, new_vocabulary, days_practiced: int
```

**Purpose**: Weekly aggregated metrics for trend visualization.

### Row-Level Security (RLS)

All tables have RLS enabled with policies like:
```sql
-- Example: users table
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = auth_user_id);

-- Example: sessions table
create policy "Users can view own sessions"
  on public.sessions for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));
```

**Key Point**: Every database query automatically filters rows based on the authenticated user's `auth.uid()`.

---

## Authentication Flow

### Login Process

```
User visits /login
      ↓
Supabase Auth UI (email/password)
      ↓
On success → Supabase creates auth_user_id
      ↓
Backend creates row in users table with auth_user_id
      ↓
Redirect to /home
      ↓
Home page loads user profile from users table
```

**Implementation** (`app/login/page.tsx`):
- Uses Supabase Auth UI component
- On successful login, creates user profile if doesn't exist
- Redirects to `/home`

**Session Management**:
- Supabase handles JWT tokens automatically
- Cookies stored client-side
- All API routes verify authentication via `supabase.auth.getUser()`

---

## State Management

### Zustand Stores

The app uses **3 main Zustand stores**:

#### 1. **sessionStore** (`lib/sessionStore.ts`)
```typescript
{
  user: UserProfile | null           // Current user
  sessionId: string | null            // Active session ID
  transcript: TranscriptTurn[]        // Chat history
  activeTargets: TargetStatus[]       // Target phrases with usage status
  corrections: Correction[]           // Accumulated corrections
  stats: SessionStats                 // Turn counts, speaking time
  isVoiceMode: boolean                // Voice vs text mode
  currentIntent: string | null        // Detected intent (e.g., "start", "stop")
}
```

**Key Actions**:
- `startSession(sessionId, targets)`: Initialize session with targets
- `endSession()`: Clear session state
- `addTurn(role, text)`: Add user/tutor message to transcript
- `markTargetUsed(phrase)`: Mark phrase as used
- `addCorrection(correction)`: Store correction

#### 2. **bubbleStore** (`lib/bubbleStore.ts`)
```typescript
{
  bubbles: Bubble[]                   // Floating UI bubbles
  showTutorTranscript: boolean        // Toggle tutor messages visibility
}
```

**Bubble Types**:
- `user`: User messages (left side)
- `tutor`: AI tutor messages (left side, toggleable)
- `grammar`, `vocab`, `pron`: Correction bubbles (right side)
- `target`: Target phrase suggestions (right side)
- `recurring`: Recurring error warnings (right side)

**Key Actions**:
- `addUserMessage(text)`: Create user bubble
- `addTutorMessage(text)`: Create tutor bubble
- `addGrammarCorrection(example, correction)`: Create correction bubble
- `removeBubble(id)`: Dismiss bubble

#### 3. **pronunciationStore** (`lib/pronunciationStore.ts`)
```typescript
{
  audioSegments: Array<{ blob: Blob; text: string }>
  assessmentResult: PronunciationResult | null
}
```

**Purpose**: Stores audio recordings during session for post-session pronunciation assessment.

---

## API Routes

### Core AI Routes

#### 1. **POST /api/planner** (`app/api/planner/route.ts`)

**Purpose**: Generate personalized micro-pack (3 target phrases + grammar + pronunciation tips)

**Input**:
```typescript
{
  cefr: string              // User's CEFR level (A1-C2)
  lastErrors?: string[]     // Optional recent errors
  interests?: string[]      // Optional interests
}
```

**Process**:
1. Authenticate user via Supabase
2. Fetch user's recent errors (count ≥ 2, ordered by frequency)
3. Fetch incomplete targets (status: planned/attempted)
4. Generate smart micro-pack:
   - 1 phrase from incomplete targets (retry)
   - 1 phrase targeting common error pattern
   - 1 NEW phrase slightly above current level
5. Select grammar point based on error patterns
6. Select pronunciation point based on errors

**Output**:
```typescript
{
  targets: [
    { phrase: "I'd like to emphasize that...", cefr: "B2" },
    { phrase: "On the other hand", cefr: "B1" },
    { phrase: "Could you elaborate?", cefr: "B2" }
  ],
  grammar: "Present perfect tense",
  pron: "Linking sounds"
}
```

**Used By**: Session initialization (`/free_conversation` on mount)

---

#### 2. **POST /api/tutor** (`app/api/tutor/route.ts`)

**Purpose**: Generate AI tutor response to user input

**Input**:
```typescript
{
  userText: string          // What user said
  cefr: string              // User's level
  activeTargets: string[]   // Target phrases to encourage
  mode: "gentle" | "turn" | "post"  // Correction frequency
}
```

**Process**:
1. Construct mode-specific system prompt (gentle = 1 correction per 2-3 turns)
2. Send to OpenAI GPT-4o-mini with JSON response format
3. Parse response for reply, corrections, and target usage

**Output**:
```typescript
{
  reply: string             // Tutor's response (1-2 sentences)
  corrections: [
    { type: "grammar", example: "I go there yesterday", correction: "I went there yesterday" }
  ],
  enforce: { must_use_next: string | null },
  metrics: { fillers: number, pause_ms: number },
  usedTargets: string[],    // Targets student used
  missedTargets: string[]   // Targets student missed
}
```

**Used By**: Text-based conversation flow (legacy), now mostly replaced by Realtime API

---

#### 3. **POST /api/summarize** (`app/api/summarize/route.ts`)

**Purpose**: Save session data, update metrics, and calculate comprehensive analysis

**Input**:
```typescript
{
  sessionId: string
  usedTargets: string[]
  missedTargets: string[]
  corrections: Correction[]
  transcript: TranscriptTurn[]
  metrics?: { wpm, filler_rate, avg_pause_ms }
}
```

**Process**:
1. **Comprehensive Analysis**: Call `/api/analyze-transcript` for thorough grammar/vocabulary assessment
2. **Calculate Metrics**: Use `metricsCalculator` to compute:
   - Fluency scores (WPM, mean utterance length, pauses)
   - Grammar accuracy
   - Vocabulary diversity (lexical diversity, CEFR distribution)
   - Confidence score
   - **EGI Score** (English Global Index)
3. **Update Database**:
   - Mark used targets as `attempted` or `mastered`
   - Upsert errors with counts
   - Insert `fluency_snapshots`
   - Insert `progress_metrics`
   - Estimate CEFR level and insert into `cefr_trajectory`
   - Update or create `weekly_progress`
4. **Update Session**: Store transcript, corrections, and complexity analysis in `sessions.summary` (JSONB)

**Output**:
```typescript
{
  success: true,
  metrics: {
    egi_score: 72.5,
    fluency_score: 75,
    grammar_score: 68,
    vocabulary_score: 70,
    estimated_cefr: "B2"
  }
}
```

**Used By**: Session end flow (`/free_conversation` → stop button)

---

### Realtime Voice Routes

#### 4. **POST /api/realtime-token** (`app/api/realtime-token/route.ts`)

**Purpose**: Create ephemeral token for OpenAI Realtime API connection

**Input**:
```typescript
{
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
```

**Process**:
1. Authenticate user
2. Fetch user profile and targets
3. Construct personalized system prompt incorporating:
   - User's CEFR level
   - Active target phrases
   - Accent test feedback (if provided)
   - Speaking style guidelines ("warm California English tutor")
   - Teaching rules (student speaks ≥65%, corrections every 2-3 turns)
4. Create ephemeral token from OpenAI

**Output**:
```typescript
{
  token: string             // Ephemeral OpenAI token
  model: "gpt-realtime-mini-2025-10-06"
  prompt: string            // Full system instructions
}
```

**Used By**: `useRealtime` hook during session start

---

#### 5. **POST /api/realtime-session** (`app/api/realtime-session/route.ts`)

**Purpose**: Prepare session configuration for Realtime API

**Output**:
```typescript
{
  model: "gpt-realtime-mini-2025-10-06",
  voice: "alloy",
  instructions: string,     // System prompt
  functions: [              // Tool definitions
    { name: "mark_target_used", ... },
    { name: "add_correction", ... },
    { name: "end_session", ... },
    { name: "navigate", ... }
  ],
  activeTargets: string[]
}
```

**Used By**: Client-side Realtime agent setup

---

#### 6. **POST /api/transcribe** (`app/api/transcribe/route.ts`)

**Purpose**: Transcribe user's audio using OpenAI Whisper

**Input**: FormData with audio blob

**Output**:
```typescript
{
  text: string              // Transcribed text
}
```

**Used By**: `useRealtime` hook during voice activity detection

---

#### 7. **POST /api/pronunciation-assessment** (`app/api/pronunciation-assessment/route.ts`)

**Purpose**: Assess pronunciation using Azure Cognitive Services

**Input**: FormData with audio blob and reference text

**Output**:
```typescript
{
  pronunciation_score: number,
  accuracy_score: number,
  fluency_score: number,
  completeness_score: number,
  prosody_score: number
}
```

**Used By**: Post-session pronunciation analysis

---

### Support Routes

#### 8. **POST /api/analyze-transcript** (`app/api/analyze-transcript/route.ts`)

**Purpose**: Comprehensive grammar and vocabulary analysis

**Input**:
```typescript
{
  transcript: TranscriptTurn[],
  userCefrLevel: string
}
```

**Output**:
```typescript
{
  grammar_errors: [
    { text: string, correction: string, error_type: string, severity: string }
  ],
  vocabulary_issues: [
    { text: string, suggestion: string, reason: string, issue_type: string }
  ],
  complexity_analysis: {
    sentence_complexity: string,
    vocabulary_richness: string
  }
}
```

**Used By**: `/api/summarize` during session end

---

#### 9. **POST /api/session/create** (`app/api/session/create/route.ts`)

**Purpose**: Create new session and insert initial targets

**Used By**: Intent router during session start

---

#### 10. **POST /api/targets/add** (`app/api/targets/add/route.ts`)

**Purpose**: Add custom target phrase

**Used By**: Intent router for "add" commands

---

## Page Workflows

### 1. **/login** (`app/login/page.tsx`)

**Flow**:
```
User visits /login
      ↓
Supabase Auth UI renders
      ↓
User enters email/password
      ↓
On success:
  - Supabase creates auth token
  - App checks if user exists in users table
  - If not, creates user profile with default CEFR: B1
      ↓
Redirect to /home
```

**Components Used**: Supabase Auth UI, OrbBG (background)

---

### 2. **/home** (`app/home/page.tsx`)

**Flow**:
```
Page loads
      ↓
useEffect: loadUser()
      ↓
Get auth user from Supabase
      ↓
Fetch user profile (id, display_name, cefr_level)
      ↓
Update sessionStore.setUser()
      ↓
Render 4 cards:
  1. AI Accent Test → /accent-test
  2. Start Session → /free_conversation
  3. Progress Dashboard → /progress
  4. My Profile → /user_profile
```

**Components Used**: OrbBG, IntentCaption (shows detected intents like "start")

---

### 3. **/free_conversation** (`app/free_conversation/page.tsx`)

**Most Complex Page** - Handles both voice and text interaction

**Initialization Flow**:
```
Component mounts
      ↓
useEffect: Check for accent test context (?from_test=xxx)
      ↓
If context exists:
  - Fetch feedback from feedback_tips table
  - Store in accentTestFeedback state
      ↓
useEffect: initSession() (waits for feedback to load)
      ↓
Load authenticated user
      ↓
Fetch user profile (id, display_name, cefr_level)
      ↓
Call startNewSession(userId, cefr):
  1. Set correction mode to 'gentle'
  2. Call /api/planner → get micro-pack (3 targets)
  3. Create session row in database
  4. Insert targets into targets table
  5. Call sessionStore.startSession(sessionId, targets)
  6. Call useRealtime.start({ userId, sessionId, feedbackContext })
      ↓
Realtime connection established
      ↓
Voice + text chat active
```

**Voice Interaction Flow** (via `useRealtime` hook):
```
User speaks
      ↓
Voice Activity Detection (VAD) detects speech
      ↓
MediaRecorder records audio
      ↓
Silence detected (2000ms)
      ↓
MediaRecorder stops
      ↓
Audio blob sent to /api/transcribe
      ↓
Whisper returns transcription
      ↓
Add to transcript and bubble UI
      ↓
Audio sent to OpenAI Realtime API via WebRTC
      ↓
AI processes and responds with voice + text
      ↓
Response received via WebRTC data channel
      ↓
Parse events:
  - response.audio_transcript.delta → buffer chunks
  - response.audio_transcript.done → add to transcript
  - Detect corrections → add to corrections
      ↓
Tutor's audio played via HTMLAudioElement
      ↓
Tutor's text shown as bubble (if enabled)
```

**Text Interaction Flow**:
```
User types in input box
      ↓
Press Enter or click Send
      ↓
Check if command (via parseTextIntent):
  - "stop" → handleStopSession()
  - Other commands → executeIntent()
      ↓
If not command:
  - Add to transcript
  - Create user bubble
  - Send via Realtime data channel (sendText)
      ↓
AI responds (same as voice flow)
```

**Stop Session Flow**:
```
User clicks Stop button
      ↓
handleStopSession():
  1. Stop WebRTC connection (stop mic, close peer)
  2. Collect used/missed targets
  3. Call /api/summarize with transcript + corrections
  4. Wait for pronunciation assessment (if audio segments exist)
  5. Clear sessionStore
  6. Clear pronunciationStore
  7. Navigate to /session-review/:sessionId
```

**UI Elements**:
- **Orb Background**: Visual indicator (distorted during loading)
- **Connection Status**: Green (connected), Yellow (connecting), Red (error)
- **Stopwatch**: Session timer
- **Floating Bubbles**: User/tutor messages and corrections
- **Topic Cards**: Auto-suggested topics if user struggles
- **Accent Test Context Banner**: Shows if session uses accent test feedback
- **Input Box**: Text input for chat

---

### 4. **/user_profile** (`app/user_profile/page.tsx`)

**Flow**:
```
Page loads
      ↓
Fetch user profile
      ↓
Fetch statistics:
  - Total phrases mastered (targets.status = 'mastered')
  - Weekly mastered count
  - Fluency trends from fluency_snapshots
      ↓
Render cards:
  - Profile info (editable CEFR level)
  - Mastered phrases count
  - Weekly progress chart
  - Session history
```

**Components Used**: ProfileCards, charts (e.g., recharts)

---

### 5. **/session-review/:id** (`app/session-review/[id]/page.tsx`)

**Flow**:
```
Page loads with sessionId
      ↓
Fetch session data (summary, transcript, corrections)
      ↓
Fetch pronunciation scores from fluency_snapshots
      ↓
Fetch progress metrics
      ↓
Render review components:
  - TranscriptReview (full conversation)
  - CorrectionComparison (what you said vs. correction)
  - PhraseWishlist (used/missed targets)
  - PronunciationScores
  - Statistical charts
      ↓
User can export as PDF
```

---

### 6. **/progress** (`app/progress/page.tsx`)

**Purpose**: Weekly progress dashboard

**Flow**:
```
Fetch weekly_progress for current week
      ↓
Fetch progress_metrics for trend analysis
      ↓
Render:
  - Weekly stats (sessions, minutes, EGI score)
  - Trend charts (fluency, grammar, vocab)
  - CEFR trajectory
  - Learning insights
```

---

### 7. **/accent-test** (`app/accent-test/page.tsx`)

**Purpose**: Initial assessment test

**Flow**:
```
Load test sentences
      ↓
User reads each sentence aloud
      ↓
Audio sent to /api/accent-test
      ↓
Azure Pronunciation Assessment
      ↓
Calculate EGI score
      ↓
Generate feedback tips (grammar, vocab, pronunciation)
      ↓
Save to accent_tests and feedback_tips tables
      ↓
Show results + "Try in Conversation" button
      ↓
Click button → Navigate to /free_conversation?from_test=xxx
      ↓
Session initialized with personalized feedback context
```

---

## Session Lifecycle

### Complete Session Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   1. SESSION INITIALIZATION                  │
└─────────────────────────────────────────────────────────────┘
User visits /free_conversation
      ↓
Page component mounts
      ↓
Check for accent test context (?from_test=xxx)
      ↓
Fetch feedback if exists
      ↓
Load user profile (id, cefr_level)
      ↓
Call startNewSession():
  ├─ POST /api/planner → Get micro-pack
  ├─ Insert session row in DB
  ├─ Insert 3 targets into targets table
  ├─ Update sessionStore (sessionId, targets)
  └─ Call useRealtime.start()

┌─────────────────────────────────────────────────────────────┐
│              2. REALTIME CONNECTION SETUP (WebRTC)           │
└─────────────────────────────────────────────────────────────┘
useRealtime.start():
  ├─ Request microphone permission
  ├─ Setup MediaRecorder (for local transcription)
  ├─ Setup Voice Activity Detection (VAD)
  ├─ POST /api/realtime-token → Get ephemeral token + prompt
  ├─ Create RTCPeerConnection
  ├─ Add audio tracks to peer
  ├─ Create data channel ('oai-events')
  ├─ Create SDP offer
  └─ POST to OpenAI Realtime API → Establish WebRTC connection
      ↓
Connection established
      ↓
Send session.update with instructions
      ↓
Status: 'connected'

┌─────────────────────────────────────────────────────────────┐
│                  3. ACTIVE CONVERSATION                      │
└─────────────────────────────────────────────────────────────┘
┌───────────────────────┐       ┌──────────────────────────┐
│   Voice Interaction   │       │   Text Interaction       │
└───────────────────────┘       └──────────────────────────┘
User speaks                      User types + Enter
      ↓                                ↓
VAD detects speech                parseTextIntent()
      ↓                                ↓
MediaRecorder starts             If command → execute
      ↓                                ↓
Silence detected (2s)            Else → sendText()
      ↓                                ↓
Stop recording                   Send via data channel:
      ↓                            - conversation.item.create
POST /api/transcribe                - response.create
      ↓                                ↓
Get transcription               ┌────────────────────────┐
      ↓                         │  OpenAI Realtime API   │
Add to transcript               │  processes request     │
      ↓                         └────────────────────────┘
Audio sent to Realtime API              ↓
      ↓                         AI generates response
┌────────────────────────────┐          ↓
│  AI Response Processing    │   ┌─────────────────────┐
└────────────────────────────┘   │ Data channel events │
Receive events via data channel: └─────────────────────┘
  - response.audio_transcript.delta → buffer
  - response.audio_transcript.done → add to transcript
  - response.created → set isTutorSpeaking = true
  - response.done → set isTutorSpeaking = false
      ↓
Audio played via HTMLAudioElement
      ↓
Text shown as bubble (if enabled)
      ↓
Parse for corrections → add to corrections
      ↓
Parse for target usage → markTargetUsed()
      ↓
Store audio segment for pronunciation assessment

┌─────────────────────────────────────────────────────────────┐
│                4. CONVERSATION MONITORING                    │
└─────────────────────────────────────────────────────────────┘
useEffect monitors transcript:
  - If user struggles (short replies, hesitation)
  - Generate floating topic cards
  - Show suggestions

Bubble system:
  - User messages → left side
  - Tutor messages → left side (toggleable)
  - Corrections → right side
  - Target suggestions → right side
  - Recurring errors → right side

┌─────────────────────────────────────────────────────────────┐
│                  5. SESSION TERMINATION                      │
└─────────────────────────────────────────────────────────────┘
User clicks "Stop" or says "stop"
      ↓
handleStopSession():
  ├─ Call useRealtime.stop()
  │  ├─ Close data channel
  │  ├─ Close peer connection
  │  ├─ Stop mic tracks
  │  ├─ Remove audio element
  │  └─ Cleanup VAD
  ├─ Collect used/missed targets
  ├─ Collect corrections
  ├─ Collect full transcript
  └─ POST /api/summarize
      ├─ Call /api/analyze-transcript (comprehensive analysis)
      ├─ Calculate metrics (EGI, fluency, grammar, vocab)
      ├─ Update targets status
      ├─ Upsert errors with counts
      ├─ Insert fluency_snapshots
      ├─ Insert progress_metrics
      ├─ Estimate CEFR level
      └─ Update weekly_progress
      ↓
Assess pronunciation (if audio segments exist):
  - For each audio segment:
    - POST /api/pronunciation-assessment
    - Get scores (accuracy, fluency, prosody)
  - Average scores
  - Store in fluency_snapshots
      ↓
Clear sessionStore
      ↓
Clear pronunciationStore
      ↓
Navigate to /session-review/:sessionId
```

---

## Realtime Voice Integration

### WebRTC + OpenAI Realtime API

The app uses **OpenAI Realtime API** with **WebRTC** for bi-directional voice communication.

#### Architecture

```
┌─────────────┐   Audio (WebRTC)  ┌────────────────────┐
│   Browser   │ ←────────────────→ │  OpenAI Realtime  │
│             │                     │       API         │
│  useRealtime│   Data Channel     │                   │
│    Hook     │ ←────────────────→ │  (gpt-realtime-   │
└─────────────┘   (Events/JSON)    │   mini-2025)      │
                                    └────────────────────┘
```

#### Key Components

**1. Voice Activity Detection (VAD)** (`lib/useRealtime.ts:216-283`)

```typescript
// VAD uses Web Audio API to detect speech
const setupVoiceActivityDetection = (stream: MediaStream) => {
  - Create AudioContext + AnalyserNode
  - Continuously analyze audio RMS (root mean square)
  - If RMS > threshold (0.02) → Speaking
  - If silent for 2000ms → Stop speaking
  - Trigger MediaRecorder start/stop
}
```

**2. MediaRecorder** (for local transcription)

```typescript
// Records audio locally for Whisper transcription
setupMediaRecorder(stream)
  - Start recording when VAD detects speech
  - Stop when silence detected
  - Send blob to /api/transcribe
  - Get transcription → add to transcript
  - Also store for pronunciation assessment
```

**3. WebRTC Connection** (`lib/useRealtime.ts:434-598`)

```typescript
const start = async (config: RealtimeConfig) => {
  // 1. Get microphone
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  // 2. Get ephemeral token from backend
  const { token, prompt } = await fetch('/api/realtime-token', { ... })

  // 3. Create peer connection
  const peer = new RTCPeerConnection()
  peer.addTrack(stream.getTracks()[0], stream)

  // 4. Handle incoming audio
  peer.ontrack = (event) => {
    const audioElement = document.createElement('audio')
    audioElement.srcObject = event.streams[0]
    audioElement.autoplay = true
  }

  // 5. Create data channel for events
  const channel = peer.createDataChannel('oai-events')

  channel.onmessage = (event) => {
    handleRealtimeEvent(event.data) // Parse AI responses
  }

  // 6. Negotiate SDP
  const offer = await peer.createOffer()
  await peer.setLocalDescription(offer)

  const response = await fetch('https://api.openai.com/v1/realtime?model=...', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: offer.sdp
  })

  const answerSdp = await response.text()
  await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp })
}
```

**4. Event Handling** (`lib/useRealtime.ts:335-431`)

```typescript
const handleRealtimeEvent = (raw: string) => {
  const events = JSON.parse(raw)

  events.forEach(event => {
    switch (event.type) {
      case 'response.audio_transcript.delta':
        // AI is speaking (partial text)
        bufferRef.current += event.delta
        break

      case 'response.audio_transcript.done':
        // AI finished speaking
        addTurn('tutor', bufferRef.current)
        addTutorMessage(bufferRef.current)

        // Parse for corrections
        if (containsCorrection(message)) {
          parseCorrections(message).forEach(addCorrection)
        }
        break

      case 'response.created':
        setIsTutorSpeaking(true)
        break

      case 'response.done':
        setIsTutorSpeaking(false)
        break

      case 'error':
        setError(event.error.message)
        break
    }
  })
}
```

**5. Sending Text Messages** (`lib/useRealtime.ts:600-644`)

```typescript
const sendText = (message: string) => {
  channel.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: message }]
    }
  }))

  channel.send(JSON.stringify({
    type: 'response.create',
    response: { modalities: ['text', 'audio'] }
  }))
}
```

---

## AI Workflow (Planner → Tutor → Summarize)

### The 3-Phase AI Pipeline

```
┌──────────────────────────────────────────────────────────┐
│  PHASE 1: PLANNER (Session Start)                        │
│  API: /api/planner                                       │
└──────────────────────────────────────────────────────────┘
Input: { cefr: "B1" }
      ↓
Fetch user's learning data:
  - Recent errors (type, count)
  - Incomplete targets (planned/attempted)
      ↓
Generate personalized micro-pack:
  - 1 phrase from incomplete targets (retry)
  - 1 phrase targeting error pattern
  - 1 new phrase (stretch goal)
  - 1 grammar point
  - 1 pronunciation point
      ↓
Output: {
  targets: [
    { phrase: "On the other hand", cefr: "B1" },
    { phrase: "I'd like to emphasize", cefr: "B2" },
    { phrase: "Could you elaborate?", cefr: "B2" }
  ],
  grammar: "Present perfect tense",
  pron: "Linking sounds"
}
      ↓
Insert into targets table
      ↓
Store in sessionStore.activeTargets

┌──────────────────────────────────────────────────────────┐
│  PHASE 2: TUTOR (During Conversation)                   │
│  API: /api/tutor (text mode) OR Realtime API (voice)    │
└──────────────────────────────────────────────────────────┘
Input: {
  userText: "I go to store yesterday",
  cefr: "B1",
  activeTargets: ["On the other hand", ...],
  mode: "gentle"
}
      ↓
Construct system prompt:
  - "You are a friendly English tutor"
  - "Keep student speaking ≥65%"
  - "Correction policy: 1 per 2-3 turns (gentle mode)"
  - "Optional nudge pool: [targets]"
      ↓
Send to OpenAI (gpt-4o-mini or Realtime model)
      ↓
AI generates response:
  - Natural conversational reply
  - Identifies grammar error: "I go" → "I went"
  - Detects target usage: none used
  - Suggests gentle nudge if appropriate
      ↓
Output: {
  reply: "Oh, you went to the store yesterday? What did you buy?",
  corrections: [
    { type: "grammar", example: "I go", correction: "I went" }
  ],
  usedTargets: [],
  missedTargets: ["On the other hand", ...]
}
      ↓
Add to transcript
      ↓
Store corrections
      ↓
Show as bubbles (if thresholds met)

┌──────────────────────────────────────────────────────────┐
│  PHASE 3: SUMMARIZE (Session End)                       │
│  API: /api/summarize                                    │
└──────────────────────────────────────────────────────────┘
Input: {
  sessionId: "xxx",
  usedTargets: ["On the other hand"],
  missedTargets: ["I'd like to emphasize", "Could you elaborate?"],
  corrections: [...],
  transcript: [...],
  metrics: { wpm: 120, filler_rate: 0.05 }
}
      ↓
Call /api/analyze-transcript:
  - Deep grammar analysis (tense errors, article usage, etc.)
  - Vocabulary analysis (repetition, complexity)
  - Complexity rating
      ↓
Calculate comprehensive metrics:
  - Fluency: WPM, mean utterance length, pauses
  - Grammar: accuracy_score, error_rate
  - Vocabulary: lexical diversity, CEFR distribution
  - Pronunciation: average scores from audio segments
  - Confidence: hesitation patterns, filler usage
  - **EGI Score**: composite metric (0-100)
      ↓
Update database:
  ├─ targets:
  │  ├─ "On the other hand" → status: 'attempted'
  │  └─ Missed targets → no change
  ├─ errors:
  │  └─ Upsert grammar error: "I go" → "I went" (count +1)
  ├─ fluency_snapshots:
  │  └─ Insert all calculated metrics
  ├─ progress_metrics:
  │  └─ Insert session-level metrics
  ├─ cefr_trajectory:
  │  └─ Estimate CEFR level from performance
  └─ weekly_progress:
     └─ Update or create weekly aggregates
      ↓
Output: {
  success: true,
  metrics: {
    egi_score: 72.5,
    fluency_score: 75,
    grammar_score: 68,
    vocabulary_score: 70,
    estimated_cefr: "B2"
  }
}
      ↓
Navigate to /session-review/:sessionId
```

### Key AI Decisions

**Planner Strategy**:
- **Adaptive**: Uses user's error history to target weaknesses
- **Spaced Repetition**: Retries incomplete targets
- **Progressive**: Includes one stretch goal (higher CEFR)

**Tutor Behavior**:
- **Conversational**: Avoids robotic Q&A, expands on topics
- **Balanced**: Student speaks 65%+, tutor keeps replies short
- **Delayed Corrections**: Batches corrections every 2-3 turns
- **Gentle Nudges**: Suggests target phrases only if natural

**Summarizer Intelligence**:
- **Comprehensive**: Combines tutor corrections + deep analysis
- **Metric-Rich**: Calculates 15+ metrics per session
- **Adaptive Learning**: Updates user's error patterns for next session
- **CEFR Estimation**: Predicts level based on performance

---

## Component Architecture

### UI Component Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│                     Root Layout                          │
│  app/layout.tsx                                          │
│  - Supabase client provider                             │
│  - Global styles                                         │
└──────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│                   Page Components                        │
│  /login, /home, /free_conversation, /user_profile       │
└──────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│              Shared Layout Components                    │
│  <OrbBG>          - Animated orb background             │
│  <IntentCaption>  - Shows detected intents              │
└──────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│              Feature Components                          │
│  <BubbleContainer>        - Floating message bubbles     │
│  <TargetsPanel>           - Shows active targets         │
│  <TranscriptPane>         - Chat history                │
│  <VoiceControl>           - Mic controls                │
│  <Stopwatch>              - Session timer               │
│  <FloatingTopicContainer> - Topic suggestions           │
└──────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────┐
│              Atomic Components                           │
│  <FloatingBubble>     - Individual message bubble        │
│  <SpotlightCard>      - Glowing card container          │
│  <GlassSurface>       - Glassmorphic surface            │
│  <ElectricBorder>     - Animated border effect          │
│  <Orb>                - 3D orb visualization            │
└──────────────────────────────────────────────────────────┘
```

### Key Component Details

#### **BubbleContainer** (`components/BubbleContainer.tsx`)

**Purpose**: Manages and renders all floating message/correction bubbles

**Logic**:
```typescript
const bubbles = useBubbleStore(state => state.bubbles)
const showTutorTranscript = useBubbleStore(state => state.showTutorTranscript)

// Separate into left (conversation) and right (corrections)
const conversationBubbles = bubbles.filter(b => {
  if (b.type === 'tutor' && !showTutorTranscript) return false
  return b.type === 'tutor' || b.type === 'user'
})

const correctionBubbles = bubbles.filter(b =>
  b.type === 'grammar' || b.type === 'vocab' || b.type === 'pron' ||
  b.type === 'target' || b.type === 'recurring'
)
```

**Rendering**:
- Conversation bubbles → left side
- Correction bubbles → right side
- Auto-dismiss after timeout
- Click to dismiss

#### **FloatingBubble** (`components/FloatingBubble.tsx`)

**Purpose**: Individual bubble with physics-based animation

**Props**:
```typescript
{
  bubble: {
    id: string
    type: 'user' | 'tutor' | 'grammar' | 'vocab' | 'pron' | 'target' | 'recurring'
    content: string
    timestamp: number
  },
  index: number,
  onDismiss: (id: string) => void
}
```

**Styling**:
- User: Blue gradient
- Tutor: Purple gradient (toggleable)
- Grammar: Red tint
- Vocab: Yellow tint
- Pronunciation: Green tint
- Target: Cyan tint
- Recurring: Orange tint

#### **Orb** (`components/Orb.tsx`)

**Purpose**: Animated 3D orb that reacts to audio/state

**Props**:
```typescript
{
  hue: number                    // Color (0-360)
  hoverIntensity: number         // Distortion level
  rotateOnHover: boolean
  forceHoverState: boolean       // For loading states
}
```

**Animation**:
- Uses reactbits orb library
- Distorts during loading/connecting
- Calm during conversation
- Pulses during AI speaking

#### **IntentCaption** (`components/IntentCaption.tsx`)

**Purpose**: Shows detected intents (e.g., "start", "stop", "add phrase")

**Logic**:
```typescript
const currentIntent = useSessionStore(state => state.currentIntent)

if (!currentIntent) return null

return <div>Intent: {currentIntent}</div>
```

**Future**: Will be used for voice-driven navigation

---

## Data Flow Diagrams

### Session Initialization Data Flow

```
User                    Frontend                   API Routes              Supabase               OpenAI
  |                        |                           |                       |                    |
  |--Click "Start"-------->|                           |                       |                    |
  |                        |--GET /api/planner-------->|                       |                    |
  |                        |                           |--Fetch errors-------->|                    |
  |                        |                           |<----errors------------|                    |
  |                        |                           |--Fetch targets------->|                    |
  |                        |                           |<----targets-----------|                    |
  |                        |                           |--Generate pack--------|------------------>|
  |                        |                           |<--micro-pack----------|<------------------|
  |                        |<--micro-pack--------------|                       |                    |
  |                        |--Create session---------->|                       |                    |
  |                        |                           |--INSERT session------>|                    |
  |                        |                           |--INSERT targets------>|                    |
  |                        |<--sessionId---------------|                       |                    |
  |                        |--POST /api/realtime-token>|                       |                    |
  |                        |                           |--Fetch profile------->|                    |
  |                        |                           |<--profile-------------|                    |
  |                        |                           |--Create ephemeral-----|------------------>|
  |                        |                           |<--token---------------|<------------------|
  |                        |<--token+prompt------------|                       |                    |
  |                        |--WebRTC SDP offer---------|------------------------------------->|
  |                        |<--SDP answer--------------|<-------------------------------------|
  |<--Connected------------|                           |                       |                    |
```

### Voice Interaction Data Flow

```
User                    Frontend (useRealtime)        API Routes              OpenAI
  |                           |                            |                     |
  |--Speaks------------------>|                            |                     |
  |                           |--VAD detects speech        |                     |
  |                           |--MediaRecorder starts      |                     |
  |                           |                            |                     |
  |--Stops speaking---------->|--VAD detects silence       |                     |
  |                           |--MediaRecorder stops       |                     |
  |                           |                            |                     |
  |                           |--POST /api/transcribe----->|                     |
  |                           |   (audio blob)             |--Whisper API------->|
  |                           |<--transcription------------|<--------------------|
  |                           |--addTurn('user', text)     |                     |
  |                           |--addUserMessage(text)      |                     |
  |                           |                            |                     |
  |                           |--Send audio via WebRTC-----|-------------------->|
  |                           |                            |     (audio stream)  |
  |                           |                            |                     |
  |                           |<--Data channel events------|<--------------------|
  |                           |   (response.audio_transcript.delta)               |
  |                           |--Buffer chunks             |                     |
  |                           |                            |                     |
  |                           |<--response.audio_transcript.done                 |
  |                           |--addTurn('tutor', text)    |                     |
  |                           |--addTutorMessage(text)     |                     |
  |                           |--parseCorrections()        |                     |
  |                           |                            |                     |
  |<--Audio playback----------|<--WebRTC audio stream------|<--------------------|
```

### Session End Data Flow

```
User                    Frontend                   API Routes              Supabase               OpenAI
  |                        |                           |                       |                    |
  |--Click "Stop"--------->|                           |                       |                    |
  |                        |--stop() (WebRTC)----------|                       |                    |
  |                        |--Close connections         |                       |                    |
  |                        |                            |                       |                    |
  |                        |--Assess pronunciation----->|                       |                    |
  |                        |   (audio segments)         |--Azure API----------->|                    |
  |                        |<--pronunciation scores-----|<----------------------|                    |
  |                        |                            |                       |                    |
  |                        |--POST /api/summarize------>|                       |                    |
  |                        |   (transcript+corrections) |                       |                    |
  |                        |                            |--POST /api/analyze--->|------------------>|
  |                        |                            |   transcript          |  (GPT analysis)   |
  |                        |                            |<--comprehensive-------|<------------------|
  |                        |                            |   analysis            |                    |
  |                        |                            |                       |                    |
  |                        |                            |--Calculate metrics--->|                    |
  |                        |                            |                       |                    |
  |                        |                            |--UPDATE targets------>|                    |
  |                        |                            |--UPSERT errors------->|                    |
  |                        |                            |--INSERT fluency------>|                    |
  |                        |                            |--INSERT progress----->|                    |
  |                        |                            |--INSERT trajectory--->|                    |
  |                        |                            |--UPDATE weekly------->|                    |
  |                        |                            |                       |                    |
  |                        |<--success (metrics)--------|                       |                    |
  |                        |                            |                       |                    |
  |<--Navigate to review---|                            |                       |                    |
     /session-review/:id
```

---

## Key Design Patterns

### 1. **Personalization Through Data**
- Every session uses user's error history
- Planner adapts to weaknesses
- Feedback context from accent tests

### 2. **Progressive Disclosure**
- Corrections batched (not immediate)
- Topic suggestions appear when struggling
- Tutor transcript toggleable

### 3. **Dual-Mode Interaction**
- Voice (primary): Natural conversation via WebRTC
- Text (fallback): Supports typing for accessibility

### 4. **Comprehensive Analytics**
- Real-time: VAD, turn tracking
- Post-session: Pronunciation, grammar, vocabulary analysis
- Long-term: Weekly trends, CEFR trajectory

### 5. **Zustand for State**
- Multiple stores for separation of concerns
- Optimistic updates for responsiveness
- Persistent state across navigation

### 6. **Supabase for Everything**
- Auth: Email/password (passkey future)
- DB: PostgreSQL with RLS
- Real-time: Subscriptions for live updates (not used yet)

### 7. **OpenAI Realtime API**
- WebRTC for low-latency voice
- Data channel for structured events
- Function calls for intents (future)

---

## Environment Variables

Required in `.env.local`:

```env
# Supabase (public - safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Supabase (server-only - sensitive)
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# OpenAI (server-only - sensitive)
OPENAI_API_KEY=sk-xxx

# Azure Speech (server-only - sensitive)
AZURE_SPEECH_KEY=xxx
AZURE_SPEECH_REGION=eastus

# App URL (optional, auto-detected)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## Future Enhancements (Phase 2+)

### Planned Features
1. **Passkey Authentication**: Replace email/password
2. **Function Calls in Realtime**: AI can call `mark_target_used`, `navigate`, etc.
3. **Voice-Driven Navigation**: Say "go to profile" to navigate
4. **Real-time Collaboration**: Multiple users practice together
5. **Advanced Pronunciation**: Segment-level feedback (phoneme accuracy)
6. **Adaptive CEFR**: Auto-adjust level based on performance
7. **Gamification**: Streaks, achievements, leaderboards
8. **Mobile App**: React Native with same API
9. **Offline Mode**: Local storage + sync
10. **Custom Tutor Voices**: Clone user's preferred accent

---

## Troubleshooting Common Issues

### Issue: Realtime connection fails
**Solution**: Check:
1. OPENAI_API_KEY is valid
2. Browser has microphone permission
3. HTTPS is enabled (WebRTC requires secure context)
4. Firewall doesn't block WebRTC

### Issue: Pronunciation assessment returns null
**Solution**: Check:
1. AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are set
2. Audio blob format is compatible (WebM/Opus)
3. Reference text matches spoken text

### Issue: RLS policy errors
**Solution**:
1. Ensure user is authenticated (`supabase.auth.getUser()`)
2. Verify `auth_user_id` matches in `users` table
3. Check policy definitions in Supabase dashboard

### Issue: Bubbles don't appear
**Solution**:
1. Check `bubbleStore` state in React DevTools
2. Verify `addTutorMessage` is called in `useRealtime`
3. Ensure `showTutorTranscript` is true

---

## Performance Considerations

### Optimizations
1. **Lazy Loading**: Pages use dynamic imports
2. **Zustand**: Minimal re-renders (selective subscriptions)
3. **RLS Indexes**: Created on foreign keys
4. **WebRTC**: Peer-to-peer reduces server load
5. **Cloudflare Workers**: Could host API routes for edge caching
6. **Supabase Realtime**: Future use for live updates

### Monitoring
- **Vercel Analytics**: Page load times
- **Sentry**: Error tracking
- **Supabase Logs**: Query performance
- **OpenAI Usage**: Token consumption

---

## Conclusion

This AI English Tutor is a **full-stack, production-ready application** with:

✅ **Modern Architecture**: Next.js 14, Zustand, Supabase, OpenAI Realtime API
✅ **Secure**: RLS, JWT auth, server-side API keys
✅ **Personalized**: Error-based learning, adaptive CEFR
✅ **Real-time**: WebRTC voice, VAD, instant feedback
✅ **Comprehensive**: 15+ metrics, weekly trends, pronunciation analysis
✅ **Extensible**: Modular design, typed contracts, clear separation

The workflow is designed for **low-latency voice interaction** while maintaining **rich analytics** and **progressive personalization**. Every session makes the AI tutor smarter about the user's needs.

---

**Last Updated**: 2025-11-05
**Version**: 1.0
**Author**: AI Assistant (based on codebase analysis)
