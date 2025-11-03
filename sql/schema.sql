-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Users table
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  display_name text,
  native_language text default 'ja',
  cefr_level text check (cefr_level in ('A1','A2','B1','B2','C1','C2')) default 'B1',
  correction_mode text check (correction_mode in ('immediate','balanced','gentle')) default 'balanced',
  created_at timestamptz default now()
);

-- Sessions table
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

-- Targets table
create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  phrase text not null,
  cefr text,
  status text check (status in ('planned','attempted','mastered')) default 'planned',
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

-- Errors table
create table if not exists public.errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  type text check (type in ('grammar','vocab','pron')),
  example text,
  correction text,
  count int default 1,
  last_seen_at timestamptz default now()
);

-- Fluency snapshots table
create table if not exists public.fluency_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  wpm numeric,
  filler_rate numeric,
  avg_pause_ms int,
  mean_utterance_length numeric,
  unique_words_count int,
  total_words_count int,
  grammar_accuracy numeric,
  pronunciation_score numeric,
  accuracy_score numeric,
  fluency_score numeric,
  prosody_score numeric,
  completeness_score numeric,
  turn_ratio numeric,
  confidence_score numeric,
  created_at timestamptz default now()
);

-- Enable Row Level Security on all tables
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.targets enable row level security;
alter table public.errors enable row level security;
alter table public.fluency_snapshots enable row level security;

-- RLS Policies for users table
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = auth_user_id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = auth_user_id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = auth_user_id);

-- RLS Policies for sessions table
create policy "Users can view own sessions"
  on public.sessions for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own sessions"
  on public.sessions for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update own sessions"
  on public.sessions for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- RLS Policies for targets table
create policy "Users can view own targets"
  on public.targets for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own targets"
  on public.targets for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update own targets"
  on public.targets for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- RLS Policies for errors table
create policy "Users can view own errors"
  on public.errors for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own errors"
  on public.errors for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update own errors"
  on public.errors for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- RLS Policies for fluency_snapshots table
create policy "Users can view own fluency snapshots"
  on public.fluency_snapshots for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own fluency snapshots"
  on public.fluency_snapshots for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Create indexes for better query performance
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_targets_user_id on public.targets(user_id);
create index if not exists idx_targets_status on public.targets(status);
create index if not exists idx_errors_user_id on public.errors(user_id);
create index if not exists idx_fluency_snapshots_user_id on public.fluency_snapshots(user_id);
create index if not exists idx_fluency_snapshots_session_id on public.fluency_snapshots(session_id);
