-- Migration: Add weekly_insights table for AI-generated coaching feedback
-- This table stores personalized insights generated from weekly progress data

create table if not exists public.weekly_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  week_start date not null,

  -- Error counts snapshot (for context)
  grammar_errors int default 0,
  pronunciation_errors int default 0,
  vocabulary_errors int default 0,
  fluency_errors int default 0,

  -- AI-generated insight text
  insight_text text not null,

  -- Metadata
  created_at timestamptz default now(),

  -- Prevent duplicate insights per week
  unique(user_id, week_start)
);

-- Enable RLS
alter table public.weekly_insights enable row level security;

-- RLS Policies
create policy "Users can view own insights"
  on public.weekly_insights for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own insights"
  on public.weekly_insights for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Indexes for performance
create index if not exists idx_weekly_insights_user_id on public.weekly_insights(user_id);
create index if not exists idx_weekly_insights_week_start on public.weekly_insights(week_start desc);
create index if not exists idx_weekly_insights_user_id_date on public.weekly_insights(user_id, week_start desc);

-- Function to get weekly error aggregations for insights generation
create or replace function get_weekly_errors(target_user_id uuid)
returns table (
  week_start date,
  grammar_errors bigint,
  pronunciation_errors bigint,
  vocabulary_errors bigint,
  fluency_errors bigint
)
language sql
security definer
as $$
  select
    date_trunc('week', created_at)::date as week_start,
    count(*) filter (where category = 'grammar') as grammar_errors,
    count(*) filter (where category = 'pronunciation') as pronunciation_errors,
    count(*) filter (where category = 'vocabulary') as vocabulary_errors,
    count(*) filter (where category = 'fluency') as fluency_errors
  from feedback_tips
  where user_id = target_user_id
  group by week_start
  order by week_start desc
  limit 4; -- Last 4 weeks for trend analysis
$$;
