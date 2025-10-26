# Stella - AI English Tutor Architecture

## System Overview

Stella is a Next.js-based AI English tutor that helps Japanese learners practice English conversation through both text and voice interfaces. The system uses OpenAI's GPT models for text-based tutoring and Realtime API for voice interactions.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend - Next.js App Router"
        Login[Login Page]
        Home[Home Page]
        FreeConv[Free Conversation Page]
        Profile[User Profile Page]

        subgraph "UI Components"
            OrbBG[OrbBG - Background]
            Orb[Orb - Visual Avatar]
            BubbleContainer[BubbleContainer - Messages]
            FloatingBubble[FloatingBubble - Message Bubbles]
            FloatingTopicCard[FloatingTopicCard - Topic Suggestions]
            IntentCaption[IntentCaption - Command Display]
            TargetsPanel[TargetsPanel - Phrase Goals]
            TranscriptPane[TranscriptPane - Chat History]
            ProfileCards[ProfileCards - Stats Display]
            SpotlightCard[SpotlightCard - Glass Effect Container]
        end

        subgraph "State Management - Zustand"
            SessionStore[sessionStore - Session State]
            BubbleStore[bubbleStore - UI State]
        end

        subgraph "Hooks & Utilities"
            UseRealtime[useRealtime - WebRTC Manager]
            IntentRouter[intentRouter - Command Parser]
        end
    end

    subgraph "Backend - API Routes"
        PlannerAPI[/api/planner - Generate Micro-Pack]
        TutorAPI[/api/tutor - Text Tutoring]
        SummarizeAPI[/api/summarize - Session Summary]
        RealtimeTokenAPI[/api/realtime-token - WebRTC Token]
        RealtimeSessionAPI[/api/realtime-session - Session Config]
    end

    subgraph "External Services"
        OpenAIText[OpenAI GPT-5-nano - Text]
        OpenAIRealtime[OpenAI Realtime API - Voice]
        Supabase[(Supabase PostgreSQL)]
        SupabaseAuth[Supabase Auth]
    end

    FreeConv --> UseRealtime
    FreeConv --> BubbleContainer
    FreeConv --> Orb
    FreeConv --> FloatingTopicCard

    UseRealtime --> RealtimeTokenAPI
    UseRealtime --> OpenAIRealtime

    Home --> IntentRouter
    FreeConv --> IntentRouter

    IntentRouter --> PlannerAPI
    IntentRouter --> SummarizeAPI

    BubbleContainer --> FloatingBubble

    PlannerAPI --> OpenAIText
    TutorAPI --> OpenAIText

    PlannerAPI --> Supabase
    SummarizeAPI --> Supabase
    RealtimeTokenAPI --> Supabase

    Login --> SupabaseAuth
    Profile --> Supabase

    SessionStore <--> FreeConv
    BubbleStore <--> BubbleContainer
```

## Data Flow Architecture

### 1. Session Start Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend<br/>(Free Conversation Page)
    participant IR as Intent Router
    participant Plan as /api/planner
    participant DB as Supabase
    participant AI as OpenAI GPT
    participant SS as Session Store

    U->>FE: Navigate to /free_conversation
    FE->>DB: Check auth & load profile
    DB-->>FE: User profile (CEFR level)

    FE->>Plan: POST { cefr: "B1" }
    Plan->>AI: Generate micro-pack prompt
    AI-->>Plan: { targets: [...], grammar, pron }

    Plan-->>FE: Micro-pack with 3 phrases
    FE->>DB: Create session record
    FE->>DB: Insert target phrases
    DB-->>FE: Session ID

    FE->>SS: startSession(sessionId, targets)
    SS-->>FE: Session active

    FE->>U: Display conversation UI
```

### 2. Text Conversation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Free Conversation Page
    participant SS as Session Store
    participant API as /api/tutor
    participant AI as OpenAI GPT
    participant BS as Bubble Store

    U->>FE: Type message & press Enter
    FE->>SS: addTurn('user', message)
    FE->>BS: addUserMessage(message)
    BS-->>FE: Display user bubble

    FE->>API: POST { userText, cefr, activeTargets }
    API->>AI: Generate response with prompt
    AI-->>API: { reply, corrections, usedTargets }

    API-->>FE: Tutor response
    FE->>SS: addTurn('tutor', reply)
    FE->>BS: addTutorMessage(reply)
    BS-->>FE: Display tutor bubble

    FE->>SS: markTargetUsed(phrase)
    SS-->>FE: Update target status
