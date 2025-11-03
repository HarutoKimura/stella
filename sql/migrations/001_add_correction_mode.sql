-- Migration: Add correction_mode to users table
-- Date: 2025-10-30
-- Purpose: Enable users to choose their preferred correction timing and style

-- Add correction_mode column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS correction_mode TEXT
CHECK (correction_mode IN ('immediate', 'balanced', 'gentle'))
DEFAULT 'balanced';

-- Add index for performance (optional, but good practice)
CREATE INDEX IF NOT EXISTS idx_users_correction_mode ON public.users(correction_mode);

-- Update existing users to have default mode
UPDATE public.users
SET correction_mode = 'balanced'
WHERE correction_mode IS NULL;

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'correction_mode'
  ) THEN
    RAISE NOTICE '✅ Migration successful: correction_mode column added';
  ELSE
    RAISE EXCEPTION '❌ Migration failed: correction_mode column not found';
  END IF;
END $$;
