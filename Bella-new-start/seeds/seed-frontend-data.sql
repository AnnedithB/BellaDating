-- =============================================
-- SEED DATA FOR FRONTEND TESTING
-- Run this script to populate databases with test data
-- =============================================

-- =============================================
-- 1. ANALYTICS DATABASE (analytics_db)
-- =============================================
\c analytics_db;

-- Seed Daily KPI Summaries (last 30 days)
INSERT INTO daily_kpi_summaries (id, date, total_active_users, new_registrations, total_sessions, avg_session_duration, total_matches, total_messages, total_revenue, subscription_purchases, avg_subscription_value, total_reports, moderation_actions, user_retention_day1, user_retention_day7, user_retention_day30, conversion_to_subscription, avg_time_to_first_match, avg_time_to_first_message, total_video_calls_initiated, total_video_calls_completed, avg_video_call_duration, created_at, updated_at)
SELECT 
    'kpi_' || gen_random_uuid()::text,
    (CURRENT_DATE - (n || ' days')::interval)::date,
    1500 + floor(random() * 500)::int,  -- total_active_users
    50 + floor(random() * 100)::int,     -- new_registrations
    3000 + floor(random() * 1000)::int,  -- total_sessions
    15.5 + random() * 10,                -- avg_session_duration
    200 + floor(random() * 150)::int,    -- total_matches
    5000 + floor(random() * 2000)::int,  -- total_messages
    2500 + random() * 1500,              -- total_revenue
    20 + floor(random() * 30)::int,      -- subscription_purchases
    9.99 + random() * 10,                -- avg_subscription_value
    5 + floor(random() * 10)::int,       -- total_reports
    3 + floor(random() * 5)::int,        -- moderation_actions
    0.75 + random() * 0.15,              -- user_retention_day1
    0.45 + random() * 0.2,               -- user_retention_day7
    0.25 + random() * 0.15,              -- user_retention_day30
    0.05 + random() * 0.1,               -- conversion_to_subscription
    2.5 + random() * 3,                  -- avg_time_to_first_match
    0.5 + random() * 1.5,                -- avg_time_to_first_message
    100 + floor(random() * 50)::int,     -- total_video_calls_initiated
    80 + floor(random() * 40)::int,      -- total_video_calls_completed
    8.5 + random() * 5,                  -- avg_video_call_duration
    NOW(),
    NOW()
FROM generate_series(0, 30) AS n
ON CONFLICT DO NOTHING;

-- Seed Retention Cohorts (last 12 weeks)
INSERT INTO retention_cohorts (id, cohort_week, period_number, cohort_size, users_returned, retention_rate, avg_sessions_per_user, avg_matches_per_user, avg_revenue_per_user, subscription_conv_rate, created_at, updated_at)
SELECT 
    'ret_' || gen_random_uuid()::text,
    (CURRENT_DATE - ((w * 7) || ' days')::interval)::date,
    p,
    500 + floor(random() * 200)::int,
    CASE 
        WHEN p = 0 THEN 500 + floor(random() * 200)::int
        ELSE (400 - p * 30 + floor(random() * 50))::int
    END,
    CASE 
        WHEN p = 0 THEN 1.0
        ELSE GREATEST(0.1, 0.8 - p * 0.08 + random() * 0.1)
    END,
    2.5 + random() * 2,
    0.5 + random() * 0.5,
    5 + random() * 10,
    0.03 + random() * 0.05,
    NOW(),
    NOW()
FROM generate_series(0, 11) AS w
CROSS JOIN generate_series(0, 8) AS p
ON CONFLICT DO NOTHING;

-- Seed Revenue Metrics (last 30 days)
INSERT INTO revenue_metrics (id, date, subscription_plan, new_subscriptions, renewed_subscriptions, canceled_subscriptions, churned_subscriptions, total_revenue, avg_revenue_per_user, monthly_recurring_revenue, annual_recurring_revenue, customer_lifetime_value, churn_rate, net_revenue_retention, gross_revenue_retention, payback_period, created_at, updated_at)
SELECT 
    'rev_' || gen_random_uuid()::text,
    (CURRENT_DATE - (n || ' days')::interval)::date,
    plan,
    5 + floor(random() * 15)::int,
    10 + floor(random() * 20)::int,
    2 + floor(random() * 5)::int,
    1 + floor(random() * 3)::int,
    CASE plan
        WHEN 'premium_monthly' THEN 500 + random() * 300
        WHEN 'premium_annual' THEN 1500 + random() * 500
        WHEN 'vip_monthly' THEN 800 + random() * 400
        ELSE 2000 + random() * 800
    END,
    CASE plan
        WHEN 'premium_monthly' THEN 9.99
        WHEN 'premium_annual' THEN 79.99
        WHEN 'vip_monthly' THEN 19.99
        ELSE 149.99
    END,
    15000 + random() * 5000,
    150000 + random() * 50000,
    120 + random() * 80,
    0.02 + random() * 0.03,
    1.05 + random() * 0.1,
    0.92 + random() * 0.05,
    45 + random() * 30,
    NOW(),
    NOW()