```

### 3. Voice Conversation Flow (Realtime API)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Free Conversation Page
    participant RT as useRealtime Hook
    participant Token as /api/realtime-token
    participant DB as Supabase
    participant OAI as OpenAI Realtime API
    participant SS as Session Store

    U->>FE: Click Start
    FE->>RT: start({ userId, sessionId })

    RT->>RT: Request microphone access
    RT->>Token: POST { userId, sessionId }
    Token->>DB: Get user CEFR & targets
    DB-->>Token: User data
    Token->>OAI: Create ephemeral session
    OAI-->>Token: { token, expires_at }
    Token-->>RT: Session credentials + prompt

    RT->>RT: Create WebRTC PeerConnection
    RT->>RT: Add audio tracks
    RT->>RT: Create data channel
    RT->>OAI: Exchange SDP offer/answer
    OAI-->>RT: WebRTC connected

    RT->>OAI: Send session config
    RT-->>FE: Status: connected

    U->>RT: Speak into microphone
    RT->>OAI: Audio stream (PCM16)

    OAI->>OAI: Process speech & generate response
    OAI-->>RT: Audio response + transcript
    RT->>RT: Play audio through speaker
    RT->>SS: addTurn('tutor', transcript)
    RT-->>FE: Update UI
```

### 4. Session End Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant IR as Intent Router
    participant API as /api/summarize
    participant DB as Supabase
    participant SS as Session Store

    U->>FE: Say "stop" or click Stop
    FE->>IR: executeIntent({ type: 'stop' })

    IR->>SS: Get session data
    SS-->>IR: { sessionId, targets, transcript }

    IR->>IR: Calculate used/missed targets
    IR->>API: POST { sessionId, usedTargets, missedTargets, corrections }

    API->>DB: Update sessions.summary
    API->>DB: Update targets (planned → attempted/mastered)
    API->>DB: Upsert errors with counts
    API->>DB: Insert fluency_snapshots
    DB-->>API: Success

    API-->>IR: Success
    IR->>SS: endSession()
    SS-->>FE: Clear session state

    FE->>U: Navigate to /home
```

## Database Schema

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : has
    USERS ||--o{ TARGETS : has
    USERS ||--o{ ERRORS : has
    USERS ||--o{ FLUENCY_SNAPSHOTS : has
    SESSIONS ||--o{ FLUENCY_SNAPSHOTS : records

    USERS {
        uuid id PK
        uuid auth_user_id UK
        text display_name
        text native_language
        text cefr_level "A1-C2"
        timestamptz created_at
    }

    SESSIONS {
        uuid id PK
        uuid user_id FK
        timestamptz started_at
        timestamptz ended_at
        int speaking_ms
        int student_turns
        int tutor_turns
        int adoption_score
        jsonb summary
    }

    TARGETS {
        uuid id PK
        uuid user_id FK
        text phrase
        text cefr
        text status "planned|attempted|mastered"
        timestamptz first_seen_at
        timestamptz last_seen_at
    }

    ERRORS {
        uuid id PK
        uuid user_id FK
        text type "grammar|vocab|pron"
        text example
        text correction
        int count
        timestamptz last_seen_at
    }

    FLUENCY_SNAPSHOTS {
        uuid id PK
        uuid user_id FK
        uuid session_id FK
        numeric wpm
        numeric filler_rate
        int avg_pause_ms
        timestamptz created_at
    }
```

## Component Hierarchy

