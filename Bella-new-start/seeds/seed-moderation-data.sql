-- Seed Moderation Service Database with Realistic Data
-- Based on 9 real users in the system

-- Get the real user IDs first (we'll use the same ones from users database)
-- cmj48wfp40000qo08l6rkkn0e, cmj499c460001qo08mon3f4sw, cmj4biaju0002qo080yfieca6, 
-- cmj5rr8hh0000ob071iayp5l8, cmj7nm9rm0000o807ghqs78eh, cmj7nmz8x0001o807gs1js32a,
-- cmj8xvqoi0000qn062ett2d9i, cmj8zcl3y0000mr07ykrk4zwl, cmja5xul70000rs071y5d3fbf

-- Connect to moderation service database (assuming it uses admin database)
-- Run this with: Get-Content seed-moderation-data.sql | docker exec -i kindred-postgres psql -U postgres -d admin

-- Clear existing data
DELETE FROM moderation_records WHERE id LIKE 'mod_%';
DELETE FROM user_safety_profiles WHERE id LIKE 'safety_%';
DELETE FROM moderation_violations WHERE id LIKE 'viol_%';
DELETE FROM content_safety_scores WHERE id LIKE 'score_%';

-- Seed User Safety Profiles for all 9 users
INSERT INTO user_safety_profiles (id, user_id, trust_score, violation_count, risk_level, last_reviewed_at, created_at, updated_at)
VALUES 
    ('safety_001', 'cmj48wfp40000qo08l6rkkn0e', 85, 0, 'LOW', NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 days', NOW()),
    ('safety_002', 'cmj499c460001qo08mon3f4sw', 72, 1, 'MEDIUM', NOW() - INTERVAL '2 days', NOW() - INTERVAL '25 days', NOW()),
    ('safety_003', 'cmj4biaju0002qo080yfieca6', 95, 0, 'LOW', NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 days', NOW()),
    ('safety_004', 'cmj5rr8hh0000ob071iayp5l8', 45, 3, 'HIGH', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '15 days', NOW()),
    ('safety_005', 'cmj7nm9rm0000o807ghqs78eh', 88, 0, 'LOW', NOW() - INTERVAL '3 days', NOW() - INTERVAL '12 days', NOW()),
    ('safety_006', 'cmj7nmz8x0001o807gs1js32a', 65, 2, 'MEDIUM', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '10 days', NOW()),
    ('safety_007', 'cmj8xvqoi0000qn062ett2d9i', 92, 0, 'LOW', NOW() - INTERVAL '2 days', NOW() - INTERVAL '8 days', NOW()),
    ('safety_008', 'cmj8zcl3y0000mr07ykrk4zwl', 78, 1, 'MEDIUM', NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 days', NOW()),
    ('safety_009', 'cmja5xul70000rs071y5d3fbf', 90, 0, 'LOW', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Moderation Records (content that has been moderated)
INSERT INTO moderation_records (id, content_id, content_type, status, moderator_id, reason, ai_score, created_at, updated_at)
VALUES 
    ('mod_001', 'msg_12345', 'MESSAGE', 'APPROVED', 'admin001', 'Content is appropriate', 0.15, NOW() - INTERVAL '2 hours', NOW()),
    ('mod_002', 'msg_12346', 'MESSAGE', 'REJECTED', 'admin001', 'Contains inappropriate language', 0.85, NOW() - INTERVAL '4 hours', NOW()),
    ('mod_003', 'profile_789', 'PROFILE', 'APPROVED', 'admin001', 'Profile meets guidelines', 0.12, NOW() - INTERVAL '1 day', NOW()),
    ('mod_004', 'msg_12347', 'MESSAGE', 'ESCALATED', 'admin001', 'Requires senior review', 0.75, NOW() - INTERVAL '30 minutes', NOW()),
    ('mod_005', 'photo_456', 'PHOTO', 'REJECTED', 'admin001', 'Inappropriate content', 0.92, NOW() - INTERVAL '6 hours', NOW()),
    ('mod_006', 'msg_12348', 'MESSAGE', 'APPROVED', 'admin001', 'Acceptable content', 0.25, NOW() - INTERVAL '3 hours', NOW()),
    ('mod_007', 'profile_790', 'PROFILE', 'PENDING', NULL, 'Awaiting review', 0.55, NOW() - INTERVAL '1 hour', NOW()),
    ('mod_008', 'msg_12349', 'MESSAGE', 'REJECTED', 'admin001', 'Spam content detected', 0.88, NOW() - INTERVAL '5 hours', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Moderation Violations
INSERT INTO moderation_violations (id, user_id, violation_type, severity, description, action_taken, created_at)
VALUES 
    ('viol_001', 'cmj499c460001qo08mon3f4sw', 'HARASSMENT', 'MEDIUM', 'Sent inappropriate messages to another user', 'WARNING_ISSUED', NOW() - INTERVAL '2 days'),
    ('viol_002', 'cmj5rr8hh0000ob071iayp5l8', 'SPAM', 'HIGH', 'Posted promotional content multiple times', 'TEMPORARY_SUSPENSION', NOW() - INTERVAL '1 day'),
    ('viol_003', 'cmj5rr8hh0000ob071iayp5l8', 'FAKE_PROFILE', 'HIGH', 'Using stolen photos in profile', 'ACCOUNT_RESTRICTED', NOW() - INTERVAL '3 hours'),
    ('viol_004', 'cmj5rr8hh0000ob071iayp5l8', 'HATE_SPEECH', 'CRITICAL', 'Made discriminatory comments', 'PERMANENT_BAN', NOW() - INTERVAL '1 hour'),
    ('viol_005', 'cmj7nmz8x0001o807gs1js32a', 'INAPPROPRIATE_CONTENT', 'MEDIUM', 'Shared inappropriate images', 'CONTENT_REMOVED', NOW() - INTERVAL '5 hours'),
    ('viol_006', 'cmj7nmz8x0001o807gs1js32a', 'UNDERAGE_CONCERN', 'HIGH', 'Profile suggests user may be underage', 'ACCOUNT_VERIFICATION_REQUIRED', NOW() - INTERVAL '2 hours'),
    ('viol_007', 'cmj8zcl3y0000mr07ykrk4zwl', 'SCAM_ATTEMPT', 'HIGH', 'Attempted to solicit money from users', 'ACCOUNT_SUSPENDED', NOW() - INTERVAL '8 hours')
ON CONFLICT (id) DO NOTHING;

-- Seed Content Safety Scores (AI analysis results)
INSERT INTO content_safety_scores (id, content_id, content_type, toxicity_score, threat_score, insult_score, profanity_score, identity_attack_score, sexually_explicit_score, created_at)
VALUES 
    ('score_001', 'msg_12345', 'MESSAGE', 0.15, 0.05, 0.10, 0.08, 0.02, 0.01, NOW() - INTERVAL '2 hours'),
    ('score_002', 'msg_12346', 'MESSAGE', 0.85, 0.12, 0.78, 0.65, 0.15, 0.05, NOW() - INTERVAL '4 hours'),
    ('score_003', 'profile_789', 'PROFILE', 0.12, 0.02, 0.05, 0.03, 0.01, 0.08, NOW() - INTERVAL '1 day'),
    ('score_004', 'msg_12347', 'MESSAGE', 0.75, 0.68, 0.45, 0.32, 0.55, 0.12, NOW() - INTERVAL '30 minutes'),
    ('score_005', 'photo_456', 'PHOTO', 0.92, 0.05, 0.15, 0.25, 0.08, 0.88, NOW() - INTERVAL '6 hours'),
    ('score_006', 'msg_12348', 'MESSAGE', 0.25, 0.08, 0.18, 0.15, 0.05, 0.02, NOW() - INTERVAL '3 hours'),
    ('score_007', 'profile_790', 'PROFILE', 0.55, 0.25, 0.35, 0.28, 0.18, 0.45, NOW() - INTERVAL '1 hour'),
    ('score_008', 'msg_12349', 'MESSAGE', 0.88, 0.15, 0.25, 0.92, 0.08, 0.05, NOW() - INTERVAL '5 hours'),
    ('score_009', 'msg_12350', 'MESSAGE', 0.08, 0.02, 0.05, 0.03, 0.01, 0.01, NOW() - INTERVAL '1 hour'),
    ('score_010', 'msg_12351', 'MESSAGE', 0.45, 0.35, 0.28, 0.22, 0.12, 0.08, NOW() - INTERVAL '7 hours')
ON CONFLICT (id) DO NOTHING;

-- Seed Trust Score History
INSERT INTO trust_score_history (id, user_id, score, reason, changed_by, timestamp)
VALUES 
    ('hist_001', 'cmj499c460001qo08mon3f4sw', 85, 'Initial score', 'SYSTEM', NOW() - INTERVAL '25 days'),
    ('hist_002', 'cmj499c460001qo08mon3f4sw', 72, 'Violation: Harassment warning issued', 'admin001', NOW() - INTERVAL '2 days'),
    ('hist_003', 'cmj5rr8hh0000ob071iayp5l8', 75, 'Initial score', 'SYSTEM', NOW() - INTERVAL '15 days'),
    ('hist_004', 'cmj5rr8hh0000ob071iayp5l8', 65, 'Violation: Spam detected', 'admin001', NOW() - INTERVAL '1 day'),
    ('hist_005', 'cmj5rr8hh0000ob071iayp5l8', 55, 'Violation: Fake profile detected', 'admin001', NOW() - INTERVAL '3 hours'),
    ('hist_006', 'cmj5rr8hh0000ob071iayp5l8', 45, 'Violation: Hate speech - critical', 'admin001', NOW() - INTERVAL '1 hour'),
    ('hist_007', 'cmj7nmz8x0001o807gs1js32a', 80, 'Initial score', 'SYSTEM', NOW() - INTERVAL '10 days'),
    ('hist_008', 'cmj7nmz8x0001o807gs1js32a', 70, 'Violation: Inappropriate content', 'admin001', NOW() - INTERVAL '5 hours'),
    ('hist_009', 'cmj7nmz8x0001o807gs1js32a', 65, 'Violation: Underage concern', 'admin001', NOW() - INTERVAL '2 hours'),
    ('hist_010', 'cmj8zcl3y0000mr07ykrk4zwl', 85, 'Initial score', 'SYSTEM', NOW() - INTERVAL '5 days'),
    ('hist_011', 'cmj8zcl3y0000mr07ykrk4zwl', 78, 'Violation: Scam attempt detected', 'admin001', NOW() - INTERVAL '8 hours')
ON CONFLICT (id) DO NOTHING;

-- Seed Moderation Alerts
INSERT INTO moderation_alerts (id, type, severity, message, metadata, acknowledged, created_at, updated_at)
VALUES 
    ('alert_001', 'HIGH_VOLUME', 'MEDIUM', 'Unusual spike in harassment reports in last hour', '{"reports_count": 5, "timeframe": "1h"}', false, NOW() - INTERVAL '30 minutes', NOW()),
    ('alert_002', 'SUSPICIOUS_ACTIVITY', 'HIGH', 'User cmj5rr8hh0000ob071iayp5l8 has multiple violations in short timeframe', '{"user_id": "cmj5rr8hh0000ob071iayp5l8", "violations": 3}', false, NOW() - INTERVAL '1 hour', NOW()),
    ('alert_003', 'PATTERN_DETECTED', 'CRITICAL', 'Coordinated spam attack detected from multiple accounts', '{"affected_users": 4, "pattern": "promotional_links"}', true, NOW() - INTERVAL '2 hours', NOW()),
    ('alert_004', 'HIGH_VOLUME', 'LOW', 'Increased photo moderation queue', '{"queue_size": 15, "avg_size": 8}', true, NOW() - INTERVAL '4 hours', NOW()),
    ('alert_005', 'SUSPICIOUS_ACTIVITY', 'MEDIUM', 'Multiple fake profile reports for similar photos', '{"reports": 3, "similarity_score": 0.95}', false, NOW() - INTERVAL '6 hours', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Moderation Statistics (daily aggregates)
INSERT INTO moderation_statistics (id, date, total_reports, resolved_reports, pending_reports, average_resolution_time, top_reasons, created_at, updated_at)
VALUES 
    ('stats_001', CURRENT_DATE, 12, 8, 4, 2.5, '{"HARASSMENT": 4, "SPAM": 3, "INAPPROPRIATE_CONTENT": 2}', NOW(), NOW()),
    ('stats_002', CURRENT_DATE - INTERVAL '1 day', 8, 8, 0, 3.2, '{"SPAM": 3, "FAKE_PROFILE": 2, "HARASSMENT": 2}', NOW() - INTERVAL '1 day', NOW()),
    ('stats_003', CURRENT_DATE - INTERVAL '2 days', 15, 12, 3, 1.8, '{"HARASSMENT": 5, "INAPPROPRIATE_CONTENT": 4, "HATE_SPEECH": 3}', NOW() - INTERVAL '2 days', NOW()),
    ('stats_004', CURRENT_DATE - INTERVAL '3 days', 6, 6, 0, 4.1, '{"SPAM": 2, "SCAM": 2, "OTHER": 2}', NOW() - INTERVAL '3 days', NOW()),
    ('stats_005', CURRENT_DATE - INTERVAL '4 days', 10, 9, 1, 2.9, '{"FAKE_PROFILE": 4, "HARASSMENT": 3, "SPAM": 2}', NOW() - INTERVAL '4 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Moderator Activity (performance tracking)
INSERT INTO moderator_activity (id, moderator_id, date, actions_count, average_response_time, accuracy_rate, created_at, updated_at)
VALUES 
    ('activity_001', 'admin001', CURRENT_DATE, 8, 1.5, 0.95, NOW(), NOW()),
    ('activity_002', 'admin001', CURRENT_DATE - INTERVAL '1 day', 12, 2.1, 0.92, NOW() - INTERVAL '1 day', NOW()),
    ('activity_003', 'admin001', CURRENT_DATE - INTERVAL '2 days', 15, 1.8, 0.97, NOW() - INTERVAL '2 days', NOW()),
    ('activity_004', 'admin001', CURRENT_DATE - INTERVAL '3 days', 6, 3.2, 0.88, NOW() - INTERVAL '3 days', NOW()),
    ('activity_005', 'admin001', CURRENT_DATE - INTERVAL '4 days', 9, 2.5, 0.94, NOW() - INTERVAL '4 days', NOW())
ON CONFLICT (id) DO NOTHING;

SELECT 'Moderation service data seeded successfully!' as status,
       'Users with safety profiles: 9' as users,
       'Moderation records: 8' as records,
       'Violations tracked: 7' as violations,
       'AI safety scores: 10' as ai_scores,
       'Trust score changes: 11' as trust_changes,
       'Active alerts: 5' as alerts,
       'Daily statistics: 5' as daily_stats;