FROM generate_series(0, 30) AS n
CROSS JOIN (VALUES ('premium_monthly'), ('premium_annual'), ('vip_monthly'), ('vip_annual')) AS plans(plan)
ON CONFLICT DO NOTHING;

-- Seed Conversion Funnel (last 30 days)
INSERT INTO conversion_funnels (id, date, funnel_step, total_users, converted_users, conversion_rate, avg_time_to_convert, created_at, updated_at)
SELECT 
    'fun_' || gen_random_uuid()::text,
    (CURRENT_DATE - (n || ' days')::interval)::date,
    step,
    CASE step
        WHEN 'app_open' THEN 5000 + floor(random() * 1000)::int
        WHEN 'registration_start' THEN 2000 + floor(random() * 500)::int
        WHEN 'registration_complete' THEN 1500 + floor(random() * 400)::int
        WHEN 'first_session' THEN 1200 + floor(random() * 300)::int
        WHEN 'first_match' THEN 800 + floor(random() * 200)::int
        WHEN 'first_message' THEN 600 + floor(random() * 150)::int
        WHEN 'subscription_view' THEN 300 + floor(random() * 100)::int
        ELSE 50 + floor(random() * 30)::int
    END,
    CASE step
        WHEN 'app_open' THEN 2000 + floor(random() * 500)::int
        WHEN 'registration_start' THEN 1500 + floor(random() * 400)::int
        WHEN 'registration_complete' THEN 1200 + floor(random() * 300)::int
        WHEN 'first_session' THEN 800 + floor(random() * 200)::int
        WHEN 'first_match' THEN 600 + floor(random() * 150)::int
        WHEN 'first_message' THEN 300 + floor(random() * 100)::int
        WHEN 'subscription_view' THEN 50 + floor(random() * 30)::int
        ELSE 40 + floor(random() * 20)::int
    END,
    CASE step
        WHEN 'app_open' THEN 0.4 + random() * 0.1
        WHEN 'registration_start' THEN 0.75 + random() * 0.1
        WHEN 'registration_complete' THEN 0.8 + random() * 0.1
        WHEN 'first_session' THEN 0.67 + random() * 0.1
        WHEN 'first_match' THEN 0.75 + random() * 0.1
        WHEN 'first_message' THEN 0.5 + random() * 0.15
        WHEN 'subscription_view' THEN 0.17 + random() * 0.08
        ELSE 0.8 + random() * 0.1
    END,
    random() * 24,
    NOW(),
    NOW()
FROM generate_series(0, 30) AS n
CROSS JOIN (VALUES 
    ('app_open'), 
    ('registration_start'), 
    ('registration_complete'), 
    ('first_session'), 
    ('first_match'), 
    ('first_message'), 
    ('subscription_view'), 
    ('subscription_purchase')
) AS steps(step)
ON CONFLICT DO NOTHING;

-- Seed Hourly Metrics (last 72 hours)
INSERT INTO hourly_metrics (id, timestamp, hour, concurrent_users, active_interactions, queue_length, new_users, new_interactions, new_messages, created_at)
SELECT 
    'hour_' || gen_random_uuid()::text,
    NOW() - (h || ' hours')::interval,
    EXTRACT(HOUR FROM NOW() - (h || ' hours')::interval)::int,
    100 + floor(random() * 200)::int,
    50 + floor(random() * 100)::int,
    10 + floor(random() * 30)::int,
    5 + floor(random() * 20)::int,
    20 + floor(random() * 50)::int,
    100 + floor(random() * 200)::int,
    NOW()
FROM generate_series(0, 72) AS h
ON CONFLICT DO NOTHING;

