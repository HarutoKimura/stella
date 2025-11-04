-- Migration: Add conversation_sessions table for Realtime Conversation Mode
-- This table stores live AI conversation transcripts and feedback

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  week_id integer not null,
  focus_areas text[] not null,
  transcript jsonb not null default '[]'::jsonb,
  feedback text,
  avg_score float,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.conversation_sessions enable row level security;

-- RLS Policies
create policy "Users can view own conversation sessions"
  on public.conversation_sessions for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own conversation sessions"
  on public.conversation_sessions for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update own conversation sessions"
  on public.conversation_sessions for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete own conversation sessions"
  on public.conversation_sessions for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Indexes for performance
create index if not exists idx_conversation_sessions_user_id on public.conversation_sessions(user_id);
create index if not exists idx_conversation_sessions_week_id on public.conversation_sessions(week_id desc);
create index if not exists idx_conversation_sessions_user_week on public.conversation_sessions(user_id, week_id desc);
create index if not exists idx_conversation_sessions_created_at on public.conversation_sessions(user_id, created_at desc);
