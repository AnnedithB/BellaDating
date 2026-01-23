-- ============================================
-- SQL Queries to Check Matching Preferences
-- ============================================
-- Database: queuing
-- Table: user_matching_preferences
-- ============================================

-- 1. Count total users with matching preferences
SELECT COUNT(*) as total_users_with_preferences
FROM user_matching_preferences;

-- 2. List all user IDs with preferences
SELECT 
    user_id,
    min_age,
    max_age,
    max_radius,
    preferred_genders,
    created_at,
    updated_at
FROM user_matching_preferences
ORDER BY created_at DESC;

-- 3. Check specific user's preferences (replace USER_ID_HERE)
SELECT *
FROM user_matching_preferences
WHERE user_id = 'USER_ID_HERE';

-- 4. Count users with specific gender preferences
SELECT 
    preferred_genders,
    COUNT(*) as count
FROM user_matching_preferences
GROUP BY preferred_genders;

-- 5. Check queue entries (users who joined the queue)
SELECT 
    COUNT(*) as total_queue_entries,
    COUNT(DISTINCT user_id) as unique_users_in_queue
FROM queue_entries;

-- 6. List queue entries with user IDs
SELECT 
    user_id,
    intent,
    gender,
    status,
    entered_at
FROM queue_entries
ORDER BY entered_at DESC
LIMIT 20;

-- 7. Check match attempts (to see who's already matched)
SELECT 
    COUNT(*) as total_match_attempts,
    COUNT(DISTINCT user1_id) as unique_user1_count,
    COUNT(DISTINCT user2_id) as unique_user2_count
FROM match_attempts;

-- 8. List recent match attempts
SELECT 
    user1_id,
    user2_id,
    status,
    total_score,
    created_at
FROM match_attempts
ORDER BY created_at DESC
LIMIT 20;

-- 9. Find users who have preferences but no queue entry
SELECT 
    ump.user_id,
    ump.created_at as preferences_created_at
FROM user_matching_preferences ump
LEFT JOIN queue_entries qe ON ump.user_id = qe.user_id
WHERE qe.user_id IS NULL;

-- 10. Find users who have queue entry but no preferences
SELECT 
    qe.user_id,
    qe.entered_at
FROM queue_entries qe
LEFT JOIN user_matching_preferences ump ON qe.user_id = ump.user_id
WHERE ump.user_id IS NULL;

-- 11. Get detailed view of a user's matching setup
SELECT 
    ump.user_id,
    ump.min_age,
    ump.max_age,
    ump.max_radius,
    ump.preferred_genders,
    ump.preferred_relationship_intents,
    qe.status as queue_status,
    qe.entered_at as queue_entered_at,
    (SELECT COUNT(*) FROM match_attempts WHERE user1_id = ump.user_id OR user2_id = ump.user_id) as total_matches
FROM user_matching_preferences ump
LEFT JOIN queue_entries qe ON ump.user_id = qe.user_id
ORDER BY ump.created_at DESC
LIMIT 10;

-- 12. Check for users with empty/null preferences (might indicate incomplete setup)
SELECT 
    user_id,
    preferred_genders,
    preferred_relationship_intents,
    preferred_family_plans,
    created_at
FROM user_matching_preferences
WHERE 
    (preferred_genders::text = '[]' OR preferred_genders IS NULL)
    OR (preferred_relationship_intents::text = '[]' OR preferred_relationship_intents IS NULL);

