# Seed Frontend Test Data
# This script seeds the databases with test data for frontend testing

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SEEDING FRONTEND TEST DATA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the postgres container name
$postgresContainer = "kindred-postgres"

Write-Host "1. Seeding Admin Database (Reports & Tickets)..." -ForegroundColor Yellow

# Seed User Reports
$seedReports = @"
INSERT INTO user_reports (id, reporter_user_id, reported_user_id, report_type, reason, description, status, priority, created_at, updated_at)
VALUES 
    ('report_001', 'user_123', 'user_456', 'HARASSMENT', 'Inappropriate messages', 'User sent multiple offensive messages during our conversation.', 'PENDING', 'HIGH', NOW() - INTERVAL '2 hours', NOW()),
    ('report_002', 'user_234', 'user_567', 'FAKE_PROFILE', 'Suspicious profile', 'Profile photos appear to be stolen from a celebrity.', 'PENDING', 'MEDIUM', NOW() - INTERVAL '5 hours', NOW()),
    ('report_003', 'user_345', 'user_678', 'SPAM', 'Promotional content', 'User is promoting external websites and asking for money.', 'IN_REVIEW', 'HIGH', NOW() - INTERVAL '1 day', NOW()),
    ('report_004', 'user_456', 'user_789', 'INAPPROPRIATE_BEHAVIOR', 'Rude behavior', 'User was extremely rude and made inappropriate comments.', 'PENDING', 'MEDIUM', NOW() - INTERVAL '3 hours', NOW()),
    ('report_005', 'user_567', 'user_890', 'UNDERAGE', 'Possible minor', 'User claims to be 18 but appears much younger.', 'ESCALATED', 'URGENT', NOW() - INTERVAL '30 minutes', NOW()),
    ('report_006', 'user_678', 'user_901', 'HATE_SPEECH', 'Discriminatory language', 'User made racist comments during conversation.', 'PENDING', 'HIGH', NOW() - INTERVAL '4 hours', NOW()),
    ('report_007', 'user_789', 'user_012', 'SEXUAL_CONTENT', 'Explicit content', 'User sent unsolicited explicit images.', 'IN_REVIEW', 'URGENT', NOW() - INTERVAL '1 hour', NOW()),
    ('report_008', 'user_890', 'user_123', 'OTHER', 'Suspicious activity', 'User asked for personal financial information.', 'PENDING', 'MEDIUM', NOW() - INTERVAL '6 hours', NOW())
ON CONFLICT (id) DO NOTHING;
"@

docker exec -i $postgresContainer psql -U postgres -d admin_db -c $seedReports
Write-Host "  OK Reports seeded" -ForegroundColor Green

# Seed Support Tickets
$seedTickets = @"
INSERT INTO support_tickets (id, ticket_number, subject, description, category, priority, status, customer_id, customer_email, customer_name, created_at, updated_at)
VALUES 
    ('ticket_001', 'TKT-2025-001', 'Cannot send messages', 'I am unable to send messages to my matches.', 'TECHNICAL', 'HIGH', 'OPEN', 'user_100', 'john.doe@email.com', 'John Doe', NOW() - INTERVAL '3 hours', NOW()),
    ('ticket_002', 'TKT-2025-002', 'Billing issue with subscription', 'I was charged twice for my premium subscription.', 'BILLING', 'URGENT', 'IN_PROGRESS', 'user_101', 'jane.smith@email.com', 'Jane Smith', NOW() - INTERVAL '1 day', NOW()),
    ('ticket_003', 'TKT-2025-003', 'Account recovery', 'I forgot my password and cannot access my account.', 'ACCOUNT', 'MEDIUM', 'WAITING_FOR_CUSTOMER', 'user_102', 'mike.wilson@email.com', 'Mike Wilson', NOW() - INTERVAL '2 days', NOW()),
    ('ticket_004', 'TKT-2025-004', 'Report a safety concern', 'I matched with someone who is asking for money.', 'SAFETY', 'HIGH', 'OPEN', 'user_103', 'sarah.jones@email.com', 'Sarah Jones', NOW() - INTERVAL '5 hours', NOW()),
    ('ticket_005', 'TKT-2025-005', 'Feature request: Video filters', 'It would be great to have beauty filters.', 'FEATURE_REQUEST', 'LOW', 'OPEN', 'user_104', 'alex.brown@email.com', 'Alex Brown', NOW() - INTERVAL '1 week', NOW()),
    ('ticket_006', 'TKT-2025-006', 'App crashes on startup', 'The app crashes immediately after opening.', 'BUG_REPORT', 'HIGH', 'IN_PROGRESS', 'user_105', 'emma.davis@email.com', 'Emma Davis', NOW() - INTERVAL '4 hours', NOW()),
    ('ticket_007', 'TKT-2025-007', 'How to delete my account?', 'I want to permanently delete my account.', 'ACCOUNT', 'MEDIUM', 'OPEN', 'user_106', 'chris.miller@email.com', 'Chris Miller', NOW() - INTERVAL '6 hours', NOW()),
    ('ticket_008', 'TKT-2025-008', 'Subscription cancellation', 'I want to cancel my VIP subscription.', 'BILLING', 'MEDIUM', 'RESOLVED', 'user_107', 'lisa.taylor@email.com', 'Lisa Taylor', NOW() - INTERVAL '3 days', NOW())
