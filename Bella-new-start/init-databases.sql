-- ============================================================================
-- KINDRED - Database Initialization Script
-- ============================================================================
-- This script creates all databases for the 12 microservices
-- Runs automatically when PostgreSQL container starts for the first time
-- ============================================================================

-- Create databases for each microservice
CREATE DATABASE users;
CREATE DATABASE queuing;
CREATE DATABASE interactions;
CREATE DATABASE history;
CREATE DATABASE communications;
CREATE DATABASE notifications;
CREATE DATABASE moderation;
CREATE DATABASE analytics;
CREATE DATABASE admin;
CREATE DATABASE subscriptions;

-- Grant all privileges to postgres user (superuser)
GRANT ALL PRIVILEGES ON DATABASE users TO postgres;
GRANT ALL PRIVILEGES ON DATABASE queuing TO postgres;
GRANT ALL PRIVILEGES ON DATABASE interactions TO postgres;
GRANT ALL PRIVILEGES ON DATABASE history TO postgres;
GRANT ALL PRIVILEGES ON DATABASE communications TO postgres;
GRANT ALL PRIVILEGES ON DATABASE notifications TO postgres;
GRANT ALL PRIVILEGES ON DATABASE moderation TO postgres;
GRANT ALL PRIVILEGES ON DATABASE analytics TO postgres;
GRANT ALL PRIVILEGES ON DATABASE admin TO postgres;
GRANT ALL PRIVILEGES ON DATABASE subscriptions TO postgres;

-- Log completion
\echo '============================================================================'
\echo 'KINDRED: All 10 databases created successfully'
\echo '============================================================================'
\echo 'Databases:'
\echo '  - users (user-service)'
\echo '  - queuing (queuing-service)'
\echo '  - interactions (interaction-service)'
\echo '  - history (history-service)'
\echo '  - communications (communication-service)'
\echo '  - notifications (notification-service)'
\echo '  - moderation (moderation-service)'
\echo '  - analytics (analytics-service)'
\echo '  - admin (admin-service)'
\echo '  - subscriptions (subscription-service)'
\echo '============================================================================'
