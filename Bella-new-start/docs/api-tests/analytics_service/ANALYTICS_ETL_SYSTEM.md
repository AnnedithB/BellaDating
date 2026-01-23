# Analytics Service - Complete ETL System Documentation

## Overview

The Analytics Service is a **production-grade data warehouse and ETL (Extract, Transform, Load) system** that automatically processes user behavior data and generates comprehensive business intelligence metrics for the dating app platform.

## Architecture

### System Components

1. **Analytics API Server** (Port 3008)
   - Serves KPI endpoints for the admin dashboard
   - Provides real-time and historical analytics data
   - Implements caching for performance optimization

2. **ETL Pipeline Server** (Port 3010)
   - Runs automated data processing jobs via cron schedules
   - Extracts data from multiple service databases
   - Transforms raw data into aggregated metrics
   - Loads processed data into analytics warehouse

3. **Analytics Database** (`analytics`)
   - 15+ specialized tables for different metric types
   - Stores aggregated KPIs, retention cohorts, revenue metrics
   - Maintains data quality alerts and ETL job logs

### Database Connections

The ETL pipeline connects to **4 different databases**:

```typescript
// Analytics Database (Primary)
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/analytics

// User Service Database
USER_SERVICE_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/users

// Interaction Service Database
INTERACTION_SERVICE_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/interactions

// Communication Service Database
COMMUNICATION_SERVICE_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/communications
```

## ETL Pipeline Jobs

### 1. Daily KPI Aggregation Job
**Schedule**: Every day at 1:00 AM UTC  
**Cron**: `0 1 * * *`

**What it does**:
- Extracts user metrics from `users` database
- Extracts interaction metrics from `interactions` database
- Extracts message metrics from `communications` database
- Extracts revenue metrics from `users` database (subscriptions/payments)
- Extracts safety metrics from moderation service
- Aggregates all metrics into `daily_kpi_summaries` table

**Metrics Calculated**:
- Total active users
- New registrations
- Total sessions
- Average session duration
- Total matches
- Total messages
- Total revenue
- Subscription purchases
- User retention rates (Day 1, 7, 30)
- Conversion to subscription rate
- Video call metrics

### 2. Hourly Behavior Events Job
**Schedule**: Every hour at minute 5  
**Cron**: `5 * * * *`

**What it does**:
- Extracts user behavior events from event stream/Mixpanel
- Processes and loads events into `user_behavior_events` table
- Tracks user actions, screen views, feature usage

**Events Tracked**:
- App opens
- Screen views
- Button clicks
- Feature usage
- Search queries
- Profile views
- Match actions
- Message sends

### 3. Weekly Retention Cohort Analysis Job
**Schedule**: Every Monday at 2:00 AM UTC  
**Cron**: `0 2 * * 1`

**What it does**:
- Analyzes user cohorts by signup week
- Calculates retention rates for weeks 0-12
- Tracks returning users per cohort
- Calculates average sessions, matches, revenue per cohort
- Stores results in `retention_cohorts` table

**Cohort Metrics**:
- Cohort size (users who signed up that week)
- Users returned (active in subsequent weeks)
- Retention rate (percentage)
- Average sessions per user
- Average matches per user
- Average revenue per user
- Subscription conversion rate

### 4. Real-time Session Analytics Job
**Schedule**: Every 15 minutes  
**Cron**: `*/15 * * * *`

**What it does**:
- Extracts recent session data from interaction service
- Processes session metrics (duration, actions, matches)
- Updates `session_analytics` table
- Tracks concurrent users in `hourly_metrics` table

## Analytics Database Schema

### Core Fact Tables

#### 1. `daily_kpi_summaries`
Aggregated daily metrics for the entire platform.

**Key Columns**:
- `date` - The date for metrics
- `total_active_users` - Daily active users
- `new_registrations` - New signups
- `total_sessions` - Total user sessions
- `avg_session_duration` - Average session length
- `total_matches` - Total matches made
- `total_messages` - Total messages sent
- `total_revenue` - Daily revenue
- `subscription_purchases` - New subscriptions
- `user_retention_day1/7/30` - Retention rates
- `conversion_to_subscription` - Conversion rate

#### 2. `retention_cohorts`
User retention analysis by signup cohort.