ON CONFLICT (id) DO NOTHING;
"@

docker exec -i $postgresContainer psql -U postgres -d admin_db -c $seedTickets
Write-Host "  OK Support tickets seeded" -ForegroundColor Green

Write-Host ""
Write-Host "2. Seeding Analytics Database (KPIs)..." -ForegroundColor Yellow

# Seed Daily KPI Summaries - simplified version
$seedKPIs = @"
INSERT INTO daily_kpi_summaries (id, date, total_active_users, new_registrations, total_sessions, avg_session_duration, total_matches, total_messages, total_revenue, subscription_purchases, avg_subscription_value, total_reports, moderation_actions, user_retention_day1, user_retention_day7, user_retention_day30, conversion_to_subscription, total_video_calls_initiated, total_video_calls_completed, avg_video_call_duration, created_at, updated_at)
SELECT 
    'kpi_' || md5(random()::text),
    (CURRENT_DATE - (n || ' days')::interval)::date,
    1500 + (random() * 500)::int,
    50 + (random() * 100)::int,
    3000 + (random() * 1000)::int,
    15.5 + random() * 10,
    200 + (random() * 150)::int,
    5000 + (random() * 2000)::int,
    2500 + random() * 1500,
    20 + (random() * 30)::int,
    9.99 + random() * 10,
    5 + (random() * 10)::int,
    3 + (random() * 5)::int,
    0.75 + random() * 0.15,
    0.45 + random() * 0.2,
    0.25 + random() * 0.15,
    0.05 + random() * 0.1,
    100 + (random() * 50)::int,
    80 + (random() * 40)::int,
    8.5 + random() * 5,
    NOW(),
    NOW()
FROM generate_series(0, 30) AS n
ON CONFLICT DO NOTHING;
"@

docker exec -i $postgresContainer psql -U postgres -d analytics_db -c $seedKPIs
Write-Host "  OK Daily KPIs seeded" -ForegroundColor Green

# Seed Retention Cohorts
$seedRetention = @"
INSERT INTO retention_cohorts (id, cohort_week, period_number, cohort_size, users_returned, retention_rate, avg_sessions_per_user, avg_matches_per_user, avg_revenue_per_user, subscription_conv_rate, created_at, updated_at)
SELECT 
    'ret_' || md5(random()::text),
    (CURRENT_DATE - ((w * 7) || ' days')::interval)::date,
    p,
    500 + (random() * 200)::int,
    CASE WHEN p = 0 THEN 500 + (random() * 200)::int ELSE GREATEST(50, (400 - p * 30 + (random() * 50)))::int END,
    CASE WHEN p = 0 THEN 1.0 ELSE GREATEST(0.1, 0.8 - p * 0.08 + random() * 0.1) END,
    2.5 + random() * 2,
    0.5 + random() * 0.5,
    5 + random() * 10,
    0.03 + random() * 0.05,
    NOW(),
    NOW()
FROM generate_series(0, 8) AS w
CROSS JOIN generate_series(0, 6) AS p
ON CONFLICT DO NOTHING;
"@

docker exec -i $postgresContainer psql -U postgres -d analytics_db -c $seedRetention
Write-Host "  OK Retention cohorts seeded" -ForegroundColor Green

