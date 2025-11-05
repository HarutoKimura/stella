-- Migration: Add pronunciation review tables
-- This enables post-session pronunciation analysis and word-level feedback

-- Table for storing pronunciation assessment results for each audio segment
create table if not exists public.pronunciation_segments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  audio_url text not null,
  transcript text,
  azure_json jsonb,
  created_at timestamptz default now()
);

-- Table for storing individual problem words extracted from assessments
create table if not exists public.pronunciation_problems (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  segment_id uuid references public.pronunciation_segments(id) on delete cascade,
  word text not null,
  accuracy float not null,
  start_offset_ms int,
  end_offset_ms int,
  audio_user_url text,
  audio_native_url text,
  created_at timestamptz default now()
);

-- Enable RLS on both tables
alter table public.pronunciation_segments enable row level security;
alter table public.pronunciation_problems enable row level security;

-- RLS Policies for pronunciation_segments
create policy "Users can view own pronunciation segments"
  on public.pronunciation_segments for select
  using (
    session_id in (
      select s.id from public.sessions s
      join public.users u on s.user_id = u.id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "Users can insert own pronunciation segments"
  on public.pronunciation_segments for insert
  with check (
    session_id in (
      select s.id from public.sessions s
      join public.users u on s.user_id = u.id
      where u.auth_user_id = auth.uid()
    )
  );

-- RLS Policies for pronunciation_problems
create policy "Users can view own pronunciation problems"
  on public.pronunciation_problems for select
  using (
    session_id in (
      select s.id from public.sessions s
      join public.users u on s.user_id = u.id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "Users can insert own pronunciation problems"
  on public.pronunciation_problems for insert
  with check (
    session_id in (
      select s.id from public.sessions s
      join public.users u on s.user_id = u.id
      where u.auth_user_id = auth.uid()
    )
  );

-- Indexes for performance
create index if not exists idx_pronunciation_segments_session_id
  on public.pronunciation_segments(session_id);
create index if not exists idx_pronunciation_segments_created_at
  on public.pronunciation_segments(session_id, created_at desc);

create index if not exists idx_pronunciation_problems_session_id
  on public.pronunciation_problems(session_id);
create index if not exists idx_pronunciation_problems_accuracy
  on public.pronunciation_problems(session_id, accuracy asc);
create index if not exists idx_pronunciation_problems_word
  on public.pronunciation_problems(word);

-- Add comments for documentation
comment on table public.pronunciation_segments is
  'Stores pronunciation assessment results for audio segments from conversation sessions';
comment on table public.pronunciation_problems is
  'Stores individual mispronounced words extracted from pronunciation assessments for review';