**Key Columns**:
- `cohort_week` - Week users signed up
- `period_number` - Weeks after signup (0, 1, 2, 3...)
- `cohort_size` - Number of users in cohort
- `users_returned` - Users active in this period
- `retention_rate` - Percentage retained
- `avg_sessions_per_user` - Average sessions
- `avg_matches_per_user` - Average matches
- `avg_revenue_per_user` - Average revenue

#### 3. `conversion_funnels`
Step-by-step conversion tracking.

**Funnel Steps**:
1. `app_open` - User opens app
2. `registration_start` - Begins signup
3. `registration_complete` - Completes signup
4. `first_session` - First active session
5. `first_match` - First match made
6. `first_message` - First message sent
7. `subscription_view` - Views subscription page
8. `subscription_purchase` - Purchases subscription

**Key Columns**:
- `funnel_step` - Current step
- `total_users` - Users at this step
- `converted_users` - Users who converted to next step
- `conversion_rate` - Conversion percentage
- `avg_time_to_convert` - Time to next step

#### 4. `revenue_metrics`
Revenue and subscription analytics.

**Key Columns**:
- `subscription_plan` - Plan type (premium_monthly, vip_annual, etc.)
- `new_subscriptions` - New subs
- `renewed_subscriptions` - Renewals
- `canceled_subscriptions` - Cancellations
- `churned_subscriptions` - Churned subs
- `total_revenue` - Total revenue
- `monthly_recurring_revenue` - MRR
- `annual_recurring_revenue` - ARR
- `customer_lifetime_value` - CLV
- `churn_rate` - Churn percentage

#### 5. `user_behavior_events`
Individual user action events.

**Key Columns**:
- `user_id` - User identifier
- `session_id` - Session identifier
- `event_name` - Event type
- `event_properties` - Event metadata (JSON)
- `event_time` - When event occurred
- `platform` - ios/android/web
- `app_version` - App version
- `location_country` - User location

#### 6. `session_analytics`
Detailed session tracking.

**Key Columns**:
- `session_id` - Unique session ID
- `user_id` - User identifier
- `session_start` - Session start time
- `session_end` - Session end time
- `session_duration` - Duration in seconds
- `screens_viewed` - Number of screens
- `actions_taken` - Number of actions
- `matches_in_session` - Matches made
- `messages_in_session` - Messages sent
- `exit_reason` - How session ended

#### 7. `hourly_metrics`
Real-time hourly metrics.

**Key Columns**:
- `timestamp` - Hour timestamp
- `concurrent_users` - Users online
- `active_interactions` - Active sessions
- `queue_length` - Matching queue size
- `new_users` - New signups this hour
- `new_interactions` - New sessions this hour
- `new_messages` - New messages this hour

### System Tables

#### 8. `etl_job_runs`
ETL job execution logs.

**Key Columns**:
- `job_name` - Job identifier
- `start_time` - Job start
- `end_time` - Job completion
- `status` - running/completed/failed
- `records_processed` - Number of records
- `error_message` - Error details if failed
- `execution_time_ms` - Duration
- `data_quality_checks` - Quality check results (JSON)

#### 9. `data_quality_alerts`
Data quality monitoring alerts.

**Key Columns**:
- `alert_type` - missing_data/data_spike/data_drop/schema_change
- `table_name` - Affected table
- `column_name` - Affected column
- `alert_message` - Alert description
- `severity` - low/medium/high/critical
- `threshold` - Threshold breached
- `actual_value` - Actual value
- `is_resolved` - Resolution status

## API Endpoints

### Analytics API (Port 3008)

#### 1. KPI Overview
```http
GET http://localhost:3008/kpis/overview
```

**Response**:
```json
{
  "currentMetrics": {
    "dailyActiveUsers": 1639,
    "newRegistrations": 45,
    "totalMatches": 892,
    "totalMessages": 3421,
    "dailyRevenue": 1250.50,
    "avgSessionDuration": 18.5,
    "conversionRate": 3.2
  },
  "trends": {
    "avgDailyActiveUsers": 1580,
    "avgDailyRevenue": 1180.25,
    "avgMatchesPerUser": 0.56,
    "avgMessagesPerUser": 2.16,
    "userGrowth": [...]
  },
  "businessMetrics": {
    "totalRevenue30Days": 35407.50,
    "avgRevenuePerUser": 22.41,
    "userRetentionDay7": 42.5,
    "userRetentionDay30": 18.3
  }
}
```

#### 2. Active Users Metrics
```http
GET http://localhost:3008/kpis/active-users?granularity=daily&range=30d
```