# Seed Revenue Metrics
$seedRevenue = @"
INSERT INTO revenue_metrics (id, date, subscription_plan, new_subscriptions, renewed_subscriptions, canceled_subscriptions, churned_subscriptions, total_revenue, avg_revenue_per_user, monthly_recurring_revenue, annual_recurring_revenue, customer_lifetime_value, churn_rate, net_revenue_retention, gross_revenue_retention, created_at, updated_at)
SELECT 
    'rev_' || md5(random()::text),
    (CURRENT_DATE - (n || ' days')::interval)::date,
    plan,
    5 + (random() * 15)::int,
    10 + (random() * 20)::int,
    2 + (random() * 5)::int,
    1 + (random() * 3)::int,
    CASE plan WHEN 'premium_monthly' THEN 500 + random() * 300 WHEN 'premium_annual' THEN 1500 + random() * 500 ELSE 800 + random() * 400 END,
    CASE plan WHEN 'premium_monthly' THEN 9.99 WHEN 'premium_annual' THEN 79.99 ELSE 19.99 END,
    15000 + random() * 5000,
    150000 + random() * 50000,
    120 + random() * 80,
    0.02 + random() * 0.03,
    1.05 + random() * 0.1,
    0.92 + random() * 0.05,
    NOW(),
    NOW()
FROM generate_series(0, 14) AS n
CROSS JOIN (VALUES ('premium_monthly'), ('premium_annual'), ('vip_monthly')) AS plans(plan)
ON CONFLICT DO NOTHING;
"@

docker exec -i $postgresContainer psql -U postgres -d analytics_db -c $seedRevenue
Write-Host "  OK Revenue metrics seeded" -ForegroundColor Green

# Seed Conversion Funnel
$seedFunnel = @"
INSERT INTO conversion_funnels (id, date, funnel_step, total_users, converted_users, conversion_rate, created_at, updated_at)
SELECT 
    'fun_' || md5(random()::text),
    (CURRENT_DATE - (n || ' days')::interval)::date,
    step,
    CASE step
        WHEN 'app_open' THEN 5000 + (random() * 1000)::int
        WHEN 'registration_start' THEN 2000 + (random() * 500)::int
        WHEN 'registration_complete' THEN 1500 + (random() * 400)::int
        WHEN 'first_session' THEN 1200 + (random() * 300)::int
        WHEN 'first_match' THEN 800 + (random() * 200)::int
        WHEN 'first_message' THEN 600 + (random() * 150)::int
        WHEN 'subscription_view' THEN 300 + (random() * 100)::int
        ELSE 50 + (random() * 30)::int
    END,
    CASE step
        WHEN 'app_open' THEN 2000 + (random() * 500)::int
        WHEN 'registration_start' THEN 1500 + (random() * 400)::int
        WHEN 'registration_complete' THEN 1200 + (random() * 300)::int
        WHEN 'first_session' THEN 800 + (random() * 200)::int
        WHEN 'first_match' THEN 600 + (random() * 150)::int
        WHEN 'first_message' THEN 300 + (random() * 100)::int
        WHEN 'subscription_view' THEN 50 + (random() * 30)::int
        ELSE 40 + (random() * 20)::int
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
    NOW(),
    NOW()
FROM generate_series(0, 14) AS n
CROSS JOIN (VALUES ('app_open'), ('registration_start'), ('registration_complete'), ('first_session'), ('first_match'), ('first_message'), ('subscription_view'), ('subscription_purchase')) AS steps(step)
ON CONFLICT DO NOTHING;
"@

docker exec -i $postgresContainer psql -U postgres -d analytics_db -c $seedFunnel
Write-Host "  OK Conversion funnel seeded" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SEEDING COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Data seeded:" -ForegroundColor White
Write-Host "  - 8 User Reports (moderation queue)" -ForegroundColor Gray
Write-Host "  - 8 Support Tickets" -ForegroundColor Gray
Write-Host "  - 31 Daily KPI Summaries" -ForegroundColor Gray
Write-Host "  - 63 Retention Cohort Records" -ForegroundColor Gray
Write-Host "  - 45 Revenue Metric Records" -ForegroundColor Gray
Write-Host "  - 120 Conversion Funnel Records" -ForegroundColor Gray
Write-Host ""
Write-Host "Refresh the frontend to see the data!" -ForegroundColor Yellow
