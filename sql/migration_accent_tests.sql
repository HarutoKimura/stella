-- Migration: Add accent_tests table for AI accent assessment
-- This table stores results from the accent test feature

create table if not exists public.accent_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,

  -- Core scores
  egi_score int check (egi_score >= 0 and egi_score <= 100),
  cefr_level text check (cefr_level in ('A1','A2','B1','B2','C1','C2')),

  -- Component scores (0-100)
  pronunciation_score int check (pronunciation_score >= 0 and pronunciation_score <= 100),
  fluency_score int check (fluency_score >= 0 and fluency_score <= 100),
  grammar_score int check (grammar_score >= 0 and grammar_score <= 100),
  vocabulary_score int check (vocabulary_score >= 0 and vocabulary_score <= 100),
  confidence_score int check (confidence_score >= 0 and confidence_score <= 100),

  -- Azure raw scores
  azure_pronunciation numeric,
  azure_accuracy numeric,
  azure_fluency numeric,
  azure_completeness numeric,
  azure_prosody numeric,

  -- Audio metadata
  recognized_text text,
  audio_duration_ms int,

  -- OpenAI analysis
  ai_feedback jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

-- Enable RLS
alter table public.accent_tests enable row level security;

-- RLS Policies
create policy "Users can view own accent tests"
  on public.accent_tests for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own accent tests"
  on public.accent_tests for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Index for performance
create index if not exists idx_accent_tests_user_id on public.accent_tests(user_id);
create index if not exists idx_accent_tests_created_at on public.accent_tests(created_at desc);
