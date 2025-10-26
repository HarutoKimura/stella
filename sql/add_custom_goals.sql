-- Create custom_goals table for AI-generated personalized goals
CREATE TABLE IF NOT EXISTS public.custom_goals (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  icon text DEFAULT '🎯',
  estimated_weeks int DEFAULT 6,
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own custom goals"
  ON public.custom_goals FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own custom goals"
  ON public.custom_goals FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own custom goals"
  ON public.custom_goals FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own custom goals"
  ON public.custom_goals FOR DELETE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_goals_user_id ON public.custom_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_goals_created_at ON public.custom_goals(created_at DESC);

-- Comments
COMMENT ON TABLE public.custom_goals IS 'AI-generated personalized learning goals for each user';
COMMENT ON COLUMN public.custom_goals.milestones IS 'JSONB array of milestone objects with phrases and skill requirements';
COMMENT ON COLUMN public.custom_goals.original_description IS 'User''s original goal description used for AI generation';
