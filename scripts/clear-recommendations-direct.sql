-- Direct delete - works in Supabase SQL Editor
-- This bypasses RLS and deletes ALL recommended actions

-- First, let's see what exists
SELECT ra.id, u.display_name, ra.category, ra.action_text, ra.created_at
FROM recommended_actions ra
JOIN users u ON ra.user_id = u.id
ORDER BY ra.created_at DESC;

-- Now delete everything (uncomment the line below to run)
-- DELETE FROM recommended_actions;

-- Or delete just for a specific user (replace 'your-email@example.com' with your actual email)
-- DELETE FROM recommended_actions
-- WHERE user_id IN (
--   SELECT u.id FROM users u
--   JOIN auth.users au ON u.auth_user_id = au.id
--   WHERE au.email = 'your-email@example.com'
-- );

-- After deletion, verify it's empty
SELECT COUNT(*) as total_recommendations FROM recommended_actions;
