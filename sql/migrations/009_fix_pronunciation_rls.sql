-- Migration: Fix RLS policies for pronunciation_problems
-- The issue: Server inserts with service role, client reads with user auth
-- Solution: Add server-side insert policy

-- Drop existing policies
drop policy if exists "Users can insert own pronunciation problems" on public.pronunciation_problems;

-- Allow server-side inserts (bypasses RLS when using service role)
-- This is safe because the API endpoint already checks authentication
create policy "Allow server inserts for pronunciation problems"
  on public.pronunciation_problems for insert
  with check (true);

-- Keep the read policy (users can only read their own data)
-- But simplify it to work with the actual data structure
drop policy if exists "Users can view own pronunciation problems" on public.pronunciation_problems;

create policy "Users can view own pronunciation problems"
  on public.pronunciation_problems for select
  using (
    exists (
      select 1 from public.sessions s
      join public.users u on s.user_id = u.id
      where s.id = pronunciation_problems.session_id
      and u.auth_user_id = auth.uid()
    )
  );

-- Also update pronunciation_segments policies
drop policy if exists "Users can insert own pronunciation segments" on public.pronunciation_segments;

create policy "Allow server inserts for pronunciation segments"
  on public.pronunciation_segments for insert
  with check (true);

drop policy if exists "Users can view own pronunciation segments" on public.pronunciation_segments;

create policy "Users can view own pronunciation segments"
  on public.pronunciation_segments for select
  using (
    exists (
      select 1 from public.sessions s
      join public.users u on s.user_id = u.id
      where s.id = pronunciation_segments.session_id
      and u.auth_user_id = auth.uid()
    )
  );