**Query Parameters**:
- `granularity`: `hourly`, `daily`, `weekly`, `monthly`, `quarterly`
- `range`: `72h`, `7d`, `30d`, `12w`, `6m`, `4q`

**Response**:
```json
{
  "summary": {
    "latestBucketActiveUsers": 1639,
    "averageBucketActiveUsers": 1580.25,
    "totalBuckets": 30,
    "granularity": "daily",
    "range": {
      "startDate": "2024-11-17T00:00:00.000Z",
      "endDate": "2024-12-17T00:00:00.000Z"
    }
  },
  "breakdown": [
    {
      "label": "2024-11-17",
      "startDate": "2024-11-17T00:00:00.000Z",
      "endDate": "2024-11-17T00:00:00.000Z",
      "activeUsers": 1520,
      "metadata": {
        "newRegistrations": 42,
        "totalSessions": 3840
      }
    }
  ]
}
```

#### 3. Retention Analysis
```http
GET http://localhost:3008/kpis/retention?period=weekly&cohortCount=12
```

**Response**:
```json
{
  "cohortTable": [
    {
      "cohortWeek": "2024-12-09",
      "cohortSize": 150,
      "retentionRates": [
        { "period": 0, "retentionRate": 100, "usersReturned": 150 },
        { "period": 1, "retentionRate": 65.3, "usersReturned": 98 },
        { "period": 4, "retentionRate": 42.0, "usersReturned": 63 }
      ]
    }
  ],
  "periodAverages": [
    { "period": 0, "averageRetention": 100, "cohortCount": 12 },
    { "period": 1, "averageRetention": 62.5, "cohortCount": 12 }
  ],
  "insights": {
    "strongestCohort": {...},
    "overallRetentionTrend": [62.5, 48.3, 38.7, 32.1]
  }
}
```

#### 4. Revenue Analytics
```http
GET http://localhost:3008/kpis/revenue?timeframe=30d
```

**Response**:
```json
{
  "summary": {
    "totalRevenue": 35407.50,
    "totalNewSubscriptions": 142,
    "totalChurnedSubscriptions": 28,
    "netSubscriptionGrowth": 114,
    "averageMRR": 8500.25,
    "averageChurnRate": 2.8,
    "averageRevenuePerUser": 249.35
  },
  "planBreakdown": [
    {
      "plan": "premium_monthly",
      "totalRevenue": 18500.00,
      "totalSubscriptions": 85,
      "avgRevenuePerUser": 217.65
    }
  ],
  "timeline": [...],
  "insights": {
    "topPerformingPlan": {...},
    "revenueGrowthRate": 12.5
  }
}
```

#### 5. User Behavior Analysis
```http
GET http://localhost:3008/kpis/user-behavior?timeframe=7d&eventType=profile_view
```

**Response**:
```json
{
  "overview": {
    "totalEvents": 45820,
    "uniqueUsers": 1580,
    "avgEventsPerUser": 29.0,
    "topEventType": "profile_view"
  },
  "eventBreakdown": [
    { "eventName": "profile_view", "count": 12500 },
    { "eventName": "swipe_right", "count": 8900 }
  ],
  "platformBreakdown": [
    { "platform": "ios", "count": 25000, "percentage": 54.5 },
    { "platform": "android", "count": 18000, "percentage": 39.3 }
  ],
  "temporalPatterns": {
    "hourlyPattern": [...],
    "peakHour": { "hour": 20, "eventCount": 3500, "uniqueUsers": 890 }
  }
}
```

#### 6. Conversion Funnel
```http
GET http://localhost:3008/kpis/funnel?timeframe=30d
```

**Response**:
```json
{
  "funnel": [
    {
      "step": "app_open",
      "averageUsers": 5000,
      "averageConverted": 3500,
      "conversionRate": 70.0,
      "dropOffCount": 1500
    },
    {
      "step": "registration_start",
      "averageUsers": 3500,
      "averageConverted": 2800,
      "conversionRate": 80.0,
      "dropOffCount": 700
    }
  ],
  "stepConversions": [
    {
      "fromStep": "app_open",
      "toStep": "registration_start",
      "conversionRate": 70.0,
      "dropOffRate": 30.0
    }
  ],
  "insights": {
    "biggestDropOff": {...},
    "overallConversionRate": 8.5,
    "totalUsers": 5000,
    "finalConversions": 425
  }
}
```

### ETL Pipeline API (Port 3010)

