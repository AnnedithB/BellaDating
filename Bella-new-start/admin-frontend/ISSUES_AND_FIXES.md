# Admin Panel Issues and Fixes

## Issue 1: `/api/auth/me` Returns 404 (Not Found)

### Problem
The endpoint `/api/auth/me` is returning 404 even though the admin exists.

### Root Cause
The `/me` endpoint was added to the codebase, but the **backend service on EC2 hasn't been restarted** after the code changes. The endpoint exists in the code at:
- `Bella-new-start/services/admin-service/src/routes/auth.ts` (lines 92-140)

### Solution
**Restart the Admin Service on EC2:**

```bash
# SSH into your EC2 instance
ssh user@51.20.160.210

# Navigate to the project directory
cd /path/to/Bella-new-start

# Restart the admin service
# If using Docker:
docker compose restart admin-service

# OR if running directly:
cd services/admin-service
npm run build
pm2 restart admin-service  # or however you're running it
```

### Verification
After restarting, the endpoint should work:
- **Endpoint**: `GET http://51.20.160.210:3009/api/auth/me`
- **Headers**: `Authorization: Bearer <your-token>`
- **Response**: Admin user information (id, email, firstName, lastName, role, permissions)

---

## Issue 2: Suspend/Activate Not Working in Users List

### Problem
The Suspend and Activate buttons in the Users list don't actually update user status.

### Root Cause
The endpoint existed but only logged the action without updating the user in the database (see TODO comment in code).

### Solution
**Fixed in**: `Bella-new-start/services/admin-service/src/routes/users.ts`

The endpoint now:
1. ✅ Updates the user's `is_active` field in the `users` database
2. ✅ Logs the moderation action
3. ✅ Returns the updated user information

### How It Works
- **Endpoint**: `PATCH /api/users/:id/status`
- **Body**: `{ "status": "ACTIVE" | "SUSPENDED" | "BANNED" | "INACTIVE", "reason": "optional reason" }`
- **Requires**: Authentication token + `users.moderate` permission

### Status Mapping
- `ACTIVE` → Sets `is_active = true` in database
- `SUSPENDED` → Sets `is_active = false` in database
- `BANNED` → Sets `is_active = false` in database
- `INACTIVE` → Sets `is_active = false` in database

**Note**: After fixing, you need to restart the admin service for changes to take effect.

---

## Issue 3: Chart Data Sources

### Overview
The Analytics dashboard charts use data from the **Analytics Service** (port 3008) and **Admin Service** (port 3009).

### Chart Data Sources

#### 1. **Revenue Trends Chart** (Last 30 Days)
- **API Endpoint**: `GET /kpis/revenue?timeframe=30d`
- **Service**: Analytics Service (port 3008)
- **Data Source**: `revenueData.timeline[]`
  - Each item contains: `{ date, revenue, newSubscriptions, churnedSubscriptions, mrr }`
- **Database Tables**: `RevenueMetrics` table in analytics database
- **Shows**: Daily revenue over the last 30 days

#### 2. **User Retention Chart**
- **API Endpoint**: `GET /kpis/overview`
- **Service**: Analytics Service (port 3008)
- **Data Source**: `overview.businessMetrics.userRetentionDay7` and `userRetentionDay30`
- **Database Tables**: `DailyKPISummary` table (retention fields)
- **Shows**: Day 7 and Day 30 retention percentages

#### 3. **Active Users Chart** (Last 7 Days)
- **API Endpoint**: `GET /kpis/active-users?granularity=daily&range=7d`
- **Service**: Analytics Service (port 3008)
- **Data Source**: `activeUsersData.breakdown[]`
  - Each item contains: `{ startDate, endDate, activeUsers, metadata }`
- **Database Tables**: `DailyKPISummary` (for daily) or `HourlyMetrics` (for hourly)
- **Shows**: Daily active users for the last 7 days

#### 4. **User Growth Chart** (Last 30 Days)
- **API Endpoint**: `GET /kpis/overview`
- **Service**: Analytics Service (port 3008)
- **Data Source**: `overview.trends.userGrowth[]`
  - Each item contains: `{ date, newUsers, activeUsers, revenue }`
- **Database Tables**: `DailyKPISummary` table (newRegistrations field)
- **Shows**: New user registrations over the last 30 days

### KPI Cards Data Sources

#### KPI Cards (Top of Dashboard)
- **API Endpoint**: `GET /kpis/overview` (Analytics Service)
- **Data Source**: `overview.currentMetrics`
  - `dailyActiveUsers` - From latest `DailyKPISummary`
  - `newRegistrations` - From latest `DailyKPISummary`
  - `totalMatches` - From latest `DailyKPISummary`
  - `totalMessages` - From latest `DailyKPISummary`

- **API Endpoint**: `GET /api/analytics/dashboard` (Admin Service)
- **Data Source**: `dashboard.users.total` and `dashboard.reports.pending`

### Database Tables Used

1. **Analytics Database**:
   - `DailyKPISummary` - Daily aggregated metrics
   - `HourlyMetrics` - Hourly metrics (if using hourly granularity)
   - `RevenueMetrics` - Revenue data
   - `RetentionCohort` - User retention cohorts

2. **Admin Database**:
   - `Admin` - Admin users
   - `ModerationAction` - Moderation logs

3. **User Database**:
   - `users` - User accounts
   - `profiles` - User profiles

### Data Flow

```
Frontend (Port 5005)
    ↓
Analytics Service (Port 3008)
    ↓
Analytics Database (PostgreSQL)
    ↓
DailyKPISummary, RevenueMetrics, etc.
```

### Notes

- **Real-time Data**: Charts show cached data (5-10 minute TTL) for performance
- **Empty States**: Charts show "No data available" if:
  - Analytics Service is not running
  - No data exists in the database
  - Database connection fails
- **Data Requirements**: For charts to show data, you need:
  1. Analytics Service running on port 3008
  2. Analytics database with populated `DailyKPISummary` and `RevenueMetrics` tables
  3. Seed data or actual user activity to generate metrics

---

## Next Steps

1. **Restart Admin Service** on EC2 to fix `/api/auth/me` endpoint
2. **Restart Admin Service** on EC2 to fix user status updates
3. **Verify Analytics Service** is running and has data in the database
4. **Seed Analytics Data** if charts are empty (see `seeds/seed-analytics.sql`)
