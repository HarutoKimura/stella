-- Migration: Link conversation_sessions to coach_sessions
-- This allows tracking which live conversations followed which structured practice sessions

-- Add foreign key column to link conversation to originating coach session
alter table public.conversation_sessions
add column coach_session_id uuid references public.coach_sessions(id) on delete set null;

-- Add index for performance when querying linked sessions
create index if not exists idx_conversation_sessions_coach_session
on public.conversation_sessions(coach_session_id);

-- Add comment for documentation
comment on column public.conversation_sessions.coach_session_id is
'References the structured practice session that led to this live conversation';