#### Health Check
```http
GET http://localhost:3010/health
```

#### Manual ETL Triggers

**Trigger Daily KPI Job**:
```http
POST http://localhost:3010/trigger/daily
```

**Trigger Hourly Behavior Job**:
```http
POST http://localhost:3010/trigger/hourly
```

## Testing the ETL Pipeline (Without Dummy Data)

### Prerequisites

1. **Ensure all services are running**:
   ```bash
   docker-compose up -d
   ```

2. **Verify database connections**:
   - Users database: `users` (Port 5432)
   - Analytics database: `analytics` (Port 5432)
   - Interaction database: `interactions` (Port 5432)
   - Communication database: `communications` (Port 5432)

### Step-by-Step Testing Process

#### Phase 1: Create Real User Data

**1. Register Users** (User Service - Port 3001)
```http
POST http://localhost:3001/api/auth/register
Content-Type: application/json

{
  "email": "user1@example.com",
  "password": "password123",
  "username": "user1",
  "dateOfBirth": "1995-05-15"
}
```

Repeat for multiple users (at least 10-20 for meaningful analytics).

**2. Create User Sessions** (User Service)
```http
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "user1@example.com",
  "password": "password123"
}
```

This creates session records in the `users` database.

**3. Create User Profiles** (User Service)
```http
PUT http://localhost:3001/api/users/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "displayName": "John Doe",
  "bio": "Looking for meaningful connections",
  "interests": ["hiking", "reading", "travel"],
  "location": {
    "city": "New York",
    "country": "USA"
  }
}
```

#### Phase 2: Generate User Activity

**4. Create Matches** (Interaction Service - Port 3002)
```http
POST http://localhost:3002/api/matches
Authorization: Bearer {token}
Content-Type: application/json

{
  "targetUserId": "user2_id",
  "action": "like"
}
```

**5. Send Messages** (Communication Service - Port 3003)
```http
POST http://localhost:3003/api/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "recipientId": "user2_id",
  "content": "Hello! Nice to meet you."
}
```

**6. Create Subscriptions** (User Service)
```http
POST http://localhost:3001/api/subscriptions
Authorization: Bearer {token}
Content-Type: application/json

{
  "plan": "premium_monthly",
  "paymentMethod": "credit_card"
}
```

#### Phase 3: Trigger ETL Pipeline

**7. Run Daily KPI Job**
```http
POST http://localhost:3010/trigger/daily
```

**Expected Result**:
- Processes user data from `users` database
- Calculates active users, new registrations
- Aggregates matches, messages, revenue
- Inserts records into `daily_kpi_summaries` table

**8. Run Hourly Behavior Job**
```http
POST http://localhost:3010/trigger/hourly
```

**Expected Result**:
- Processes recent user events
- Updates `user_behavior_events` table
- Updates `hourly_metrics` table

#### Phase 4: Verify Analytics Data

**9. Check Daily KPI Summary**
```sql
-- Connect to analytics database
docker exec -it kindred-postgres psql -U postgres -d analytics

-- Query daily KPIs
SELECT 
  date,
  total_active_users,
  new_registrations,
  total_matches,
  total_messages,
  total_revenue
FROM daily_kpi_summaries
ORDER BY date DESC
LIMIT 7;
```

**10. Check KPI Overview Endpoint**
```http
GET http://localhost:3008/kpis/overview
```

**Expected Result**:
- Should show real metrics calculated from your test data
- Active users count should match number of logged-in users
- Matches and messages should reflect actual activity

**11. Check Active Users Endpoint**
```http
GET http://localhost:3008/kpis/active-users?granularity=daily&range=7d
```

**Expected Result**:
- Breakdown of daily active users
- Should show activity for days when users were active

#### Phase 5: Test Retention Analysis

**12. Wait for Weekly Retention Job** (or trigger manually if implemented)

The retention job runs every Monday at 2 AM. To test immediately, you would need to:

1. Modify the cron schedule temporarily
2. Or add a manual trigger endpoint for retention job
3. Or wait until Monday

**13. Check Retention Data**
```sql
SELECT 
  cohort_week,
  period_number,
  cohort_size,
  users_returned,
  retention_rate
FROM retention_cohorts
ORDER BY cohort_week DESC, period_number ASC;
```

**14. Check Retention Endpoint**
```http
GET http://localhost:3008/kpis/retention?period=weekly&cohortCount=4
```

