-- Migration: Add user_progress table and progress_summary view
-- This enables weekly progress tracking and visualization

create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  week_start date not null,

  -- Score metrics (0-100 scale)
  grammar_score numeric,
  pronunciation_score numeric,
  vocabulary_score numeric,
  fluency_score numeric,

  -- Error counts for context
  grammar_errors int default 0,
  pronunciation_errors int default 0,
  vocabulary_errors int default 0,
  fluency_errors int default 0,

  -- Session activity
  total_sessions int default 0,
  total_test_sessions int default 0,

  created_at timestamptz default now(),

  -- Unique constraint to prevent duplicate weekly entries
  unique(user_id, week_start)
);

-- Enable RLS
alter table public.user_progress enable row level security;

-- RLS Policies
create policy "Users can view own progress"
  on public.user_progress for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own progress"
  on public.user_progress for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update own progress"
  on public.user_progress for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Indexes for performance
create index if not exists idx_user_progress_user_id on public.user_progress(user_id);
create index if not exists idx_user_progress_week_start on public.user_progress(week_start desc);

-- View for aggregating weekly progress from feedback_tips and sessions
create or replace view progress_summary as
select
  ft.user_id,
  date_trunc('week', ft.created_at)::date as week_start,

  -- Error counts by category
  count(*) filter (where ft.category = 'grammar') as grammar_errors,
  count(*) filter (where ft.category = 'pronunciation') as pronunciation_errors,
  count(*) filter (where ft.category = 'vocabulary') as vocabulary_errors,
  count(*) filter (where ft.category = 'fluency') as fluency_errors,

  -- Calculate scores (inverse of error count, normalized)
  -- Higher errors = lower score. Max 100, min 0.
  greatest(0, 100 - count(*) filter (where ft.category = 'grammar') * 5)::numeric as grammar_score,
  greatest(0, 100 - count(*) filter (where ft.category = 'pronunciation') * 5)::numeric as pronunciation_score,
  greatest(0, 100 - count(*) filter (where ft.category = 'vocabulary') * 5)::numeric as vocabulary_score,
  greatest(0, 100 - count(*) filter (where ft.category = 'fluency') * 5)::numeric as fluency_score,

  -- Count unique accent test sessions
  count(distinct ft.accent_test_id) as total_test_sessions

from public.feedback_tips ft
group by ft.user_id, week_start;

-- Function to update user_progress from the summary view
-- This can be called manually or via an edge function
create or replace function update_user_progress()
returns void
language plpgsql
security definer
as $$
begin
  insert into public.user_progress (
    user_id,
    week_start,
    grammar_score,
    pronunciation_score,
    vocabulary_score,
    fluency_score,
    grammar_errors,
    pronunciation_errors,
    vocabulary_errors,
    fluency_errors,
    total_test_sessions
  )
  select
    user_id,
    week_start,
    grammar_score,
    pronunciation_score,
    vocabulary_score,
    fluency_score,
    grammar_errors,
    pronunciation_errors,
    vocabulary_errors,
    fluency_errors,
    total_test_sessions
  from progress_summary
  on conflict (user_id, week_start)
  do update set
    grammar_score = excluded.grammar_score,
    pronunciation_score = excluded.pronunciation_score,
    vocabulary_score = excluded.vocabulary_score,
    fluency_score = excluded.fluency_score,
    grammar_errors = excluded.grammar_errors,
    pronunciation_errors = excluded.pronunciation_errors,
    vocabulary_errors = excluded.vocabulary_errors,
    fluency_errors = excluded.fluency_errors,
    total_test_sessions = excluded.total_test_sessions;

  -- Also count conversation sessions from sessions table
  update public.user_progress up
  set total_sessions = (
    select count(*)
    from public.sessions s
    where s.user_id = up.user_id
    and date_trunc('week', s.started_at)::date = up.week_start
  );
end;
$$;
