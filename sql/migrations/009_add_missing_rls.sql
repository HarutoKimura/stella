-- Migration: Add missing RLS policies for tables created in earlier migrations
-- This ensures all tables with user_id foreign keys have proper row-level security
-- FIXED VERSION: Only includes tables that actually exist

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE IF EXISTS public.progress_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cefr_trajectory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recommended_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.feedback_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.accent_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coach_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clarity_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_insights ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to make migration idempotent)
DROP POLICY IF EXISTS "Users can view own progress metrics" ON public.progress_metrics;
DROP POLICY IF EXISTS "Users can insert own progress metrics" ON public.progress_metrics;

DROP POLICY IF EXISTS "Users can view own weekly progress" ON public.weekly_progress;
DROP POLICY IF EXISTS "Users can insert own weekly progress" ON public.weekly_progress;
DROP POLICY IF EXISTS "Users can update own weekly progress" ON public.weekly_progress;

DROP POLICY IF EXISTS "Users can view own cefr trajectory" ON public.cefr_trajectory;
DROP POLICY IF EXISTS "Users can insert own cefr trajectory" ON public.cefr_trajectory;

DROP POLICY IF EXISTS "Users can view own recommended actions" ON public.recommended_actions;
DROP POLICY IF EXISTS "Users can insert own recommended actions" ON public.recommended_actions;
DROP POLICY IF EXISTS "Users can update own recommended actions" ON public.recommended_actions;

DROP POLICY IF EXISTS "Users can view own feedback tips" ON public.feedback_tips;
DROP POLICY IF EXISTS "Users can insert own feedback tips" ON public.feedback_tips;

DROP POLICY IF EXISTS "Users can view own accent tests" ON public.accent_tests;
DROP POLICY IF EXISTS "Users can insert own accent tests" ON public.accent_tests;

DROP POLICY IF EXISTS "Users can view own user progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can insert own user progress" ON public.user_progress;
DROP POLICY IF EXISTS "Users can update own user progress" ON public.user_progress;

DROP POLICY IF EXISTS "Users can view own coach sessions" ON public.coach_sessions;
DROP POLICY IF EXISTS "Users can insert own coach sessions" ON public.coach_sessions;
DROP POLICY IF EXISTS "Users can update own coach sessions" ON public.coach_sessions;

DROP POLICY IF EXISTS "Users can view own conversation sessions" ON public.conversation_sessions;
DROP POLICY IF EXISTS "Users can insert own conversation sessions" ON public.conversation_sessions;
DROP POLICY IF EXISTS "Users can update own conversation sessions" ON public.conversation_sessions;

-- Note: clarity_focus already has RLS policies from migration 008, so we skip it here

DROP POLICY IF EXISTS "Users can view own weekly insights" ON public.weekly_insights;
DROP POLICY IF EXISTS "Users can insert own weekly insights" ON public.weekly_insights;

-- RLS Policies for progress_metrics
CREATE POLICY "Users can view own progress metrics"
  ON public.progress_metrics FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own progress metrics"
  ON public.progress_metrics FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for weekly_progress
CREATE POLICY "Users can view own weekly progress"
  ON public.weekly_progress FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own weekly progress"
  ON public.weekly_progress FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own weekly progress"
  ON public.weekly_progress FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for cefr_trajectory
CREATE POLICY "Users can view own cefr trajectory"
  ON public.cefr_trajectory FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own cefr trajectory"
  ON public.cefr_trajectory FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for recommended_actions
CREATE POLICY "Users can view own recommended actions"
  ON public.recommended_actions FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own recommended actions"
  ON public.recommended_actions FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own recommended actions"
  ON public.recommended_actions FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for feedback_tips
CREATE POLICY "Users can view own feedback tips"
  ON public.feedback_tips FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own feedback tips"
  ON public.feedback_tips FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for accent_tests
CREATE POLICY "Users can view own accent tests"
  ON public.accent_tests FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own accent tests"
  ON public.accent_tests FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for user_progress (if not already added in 002 migration)
CREATE POLICY "Users can view own user progress"
  ON public.user_progress FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own user progress"
  ON public.user_progress FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own user progress"
  ON public.user_progress FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for coach_sessions
CREATE POLICY "Users can view own coach sessions"
  ON public.coach_sessions FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own coach sessions"
  ON public.coach_sessions FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own coach sessions"
  ON public.coach_sessions FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for conversation_sessions
CREATE POLICY "Users can view own conversation sessions"
  ON public.conversation_sessions FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own conversation sessions"
  ON public.conversation_sessions FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own conversation sessions"
  ON public.conversation_sessions FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- RLS Policies for weekly_insights
CREATE POLICY "Users can view own weekly insights"
  ON public.weekly_insights FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own weekly insights"
  ON public.weekly_insights FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Create indexes for better RLS performance
CREATE INDEX IF NOT EXISTS idx_progress_metrics_user_id ON public.progress_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_user_id ON public.weekly_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_cefr_trajectory_user_id ON public.cefr_trajectory(user_id);
CREATE INDEX IF NOT EXISTS idx_recommended_actions_user_id ON public.recommended_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_tips_user_id ON public.feedback_tips(user_id);
CREATE INDEX IF NOT EXISTS idx_accent_tests_user_id ON public.accent_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_user_id ON public.coach_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON public.conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_insights_user_id ON public.weekly_insights(user_id);