### Data Flow Verification

#### Check ETL Job Logs
```sql
SELECT 
  job_name,
  start_time,
  end_time,
  status,
  records_processed,
  error_message
FROM etl_job_runs
ORDER BY start_time DESC
LIMIT 10;
```

#### Check Data Quality Alerts
```sql
SELECT 
  alert_type,
  table_name,
  alert_message,
  severity,
  created_at
FROM data_quality_alerts
WHERE is_resolved = false
ORDER BY created_at DESC;
```

## Automated Testing Workflow

### Complete Test Sequence

```bash
# 1. Start all services
docker-compose up -d

# 2. Wait for services to be healthy
sleep 30

# 3. Create test users (script)
./scripts/create-test-users.sh

# 4. Generate user activity (script)
./scripts/generate-activity.sh

# 5. Trigger ETL pipeline
curl -X POST http://localhost:3010/trigger/daily
curl -X POST http://localhost:3010/trigger/hourly

# 6. Verify analytics data
curl http://localhost:3008/kpis/overview

# 7. Check database
docker exec -it kindred-postgres psql -U postgres -d analytics \
  -c "SELECT COUNT(*) FROM daily_kpi_summaries;"
```

## Production Deployment

### Environment Variables

```env
# Analytics Service
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/analytics
USER_SERVICE_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/users
INTERACTION_SERVICE_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/interactions
COMMUNICATION_SERVICE_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/communications

API_PORT=3008
ETL_PORT=3010
LOG_LEVEL=info
NODE_ENV=production

# Caching
CACHE_TTL=300
CACHE_CHECK_PERIOD=60

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Cron Schedule Configuration

The ETL pipeline runs automatically with these schedules:

- **Daily KPI**: `0 1 * * *` (1:00 AM UTC daily)
- **Hourly Behavior**: `5 * * * *` (Every hour at :05)
- **Weekly Retention**: `0 2 * * 1` (2:00 AM UTC every Monday)
- **Session Analytics**: `*/15 * * * *` (Every 15 minutes)

### Monitoring

**Check ETL Pipeline Health**:
```http
GET http://localhost:3010/health
```

**Check Analytics API Health**:
```http
GET http://localhost:3008/health
```

**View ETL Job History**:
```sql
SELECT * FROM etl_job_runs 
WHERE status = 'failed' 
ORDER BY start_time DESC;
```

**View Data Quality Issues**:
```sql
SELECT * FROM data_quality_alerts 
WHERE is_resolved = false 
AND severity IN ('high', 'critical');
```

## Troubleshooting

### ETL Job Fails

1. **Check database connections**:
   ```bash
   docker exec -it kindred-postgres psql -U postgres -l
   ```

2. **Check ETL logs**:
   ```bash
   docker logs kindred-analytics-service --tail 100
   ```

3. **Verify source data exists**:
   ```sql
   -- Check users database
   SELECT COUNT(*) FROM users;
   
   -- Check sessions
   SELECT COUNT(*) FROM user_sessions;
   ```

### No Data in Analytics Tables

1. **Trigger ETL manually**:
   ```http
   POST http://localhost:3010/trigger/daily
   ```

2. **Check ETL job status**:
   ```sql
   SELECT * FROM etl_job_runs ORDER BY start_time DESC LIMIT 5;
   ```

3. **Verify source databases have data**:
   ```bash
   # Check users
   docker exec -it kindred-postgres psql -U postgres -d users \
     -c "SELECT COUNT(*) FROM users;"
   ```

### Analytics API Returns Empty Data

1. **Check if ETL has run**:
   ```sql
   SELECT COUNT(*) FROM daily_kpi_summaries;
   ```

2. **Clear cache**:
   ```http
   DELETE http://localhost:3008/cache
   ```

3. **Check date range**:
   ```sql
   SELECT MIN(date), MAX(date) FROM daily_kpi_summaries;
   ```

## Summary

The Analytics Service is a **complete enterprise-grade analytics platform** that:

✅ **Automatically processes** user data from multiple databases  
✅ **Calculates real metrics** (not dummy data) via ETL pipeline  
✅ **Provides comprehensive KPIs** through REST API  
✅ **Monitors data quality** with automated alerts  
✅ **Scales to production** with proper caching and optimization  

Once user activity is generated through the main app APIs, the ETL pipeline will automatically process this data and populate all analytics tables with **real, calculated metrics** - no dummy data needed!
