-- Analytics Database Initialization Script
-- Create analytics database if it doesn't exist
CREATE DATABASE IF NOT EXISTS analytics;

-- Create user dimensions table indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_dimensions_signup_date 
ON user_dimensions(signup_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_dimensions_subscription_status 
ON user_dimensions(subscription_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_dimensions_location_country 
ON user_dimensions(location_country);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_dimensions_age 
ON user_dimensions(age);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_dimensions_last_active 
ON user_dimensions(last_active_date);

-- Create daily KPI summary indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_kpi_date 
ON daily_kpi_summaries(date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_kpi_active_users 
ON daily_kpi_summaries(total_active_users);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_kpi_revenue 
ON daily_kpi_summaries(total_revenue);

-- Create retention cohort indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_retention_cohort_week 
ON retention_cohorts(cohort_week);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_retention_period 
ON retention_cohorts(period_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_retention_rate 
ON retention_cohorts(retention_rate);

-- Create user behavior event indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_behavior_user_id 
ON user_behavior_events(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_behavior_event_name 
ON user_behavior_events(event_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_behavior_event_time 
ON user_behavior_events(event_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_behavior_session_id 
ON user_behavior_events(session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_behavior_platform 
ON user_behavior_events(platform);

-- Create session analytics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_analytics_user_id 
ON session_analytics(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_analytics_start 
ON session_analytics(session_start);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_analytics_duration 
ON session_analytics(session_duration);

-- Create ETL job run indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_etl_job_runs_name 
ON etl_job_runs(job_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_etl_job_runs_start_time 
ON etl_job_runs(start_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_etl_job_runs_status 
ON etl_job_runs(status);

-- Create data quality alert indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_quality_alert_type 
ON data_quality_alerts(alert_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_quality_severity 
ON data_quality_alerts(severity);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_quality_resolved 
ON data_quality_alerts(is_resolved);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_quality_created 
ON data_quality_alerts(created_at);

-- Create materialized views for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_kpi_overview AS
SELECT 
    date,
    total_active_users,
    new_registrations,
    total_revenue,
    total_matches,
    total_messages,
    avg_session_duration,
    conversion_to_subscription,
    user_retention_day7,
    user_retention_day30
FROM daily_kpi_summaries 
WHERE user_dimension_id IS NULL
ORDER BY date DESC;

-- Create refresh function for materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_kpi_overview;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean old data
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $$
BEGIN
    -- Delete user behavior events older than 90 days
    DELETE FROM user_behavior_events 
    WHERE event_time < NOW() - INTERVAL '90 days';
    
    -- Delete ETL job runs older than 30 days
    DELETE FROM etl_job_runs 
    WHERE start_time < NOW() - INTERVAL '30 days';
    
    -- Delete resolved data quality alerts older than 7 days
    DELETE FROM data_quality_alerts 
    WHERE is_resolved = true 
    AND resolved_at < NOW() - INTERVAL '7 days';
    
    -- Vacuum tables to reclaim space
    VACUUM ANALYZE user_behavior_events;
    VACUUM ANALYZE etl_job_runs;
    VACUUM ANALYZE data_quality_alerts;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE analytics TO analytics;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO analytics;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO analytics;

-- Enable row level security for sensitive data
ALTER TABLE user_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (can be customized based on requirements)
CREATE POLICY analytics_user_access ON user_dimensions
FOR ALL TO analytics USING (true);

CREATE POLICY analytics_events_access ON user_behavior_events
FOR ALL TO analytics USING (true);

-- Set up automatic cleanup job (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-analytics', '0 2 * * *', 'SELECT cleanup_old_analytics_data();');

-- Set up automatic view refresh (requires pg_cron extension)
-- SELECT cron.schedule('refresh-analytics-views', '*/30 * * * *', 'SELECT refresh_analytics_views();');