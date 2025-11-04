-- Migration: Add coach_sessions table for AI Coach v2 feature
-- This table stores interactive AI practice sessions generated from weekly insights

create table if not exists public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  week_id integer not null,
  focus_areas text[] not null,
  dialogue jsonb not null,
  avg_score float,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.coach_sessions enable row level security;

-- RLS Policies
create policy "Users can view own sessions"
  on public.coach_sessions for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own sessions"
  on public.coach_sessions for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update own sessions"
  on public.coach_sessions for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete own sessions"
  on public.coach_sessions for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Indexes for performance
create index if not exists idx_coach_sessions_user_id on public.coach_sessions(user_id);
create index if not exists idx_coach_sessions_week_id on public.coach_sessions(week_id desc);
create index if not exists idx_coach_sessions_user_week on public.coach_sessions(user_id, week_id desc);
create index if not exists idx_coach_sessions_created_at on public.coach_sessions(user_id, created_at desc);
