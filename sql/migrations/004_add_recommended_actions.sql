-- Migration: Add recommended_actions table for AI-generated next steps
-- This table stores personalized action items generated from weekly insights

create table if not exists public.recommended_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  week_start date not null,
  category text not null check (category in ('Grammar', 'Pronunciation', 'Vocabulary', 'Fluency')),
  action_text text not null,
  completed boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.recommended_actions enable row level security;

-- RLS Policies
create policy "Users can view own actions"
  on public.recommended_actions for select
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can insert own actions"
  on public.recommended_actions for insert
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can update own actions"
  on public.recommended_actions for update
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "Users can delete own actions"
  on public.recommended_actions for delete
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Indexes for performance
create index if not exists idx_recommended_actions_user_id on public.recommended_actions(user_id);
create index if not exists idx_recommended_actions_week_start on public.recommended_actions(week_start desc);
create index if not exists idx_recommended_actions_user_id_date on public.recommended_actions(user_id, week_start desc);
create index if not exists idx_recommended_actions_completed on public.recommended_actions(user_id, completed);
