-- Seed Hourly Metrics
-- Based on 9 total users in the system
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