```mermaid
graph TD
    App[app/layout.tsx]

    App --> Login[app/login/page.tsx]
    App --> Home[app/home/page.tsx]
    App --> FreeConv[app/free_conversation/page.tsx]
    App --> Profile[app/user_profile/page.tsx]

    subgraph "Free Conversation Page"
        FreeConv --> OrbBG1[OrbBG]
        FreeConv --> IntentCaption
        FreeConv --> BubbleContainer
        FreeConv --> FloatingTopicContainer
        FreeConv --> Orb
        FreeConv --> Input[Input Form]

        BubbleContainer --> FloatingBubble1[FloatingBubble - User]
        BubbleContainer --> FloatingBubble2[FloatingBubble - Tutor]

        FloatingTopicContainer --> FloatingTopicCard1[FloatingTopicCard 1]
        FloatingTopicContainer --> FloatingTopicCard2[FloatingTopicCard 2]
        FloatingTopicContainer --> FloatingTopicCard3[FloatingTopicCard 3]

        FloatingTopicCard1 --> ElectricBorder1[ElectricBorder]
    end

    subgraph "Home Page"
        Home --> OrbBG2[OrbBG]
        Home --> IntentCaption2[IntentCaption]
    end

    subgraph "Profile Page"
        Profile --> OrbBG3[OrbBG]
        Profile --> ProfileCards
    end
```

## State Management Architecture

```mermaid
graph LR
    subgraph "Session Store (Zustand)"
        User[user: UserProfile]
        SessionId[sessionId: string]
        Transcript[transcript: TranscriptTurn[]]
        ActiveTargets[activeTargets: TargetStatus[]]
        Stats[stats: SessionStats]
        VoiceMode[isVoiceMode: boolean]
        Intent[currentIntent: string]
    end

    subgraph "Bubble Store (Zustand)"
        Bubbles[bubbles: Bubble[]]
        ShowTranscript[showTutorTranscript: boolean]
    end

    subgraph "Actions"
        StartSession[startSession]
        EndSession[endSession]
        AddTurn[addTurn]
        MarkTarget[markTargetUsed]
        AddUserMsg[addUserMessage]
        AddTutorMsg[addTutorMessage]
    end

    FreeConv2[Free Conversation Page] --> StartSession
    FreeConv2 --> AddTurn
    FreeConv2 --> AddUserMsg

    StartSession --> SessionId
    StartSession --> ActiveTargets
    AddTurn --> Transcript
    AddUserMsg --> Bubbles
```

## AI Integration Architecture

```mermaid
graph TB
    subgraph "Text Mode - GPT-5-nano"
        PlannerPrompt["System: Generate 3 phrases + grammar + pron<br/>User: CEFR level + interests"]
        TutorPrompt["System: Natural conversation tutor<br/>Mode: light/standard/exam<br/>User: Student's message + CEFR"]

        PlannerPrompt --> PlannerAI[OpenAI GPT-5-nano]
        TutorPrompt --> TutorAI[OpenAI GPT-5-nano]

        PlannerAI --> MicroPack["{ targets: [...], grammar, pron }"]
        TutorAI --> TutorReply["{ reply, corrections, usedTargets }"]
    end

    subgraph "Voice Mode - Realtime API"
        RealtimePrompt["System: Warm California tutor<br/>CEFR + Active Targets<br/>Natural conversation style"]

        RealtimePrompt --> RealtimeSession[OpenAI Realtime Session]

        AudioInput[User Speech] --> WebRTC[WebRTC Connection]
        WebRTC --> RealtimeSession

        RealtimeSession --> AudioOutput[Tutor Voice]
        RealtimeSession --> Transcript2[Audio Transcript]
        RealtimeSession --> FunctionCalls["Function Calls:<br/>- mark_target_used<br/>- add_correction<br/>- end_session<br/>- navigate"]
    end
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **UI Components**: Custom components with glass morphism effects
- **Audio**: Web Audio API + WebRTC

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **AI Models**:
  - OpenAI GPT-5-nano (text)
  - OpenAI Realtime API (voice)

### Infrastructure
- **Hosting**: Vercel (recommended)
- **Database**: Supabase (PostgreSQL with RLS)
- **Real-time Communication**: WebRTC + OpenAI Realtime API

## Security Architecture

```mermaid
graph TB
    Client[Client Browser]

    subgraph "Authentication Layer"
        SupabaseAuth[Supabase Auth]
        RLS[Row Level Security]
    end

    subgraph "API Layer"
        APIRoutes[Next.js API Routes]
        ServerClient[Supabase Server Client]
    end

    subgraph "Data Layer"
        Database[(Supabase PostgreSQL)]
    end

    Client -->|Login| SupabaseAuth
    SupabaseAuth -->|JWT Token| Client

    Client -->|API Request + JWT| APIRoutes
    APIRoutes -->|Verify Token| ServerClient
    ServerClient -->|Query with RLS| Database

    Database -->|Filter by auth.uid| RLS
    RLS -->|User's Data Only| ServerClient
