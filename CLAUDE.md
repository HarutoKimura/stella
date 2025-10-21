# AI English Tutor MVP - Next.js + Supabase

You are an expert full-stack engineer. Generate a runnable Next.js (App Router) + Supabase MVP for an AI English tutor with these routes only:

- `/login`
- `/home` (Free Conversation only)
- `/free_conversation`
- `/user_profile`

We'll do text-first now, but design the code to easily add voice + OpenAI Realtime later. No buttons needed for core flows later; for Phase 1 keep minimal buttons/links if absolutely necessary for navigation debugging, but implement a simple intent router that can be driven by text commands ("start", "stop", "profile") so we can swap in voice intents later.

## Tech & Libraries

- **Next.js 14+** (App Router, TypeScript)
- **TailwindCSS** + shadcn/ui (optional) + reactbits orb background
- **State:** Zustand
- **DB/Auth:** Supabase (RLS on)
- **AI:** OpenAI (gpt-4o-mini) via server routes (text only for Phase 1)
- **Charts:** lightweight (e.g., recharts or chart.js)

## Environment

Create `.env.local.example` with:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # only used server-side if needed
```

## File Tree (scaffold)

```
/app
  /(routes)
    /login/page.tsx
    /home/page.tsx
    /free_conversation/page.tsx
    /user_profile/page.tsx
  /api
    /planner/route.ts      # creates micro-pack
    /tutor/route.ts        # enforces targets, returns reply+corrections
    /summarize/route.ts    # persists session summary+metrics
    /realtime-token/route.ts  # stub for Phase 2 (returns 501 for now)
 /components
   OrbBG.tsx               # reactbits orb wrapper layout
   IntentCaption.tsx       # shows recognized intent ("start", "stop", "profile")
   TargetsPanel.tsx
   TranscriptPane.tsx
   ProfileCards.tsx
 /lib
   supabaseClient.ts
   schema.ts               # zod schemas for API I/O
   aiContracts.ts          # shared JSON contracts (planner/tutor/summarizer)
   intentRouter.ts         # maps text command → UI actions
   sessionStore.ts         # Zustand store
 /styles (tailwind config etc.)
 /sql/schema.sql           # Supabase tables
```

## Supabase Schema (run in sql/schema.sql)

Use exactly this (can adjust types if needed):

```sql
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  display_name text,
  native_language text default 'ja',
  cefr_level text check (cefr_level in ('A1','A2','B1','B2','C1','C2')) default 'B1',
  created_at timestamptz default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  speaking_ms int default 0,
  student_turns int default 0,
  tutor_turns int default 0,
  adoption_score int default 0,
  summary jsonb default '{}'::jsonb
);

create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  phrase text not null,
  cefr text,
  status text check (status in ('planned','attempted','mastered')) default 'planned',
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

create table if not exists public.errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  type text check (type in ('grammar','vocab','pron')),
  example text,
  correction text,
  count int default 1,
  last_seen_at timestamptz default now()
);

create table if not exists public.fluency_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.sessions(user_id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  wpm numeric,
  filler_rate numeric,
  avg_pause_ms int,
  created_at timestamptz default now()
);
```

Enable RLS on all tables. Policies: user can select/insert/update rows where auth.uid() maps to their users.auth_user_id and matching user_id.

## Shared JSON Contracts (/lib/aiContracts.ts)

```typescript
export type MicroPack = {
  targets: { phrase: string; cefr: string }[];
  grammar: string;
  pron: string;
};

export type TutorTurnIn = {
  userText: string;
  cefr: string;
  activeTargets: string[];  // phrases to enforce
  mode: "gentle" | "turn" | "post";
};

export type TutorTurnOut = {
  reply: string;
  corrections: { type: "grammar" | "vocab" | "pron"; example: string; correction: string }[];
  enforce?: { must_use_next?: string };
  metrics?: { fillers?: number; pause_ms?: number };
  usedTargets: string[];
  missedTargets: string[];
};

