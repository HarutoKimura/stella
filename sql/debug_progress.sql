-- Progress Dashboard Diagnostic Script
-- Run this to diagnose why /progress is empty

-- Step 1: Check if feedback_tips has data
SELECT 'feedback_tips data:' as check_step;
SELECT
  count(*) as total_tips,
  count(distinct user_id) as unique_users,
  count(distinct accent_test_id) as unique_tests,
  min(created_at) as oldest_tip,
  max(created_at) as newest_tip
FROM feedback_tips;

-- Step 2: Check feedback_tips by category
SELECT 'feedback_tips by category:' as check_step;
SELECT
  category,
  count(*) as count,
  count(distinct user_id) as unique_users
FROM feedback_tips
GROUP BY category
ORDER BY count DESC;

-- Step 3: Check what progress_summary view shows
SELECT 'progress_summary view (should aggregate feedback_tips):' as check_step;
SELECT * FROM progress_summary
ORDER BY week_start DESC
LIMIT 10;

-- Step 4: Check current user_progress table
SELECT 'user_progress table (what /progress page reads):' as check_step;
SELECT
  count(*) as total_rows,
  count(distinct user_id) as unique_users,
  min(week_start) as oldest_week,
  max(week_start) as newest_week
FROM user_progress;

-- Step 5: Show sample data if exists
SELECT 'Sample user_progress data:' as check_step;
SELECT
  week_start,
  grammar_score,
  pronunciation_score,
  vocabulary_score,
  fluency_score,
  total_test_sessions
FROM user_progress
ORDER BY week_start DESC
LIMIT 5;

-- Step 6: SOLUTION - Call the update function to populate data
SELECT 'Calling update_user_progress()...' as check_step;
SELECT update_user_progress();

-- Step 7: Verify data now exists
SELECT 'After update - user_progress should now have data:' as check_step;
SELECT
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
FROM user_progress
ORDER BY week_start DESC;

-- Step 8: Check if any errors occurred
SELECT 'Check for any RLS policy issues:' as check_step;
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('user_progress', 'feedback_tips')
ORDER BY tablename, policyname;