-- Seed User Behavior Events (sample events)
INSERT INTO user_behavior_events (id, user_id, session_id, event_name, event_properties, event_time, platform, app_version, device_type, location_country, created_at)
SELECT 
    'evt_' || gen_random_uuid()::text,
    'user_' || (floor(random() * 1000) + 1)::text,
    'sess_' || (floor(random() * 500) + 1)::text,
    event,
    '{"source": "organic", "duration": ' || floor(random() * 300)::text || '}',
    NOW() - (floor(random() * 168) || ' hours')::interval,
    (ARRAY['ios', 'android', 'web'])[floor(random() * 3) + 1],
    '2.1.' || floor(random() * 10)::text,
    (ARRAY['iPhone', 'Android', 'Desktop', 'Tablet'])[floor(random() * 4) + 1],
    (ARRAY['US', 'UK', 'CA', 'AU', 'DE', 'FR'])[floor(random() * 6) + 1],
    NOW()
FROM generate_series(1, 500) AS n
CROSS JOIN (VALUES 
    ('app_open'), ('profile_view'), ('swipe_right'), ('swipe_left'), 
    ('message_sent'), ('match_made'), ('video_call_started'), ('subscription_viewed')
) AS events(event)
ON CONFLICT DO NOTHING;

-- =============================================
-- 2. ADMIN DATABASE (admin_db)
-- =============================================
\c admin_db;

