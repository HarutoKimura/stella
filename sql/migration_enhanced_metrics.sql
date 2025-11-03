-- Enhanced Metrics Migration
-- This adds comprehensive statistical tracking for language learning progress

-- 1. Add new columns to fluency_snapshots for comprehensive tracking
alter table public.fluency_snapshots
  add column if not exists mean_utterance_length numeric,      -- Average words per turn
  add column if not exists unique_words_count int,              -- Vocabulary diversity
  add column if not exists total_words_count int,               -- Total words spoken
  add column if not exists grammar_accuracy numeric,            -- % of grammatically correct utterances
  add column if not exists pronunciation_score numeric,         -- 0-100 pronunciation quality
  add column if not exists turn_ratio numeric,                  -- User speaking time / total time
  add column if not exists confidence_score numeric;            -- 0-100 based on sentiment analysis

-- 2. Create progress_metrics table for session-level comprehensive metrics
create table if not exists public.progress_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,

  -- Speaking metrics
  fluency_score numeric default 0,                    -- Composite: WPM + pause ratio
  grammar_score numeric default 0,                    -- Grammar accuracy %
  vocabulary_score numeric default 0,                 -- Lexical diversity + CEFR level
  comprehension_score numeric default 0,              -- Understanding of tutor questions
  confidence_score numeric default 0,                 -- Affective dimension

  -- Detailed breakdown
  total_words int default 0,
  unique_words int default 0,
  lexical_diversity numeric default 0,                -- type-token ratio
  cefr_distribution jsonb default '{}'::jsonb,        -- {"A1": 5, "A2": 10, "B1": 20, ...}

  -- Error analysis
  grammar_errors int default 0,
  vocab_errors int default 0,
  pronunciation_errors int default 0,
  total_errors int default 0,

  -- Engagement
  response_time_avg_ms int default 0,                 -- Avg time to respond
  topic_switches int default 0,                       -- Conversation breadth

  -- Overall composite score (EGI - English Growth Index)
  egi_score numeric default 0,                        -- Weighted composite: 0-100

  created_at timestamptz default now()
);

-- 3. Create weekly_progress table for aggregated statistics
create table if not exists public.weekly_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  week_start_date date not null,

  -- Aggregated metrics
  total_sessions int default 0,
  total_minutes int default 0,
  avg_fluency_score numeric default 0,
  avg_grammar_score numeric default 0,
  avg_vocabulary_score numeric default 0,
  avg_egi_score numeric default 0,

  -- Learning progress
  phrases_mastered int default 0,
  new_vocabulary int default 0,
  error_reduction_rate numeric default 0,              -- % decrease from previous week

  -- Streak tracking
  days_practiced int default 0,
  streak_maintained boolean default false,

  created_at timestamptz default now(),
  unique(user_id, week_start_date)
);

-- 4. Create cefr_trajectory table for long-term tracking
create table if not exists public.cefr_trajectory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  estimated_cefr text check (estimated_cefr in ('A1','A2','B1','B2','C1','C2')),
  confidence_level numeric default 0,                  -- 0-1 confidence in estimation
  evaluation_basis jsonb default '{}'::jsonb,          -- {"fluency": "B1", "grammar": "A2", ...}
  notes text,
  created_at timestamptz default now()
);

-- 5. Enable RLS on new tables
alter table public.progress_metrics enable row level security;
alter table public.weekly_progress enable row level security;
alter table public.cefr_trajectory enable row level security;

-- RLS Policies for progress_metrics
create policy "Users can view own progress metrics"
  on public.progress_metrics for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own progress metrics"
  on public.progress_metrics for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- RLS Policies for weekly_progress
create policy "Users can view own weekly progress"
  on public.weekly_progress for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own weekly progress"
  on public.weekly_progress for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update own weekly progress"
  on public.weekly_progress for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- RLS Policies for cefr_trajectory
create policy "Users can view own CEFR trajectory"
  on public.cefr_trajectory for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own CEFR trajectory"
  on public.cefr_trajectory for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- 6. Create indexes for performance
create index if not exists idx_progress_metrics_user_id on public.progress_metrics(user_id);
create index if not exists idx_progress_metrics_session_id on public.progress_metrics(session_id);
create index if not exists idx_progress_metrics_created_at on public.progress_metrics(created_at);

create index if not exists idx_weekly_progress_user_id on public.weekly_progress(user_id);
create index if not exists idx_weekly_progress_week_start on public.weekly_progress(week_start_date);

create index if not exists idx_cefr_trajectory_user_id on public.cefr_trajectory(user_id);
create index if not exists idx_cefr_trajectory_created_at on public.cefr_trajectory(created_at);

-- 7. Create helper function to calculate EGI score
create or replace function calculate_egi(
  fluency numeric,
  grammar numeric,
  vocabulary numeric,
  comprehension numeric,
  confidence numeric
) returns numeric as $$
begin
  -- EGI = 0.3F + 0.25G + 0.2V + 0.15C + 0.1M
  return (
    0.30 * coalesce(fluency, 0) +
    0.25 * coalesce(grammar, 0) +
    0.20 * coalesce(vocabulary, 0) +
    0.15 * coalesce(comprehension, 0) +
    0.10 * coalesce(confidence, 0)
  );
end;
$$ language plpgsql;

-- 8. Create helper function to get week start date
create or replace function get_week_start(date timestamptz) returns date as $$
begin
  return (date_trunc('week', date))::date;
end;
$$ language plpgsql;