export type SessionSummaryIn = {
  sessionId: string;
  usedTargets: string[];
  missedTargets: string[];
  corrections: TutorTurnOut["corrections"];
  metrics?: { wpm?: number; filler_rate?: number; avg_pause_ms?: number };
};
```

## API Routes (Phase 1: text only)

### `/api/planner` (POST)
- **Input:** `{ cefr, lastErrors?: string[], interests?: string[] }`
- **Output:** `MicroPack`
- Implement with OpenAI (gpt-4o-mini) and deterministic prompt.

### `/api/tutor` (POST)
- **Input:** `TutorTurnIn`
- **Output:** `TutorTurnOut`
- Prompt the model to be concise, enforce must-use phrase, batch corrections every 2–3 turns, and keep student speaking ≥65% of the time.

### `/api/summarize` (POST)
- **Input:** `SessionSummaryIn`
- Write to targets (advance status to attempted/mastered), upsert errors with counts, insert fluency_snapshots, and update sessions.summary.

### `/api/realtime-token` (GET)
- Return 501 + TODO comment; leave a function stub showing how ephemeral tokens will be created in Phase 2.

## Intent Router (text now; voice later)

Implement `/lib/intentRouter.ts`:

Recognize `start`, `stop`, `home`, `profile`, `add "<phrase>"`.

Export handlers that call Zustand actions:

- `navigate('/free_conversation')`
- `startSession()` → calls `/api/planner`, seeds targets and creates sessions row
- `endSession()` → calls `/api/summarize`
- `addTarget(phrase)`

Show the detected intent in `<IntentCaption />` so the UI is ready for voice-driven UX.

## Pages & UI (with reactbits orb)

Create `<OrbBG>` that wraps each page (full-screen orb background from reactbits).

### `/login`
Supabase Auth UI (email/pass; passkey later), after login redirect `/home`.

### `/home`
Heading "Ready to practice?", live `<IntentCaption />`. Minimal link "say: start".

### `/free_conversation`
- **Left:** `<TranscriptPane>` (user & tutor turns).
- **Right:** `<TargetsPanel>` shows 3 targets + live notes (used/missed).
- **Footer:** small input box (simulate voice by typing; press Enter triggers router).

### `/user_profile`
- Cards: total phrases mastered, weekly mastered count, simple trend chart from fluency_snapshots.
- Editable CEFR with optimistic update.

## State (Zustand) `/lib/sessionStore.ts`

### Store:
```typescript
{
  user: { id, displayName, cefr },
  sessionId?: string,
  transcript: { role: "user" | "tutor"; text: string }[],
  activeTargets: string[],
  stats: { studentTurns: number; tutorTurns: number; speakingMs: number }
}
```

**Actions:** `startSession`, `endSession`, `addTurn`, `markTargetUsed`, `navigate`.

## Prompts (concise)

### Planner system prompt (server only, not exposed):
> "You generate a micro-pack (3 phrases + 1 grammar + 1 pronunciation) for a Japanese English learner at CEFR {cefr}. Choose phrases slightly above current level, practical for everyday conversation and common situations. Return JSON exactly."

### Tutor system prompt:
> "You are a strict but friendly English tutor. Keep student speaking ≥65% of the time. Enforce use of target phrases. Do not overtalk; wait 3–5 seconds before hints. Batch corrections every 2–3 turns. Output JSON per contract."

### Summarizer rule:
> "Compute used vs missed targets from turns; mark 'mastered' if used correctly ≥2 times."

## Acceptance Criteria

- ✅ Auth works; login → `/home`.
- ✅ "start" in `/home` navigates to `/free_conversation`, calls `/api/planner`, shows 3 targets.
- ✅ User enters text; `/api/tutor` responds; transcript updates; used/missed tracked.
- ✅ "stop" ends session, calls `/api/summarize`, writes to Supabase, redirects to `/home`.
- ✅ `/user_profile` loads metrics: mastered phrase count, simple chart from fluency_snapshots.
- ✅ Orb background visible across pages; `<IntentCaption />` shows recognized intent.
- ✅ Code is modular; realtime-token stub exists for Phase 2.

## Commands & Docs

Provide `README.md` with:

- Setup (Supabase project, run `sql/schema.sql`, set envs)
- `pnpm i && pnpm dev`
- How to test the loop end-to-end
- Notes for Phase 2 (voice + tool-calls, using `/api/realtime-token`)

## Stretch (only if time)

- Basic RLS policies script.
- Simple migration script.
- Unit tests for intentRouter.