-- Seed User Reports (moderation queue)
INSERT INTO user_reports (id, reporter_user_id, reported_user_id, report_type, reason, description, status, priority, created_at, updated_at)
VALUES 
    ('report_001', 'user_123', 'user_456', 'HARASSMENT', 'Inappropriate messages', 'User sent multiple offensive messages during our conversation. Screenshots attached.', 'PENDING', 'HIGH', NOW() - INTERVAL '2 hours', NOW()),
    ('report_002', 'user_234', 'user_567', 'FAKE_PROFILE', 'Suspicious profile', 'Profile photos appear to be stolen from a celebrity. Bio contains inconsistent information.', 'PENDING', 'MEDIUM', NOW() - INTERVAL '5 hours', NOW()),
    ('report_003', 'user_345', 'user_678', 'SPAM', 'Promotional content', 'User is promoting external websites and asking for money.', 'IN_REVIEW', 'HIGH', NOW() - INTERVAL '1 day', NOW()),
    ('report_004', 'user_456', 'user_789', 'INAPPROPRIATE_BEHAVIOR', 'Rude behavior', 'User was extremely rude and made inappropriate comments about my appearance.', 'PENDING', 'MEDIUM', NOW() - INTERVAL '3 hours', NOW()),
    ('report_005', 'user_567', 'user_890', 'UNDERAGE', 'Possible minor', 'User claims to be 18 but appears much younger in video call.', 'ESCALATED', 'URGENT', NOW() - INTERVAL '30 minutes', NOW()),
    ('report_006', 'user_678', 'user_901', 'HATE_SPEECH', 'Discriminatory language', 'User made racist comments during our conversation.', 'PENDING', 'HIGH', NOW() - INTERVAL '4 hours', NOW()),
    ('report_007', 'user_789', 'user_012', 'SEXUAL_CONTENT', 'Explicit content', 'User sent unsolicited explicit images.', 'IN_REVIEW', 'URGENT', NOW() - INTERVAL '1 hour', NOW()),
    ('report_008', 'user_890', 'user_123', 'OTHER', 'Suspicious activity', 'User asked for personal financial information.', 'PENDING', 'MEDIUM', NOW() - INTERVAL '6 hours', NOW()),
    ('report_009', 'user_901', 'user_234', 'VIOLENCE_THREAT', 'Threatening messages', 'User made threatening statements about meeting in person.', 'ESCALATED', 'URGENT', NOW() - INTERVAL '45 minutes', NOW()),
    ('report_010', 'user_012', 'user_345', 'HARASSMENT', 'Persistent unwanted contact', 'User continues to message despite being asked to stop.', 'PENDING', 'HIGH', NOW() - INTERVAL '2 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Support Tickets
INSERT INTO support_tickets (id, ticket_number, subject, description, category, priority, status, customer_id, customer_email, customer_name, created_at, updated_at)
VALUES 
    ('ticket_001', 'TKT-2025-001', 'Cannot send messages', 'I am unable to send messages to my matches. The send button does not respond.', 'TECHNICAL', 'HIGH', 'OPEN', 'user_100', 'john.doe@email.com', 'John Doe', NOW() - INTERVAL '3 hours', NOW()),
    ('ticket_002', 'TKT-2025-002', 'Billing issue with subscription', 'I was charged twice for my premium subscription this month.', 'BILLING', 'URGENT', 'IN_PROGRESS', 'user_101', 'jane.smith@email.com', 'Jane Smith', NOW() - INTERVAL '1 day', NOW()),
    ('ticket_003', 'TKT-2025-003', 'Account recovery', 'I forgot my password and cannot access my account. Email recovery is not working.', 'ACCOUNT', 'MEDIUM', 'WAITING_FOR_CUSTOMER', 'user_102', 'mike.wilson@email.com', 'Mike Wilson', NOW() - INTERVAL '2 days', NOW()),
    ('ticket_004', 'TKT-2025-004', 'Report a safety concern', 'I matched with someone who is asking for money. This seems like a scam.', 'SAFETY', 'HIGH', 'OPEN', 'user_103', 'sarah.jones@email.com', 'Sarah Jones', NOW() - INTERVAL '5 hours', NOW()),
    ('ticket_005', 'TKT-2025-005', 'Feature request: Video filters', 'It would be great to have beauty filters during video calls.', 'FEATURE_REQUEST', 'LOW', 'OPEN', 'user_104', 'alex.brown@email.com', 'Alex Brown', NOW() - INTERVAL '1 week', NOW()),
    ('ticket_006', 'TKT-2025-006', 'App crashes on startup', 'The app crashes immediately after opening on my iPhone 15.', 'BUG_REPORT', 'HIGH', 'IN_PROGRESS', 'user_105', 'emma.davis@email.com', 'Emma Davis', NOW() - INTERVAL '4 hours', NOW()),
    ('ticket_007', 'TKT-2025-007', 'How to delete my account?', 'I want to permanently delete my account and all my data.', 'ACCOUNT', 'MEDIUM', 'OPEN', 'user_106', 'chris.miller@email.com', 'Chris Miller', NOW() - INTERVAL '6 hours', NOW()),
    ('ticket_008', 'TKT-2025-008', 'Subscription cancellation', 'I want to cancel my VIP subscription before the next billing cycle.', 'BILLING', 'MEDIUM', 'RESOLVED', 'user_107', 'lisa.taylor@email.com', 'Lisa Taylor', NOW() - INTERVAL '3 days', NOW()),
    ('ticket_009', 'TKT-2025-009', 'Profile verification not working', 'I submitted my verification photos 3 days ago but still not verified.', 'TECHNICAL', 'MEDIUM', 'OPEN', 'user_108', 'david.anderson@email.com', 'David Anderson', NOW() - INTERVAL '3 days', NOW()),
    ('ticket_010', 'TKT-2025-010', 'Matches disappeared', 'All my matches suddenly disappeared from my inbox.', 'TECHNICAL', 'HIGH', 'OPEN', 'user_109', 'amy.thomas@email.com', 'Amy Thomas', NOW() - INTERVAL '1 hour', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Moderation Actions
INSERT INTO moderation_actions (id, admin_id, target_type, target_id, action, reason, severity, created_at)
SELECT 
    'action_' || gen_random_uuid()::text,
    'admin001',
    (ARRAY['USER', 'REPORT', 'CONTENT'])[floor(random() * 3) + 1]::text::"ModerationTarget",
    'target_' || n::text,
    (ARRAY['WARN', 'SUSPEND', 'BAN', 'APPROVE', 'REJECT', 'REVIEW'])[floor(random() * 6) + 1]::text::"ModerationActionType",
    (ARRAY['Violation of community guidelines', 'Spam detected', 'Inappropriate content', 'User complaint verified', 'False report dismissed'])[floor(random() * 5) + 1],
    (ARRAY['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])[floor(random() * 4) + 1]::text::"ModerationSeverity",
    NOW() - (floor(random() * 168) || ' hours')::interval
FROM generate_series(1, 25) AS n
ON CONFLICT DO NOTHING;

-- Update admin dashboard analytics
-- This creates summary data that the dashboard endpoint returns

SELECT 'Analytics and moderation data seeded successfully!' as status;
