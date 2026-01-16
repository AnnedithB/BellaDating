-- Seed Daily KPI Summaries (last 30 days)
-- Based on 9 total users in the system
INSERT INTO daily_kpi_summaries (id, date, total_active_users, new_registrations, total_sessions, avg_session_duration, total_matches, total_messages, total_revenue, subscription_purchases, avg_subscription_value, total_reports, moderation_actions, user_retention_day1, user_retention_day7, user_retention_day30, conversion_to_subscription, total_video_calls_initiated, total_video_calls_completed, avg_video_call_duration, created_at, updated_at)
SELECT 
    'kpi_' || md5(random()::text || n::text),
    (CURRENT_DATE - (n || ' days')::interval)::date,
    CASE WHEN n = 0 THEN 9 ELSE (3 + (random() * 6)::int) END,  -- Today: 9 users, past: 3-9 active
    CASE WHEN n < 7 THEN (random() * 2)::int ELSE 0 END,  -- 0-2 new registrations in last week
    (5 + (random() * 15)::int),  -- 5-20 sessions per day
    12.5 + random() * 8,  -- 12-20 min avg session
    (1 + (random() * 4)::int),  -- 1-5 matches per day
    (10 + (random() * 30)::int),  -- 10-40 messages per day
    (random() * 50),  -- $0-50 revenue per day
    (random() * 2)::int,  -- 0-2 subscription purchases
    9.99 + random() * 10,
    (random() * 3)::int,  -- 0-3 reports per day
    (random() * 2)::int,  -- 0-2 moderation actions
    0.75 + random() * 0.15,
    0.45 + random() * 0.2,
    0.25 + random() * 0.15,
    0.05 + random() * 0.1,
    (random() * 5)::int,  -- 0-5 video calls initiated
    (random() * 4)::int,  -- 0-4 video calls completed
    8.5 + random() * 5,
    NOW(),
    NOW()
FROM generate_series(0, 30) AS n
ON CONFLICT DO NOTHING;

-- Seed Retention Cohorts
-- Based on 9 total users
INSERT INTO retention_cohorts (id, cohort_week, period_number, cohort_size, users_returned, retention_rate, avg_sessions_per_user, avg_matches_per_user, avg_revenue_per_user, subscription_conv_rate, created_at, updated_at)
SELECT 
    'ret_' || md5(random()::text || w::text || p::text),
    (CURRENT_DATE - ((w * 7) || ' days')::interval)::date,
    p,
    CASE WHEN w = 0 THEN 9 ELSE (2 + (random() * 5)::int) END,  -- Current week: 9 users, older: 2-7
    CASE 
        WHEN p = 0 THEN CASE WHEN w = 0 THEN 9 ELSE (2 + (random() * 5)::int) END
        ELSE GREATEST(1, (CASE WHEN w = 0 THEN 9 ELSE (2 + (random() * 5)::int) END - p))::int 
    END,
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

-- Seed Revenue Metrics
-- Based on 9 total users (assume 2-3 are paying subscribers)
INSERT INTO revenue_metrics (id, date, subscription_plan, new_subscriptions, renewed_subscriptions, canceled_subscriptions, churned_subscriptions, total_revenue, avg_revenue_per_user, monthly_recurring_revenue, annual_recurring_revenue, customer_lifetime_value, churn_rate, net_revenue_retention, gross_revenue_retention, created_at, updated_at)
SELECT 
    'rev_' || md5(random()::text || n::text || plan),
    (CURRENT_DATE - (n || ' days')::interval)::date,
    plan,
    CASE WHEN n < 7 THEN (random() * 2)::int ELSE 0 END,  -- 0-1 new subs in last week
    (random() * 2)::int,  -- 0-1 renewals
    (random() * 1)::int,  -- 0-1 cancellations
    0,  -- no churned
    CASE plan 
        WHEN 'premium_monthly' THEN random() * 30 
        WHEN 'premium_annual' THEN random() * 80 
        ELSE random() * 40 
    END,
    CASE plan WHEN 'premium_monthly' THEN 9.99 WHEN 'premium_annual' THEN 79.99 ELSE 19.99 END,
    50 + random() * 30,  -- ~$50-80 MRR
    600 + random() * 400,  -- ~$600-1000 ARR
    120 + random() * 80,
    0.02 + random() * 0.03,
    1.05 + random() * 0.1,
    0.92 + random() * 0.05,
    NOW(),
    NOW()
FROM generate_series(0, 14) AS n
CROSS JOIN (VALUES ('premium_monthly'), ('premium_annual'), ('vip_monthly')) AS plans(plan)
ON CONFLICT DO NOTHING;

-- Seed Conversion Funnel
-- Based on 9 total users
INSERT INTO conversion_funnels (id, date, funnel_step, total_users, converted_users, conversion_rate, created_at, updated_at)
SELECT 
    'fun_' || md5(random()::text || n::text || step),
    (CURRENT_DATE - (n || ' days')::interval)::date,
    step,
    CASE step
        WHEN 'app_open' THEN (15 + (random() * 10)::int)  -- 15-25 app opens
        WHEN 'registration_start' THEN (12 + (random() * 5)::int)  -- 12-17 started
        WHEN 'registration_complete' THEN (10 + (random() * 3)::int)  -- 10-13 completed
        WHEN 'first_session' THEN (8 + (random() * 3)::int)  -- 8-11 first session
        WHEN 'first_match' THEN (5 + (random() * 3)::int)  -- 5-8 first match
        WHEN 'first_message' THEN (4 + (random() * 3)::int)  -- 4-7 first message
        WHEN 'subscription_view' THEN (2 + (random() * 3)::int)  -- 2-5 viewed subscription
        ELSE (random() * 2)::int  -- 0-2 purchased
    END,
    CASE step
        WHEN 'app_open' THEN (12 + (random() * 5)::int)
        WHEN 'registration_start' THEN (10 + (random() * 3)::int)
        WHEN 'registration_complete' THEN (8 + (random() * 3)::int)
        WHEN 'first_session' THEN (5 + (random() * 3)::int)
        WHEN 'first_match' THEN (4 + (random() * 3)::int)
        WHEN 'first_message' THEN (2 + (random() * 3)::int)
        WHEN 'subscription_view' THEN (random() * 2)::int
        ELSE (random() * 2)::int
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

-- Seed Hourly Metrics
-- Based on 9 total users
INSERT INTO hourly_metrics (id, timestamp, hour, "concurrentUsers", "activeInteractions", "queueLength", "newUsers", "newInteractions", "newMessages", "createdAt")
SELECT 
    'hour_' || md5(random()::text || h::text),
    NOW() - (h || ' hours')::interval,
    EXTRACT(HOUR FROM NOW() - (h || ' hours')::interval)::int,
    (random() * 9)::int,  -- 0-9 concurrent users
    (random() * 5)::int,  -- 0-5 active interactions
    (random() * 3)::int,  -- 0-3 queue length
    CASE WHEN h < 24 THEN (random() * 2)::int ELSE 0 END,  -- 0-1 new users in last 24h
    (random() * 8)::int,  -- 0-8 new interactions
    (random() * 15)::int,  -- 0-15 new messages
    NOW()
FROM generate_series(0, 72) AS h
ON CONFLICT DO NOTHING;
