-- Migration: Add clarity_focus table for tracking lowest-accuracy pronunciation words
-- This table stores 3-5 words with the lowest pronunciation accuracy from each session
-- to help users focus on their most challenging pronunciations

-- Create clarity_focus table
create table if not exists public.clarity_focus (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  word text not null,
  accuracy_score numeric not null,
  segment_index int,
  phonemes jsonb,
  created_at timestamptz default now()
);

-- Create indexes for performance
create index if not exists idx_clarity_focus_session_id on public.clarity_focus(session_id);
create index if not exists idx_clarity_focus_user_id on public.clarity_focus(user_id);
create index if not exists idx_clarity_focus_accuracy on public.clarity_focus(accuracy_score);
create index if not exists idx_clarity_focus_word on public.clarity_focus(word);

-- Enable RLS
alter table public.clarity_focus enable row level security;

-- RLS Policies
create policy "Users can view own clarity focus words"
  on public.clarity_focus for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own clarity focus words"
  on public.clarity_focus for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Allow server to insert via service role (bypasses RLS)
create policy "Allow server inserts for clarity focus"
  on public.clarity_focus for insert
  with check (true);

-- Comment on table
comment on table public.clarity_focus is 'Stores the 3-5 lowest-accuracy words from each session for focused pronunciation practice';
comment on column public.clarity_focus.word is 'The word that had low pronunciation accuracy';
comment on column public.clarity_focus.accuracy_score is 'Pronunciation accuracy score from Azure (0-100)';
comment on column public.clarity_focus.segment_index is 'Which audio segment this word was from';
comment on column public.clarity_focus.phonemes is 'Detailed phoneme-level data from Azure assessment';
