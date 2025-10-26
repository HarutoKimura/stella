-- Add goal tracking to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS goal_id text;

-- Add comment
COMMENT ON COLUMN public.users.goal_id IS 'Selected big goal ID from goal system';

-- Create index for faster goal queries
CREATE INDEX IF NOT EXISTS idx_users_goal_id ON public.users(goal_id);