```

### RLS Policies
- Users can only view/insert/update their own records
- All tables have policies matching `auth.uid()` to `users.auth_user_id`
- Server-side validation ensures no data leakage

## File Structure

```
stella/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing page
│   ├── login/page.tsx          # Auth page
│   ├── home/page.tsx           # Dashboard
│   ├── free_conversation/      # Main conversation UI
│   │   └── page.tsx
│   ├── user_profile/           # User stats & settings
│   │   └── page.tsx
│   └── api/
│       ├── planner/route.ts    # Generate micro-pack
│       ├── tutor/route.ts      # Text tutoring
│       ├── summarize/route.ts  # Session summary
│       ├── realtime-token/     # WebRTC ephemeral token
│       │   └── route.ts
│       └── realtime-session/   # Session config
│           └── route.ts
├── components/
│   ├── OrbBG.tsx              # Background with orb effect
│   ├── Orb.tsx                # 3D orb avatar
│   ├── BubbleContainer.tsx    # Message display manager
│   ├── FloatingBubble.tsx     # Individual message bubble
│   ├── FloatingTopicCard.tsx  # Topic suggestion card
│   ├── FloatingTopicContainer.tsx
│   ├── IntentCaption.tsx      # Command feedback display
│   ├── TargetsPanel.tsx       # Phrase goals sidebar
│   ├── TranscriptPane.tsx     # Chat history
│   ├── ProfileCards.tsx       # User stats cards
│   ├── SpotlightCard.tsx      # Glass effect container
│   └── ElectricBorder.tsx     # Animated border effect
├── lib/
│   ├── aiContracts.ts         # TypeScript types for AI I/O
│   ├── schema.ts              # Zod validation schemas
│   ├── supabaseClient.ts      # Client-side Supabase
│   ├── supabaseServer.ts      # Server-side Supabase
│   ├── sessionStore.ts        # Zustand session state
│   ├── bubbleStore.ts         # Zustand UI state
│   ├── intentRouter.ts        # Command parser & executor
│   ├── useRealtime.ts         # WebRTC hook
│   ├── topicSuggestions.ts    # Topic generation logic
│   └── utils.ts               # Utility functions
└── sql/
    └── schema.sql             # Database schema + RLS policies
```

## Key Design Patterns

### 1. Intent-Driven Navigation
- Text or voice commands are parsed into intents
- Intent router handles execution uniformly
- Supports: start, stop, navigate, add_target

### 2. Dual-Mode Communication
- Text mode: Traditional request/response via /api/tutor
- Voice mode: Real-time bidirectional via WebRTC
- Both modes share the same state management

### 3. Optimistic UI Updates
- User messages appear immediately
- Background API calls update state
- Provides fast, responsive experience

### 4. Progressive Enhancement
- Core text functionality works without WebRTC
- Voice mode adds real-time capabilities
- Graceful fallback for unsupported browsers

### 5. Micro-Pack Learning
- AI generates 3 target phrases per session
- Phrases tracked through planned → attempted → mastered
- Spaced repetition through error tracking

## Performance Considerations

### Client-Side
- Zustand for minimal re-renders
- Component lazy loading
- Audio streaming (no buffering)
- Efficient WebRTC connection reuse

### Server-Side
- Edge functions for low latency (Vercel)
- Database indexes on user_id, status, session_id
- Ephemeral tokens (expire after use)
- Connection pooling via Supabase

### Database
- RLS policies use indexed columns
- JSONB for flexible summary storage
- Timestamps for temporal queries
- Cascade deletes for data integrity
