-- Migration: Add feedback_tips table for semantic linguistic feedback
-- This table stores actionable, contextual coaching insights from AI analysis

create table if not exists public.feedback_tips (
  id uuid primary key default gen_random_uuid(),
  accent_test_id uuid references public.accent_tests(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,

  -- Semantic feedback
  category text check (category in ('grammar', 'vocabulary', 'pronunciation', 'fluency', 'idiom', 'structure')) not null,

  -- Original vs corrected
  original_sentence text not null,
  corrected_sentence text not null,

  -- Actionable tip
  tip text not null,

  -- Additional context
  explanation text,
  severity text check (severity in ('low', 'medium', 'high')) default 'medium',

  created_at timestamptz default now()
);

-- Enable RLS
alter table public.feedback_tips enable row level security;

-- RLS Policies
create policy "Users can view own feedback tips"
  on public.feedback_tips for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own feedback tips"
  on public.feedback_tips for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Index for performance
create index if not exists idx_feedback_tips_accent_test_id on public.feedback_tips(accent_test_id);
create index if not exists idx_feedback_tips_user_id on public.feedback_tips(user_id);
create index if not exists idx_feedback_tips_created_at on public.feedback_tips(created_at desc);
create index if not exists idx_feedback_tips_category on public.feedback_tips(category);
