# Analytics Endpoints Testing Guide

**Base URLs:**
- **Admin Service Analytics:** `http://localhost:3009`
- **Analytics Service:** `http://localhost:3008`

---

## What is the Analytics System?

The **Analytics System** provides comprehensive insights and metrics for the Kindred app platform. It consists of two main components:

1. **Admin Service Analytics** - Provides dashboard overview metrics and user statistics for admin panel
2. **Analytics Service** - Dedicated service for advanced KPI tracking, user behavior analysis, revenue metrics, retention cohorts, and conversion funnels

**Purpose & Role:**
- **Dashboard Metrics:** Real-time overview of platform health, user counts, reports, and moderation actions
- **KPI Tracking:** Daily active users, revenue, matches, messages, session duration, conversion rates
- **User Analytics:** Active user trends, retention cohorts, user behavior patterns, demographic distribution
- **Revenue Analytics:** Subscription metrics, MRR, churn rates, revenue trends, plan breakdowns
- **Conversion Funnel:** Track user journey from app open to subscription purchase
- **Performance Monitoring:** Real-time metrics, system performance, cache statistics

**Why it's important:** Analytics drive data-driven decision making, help identify growth opportunities, monitor platform health, and optimize user experience. Without analytics, you can't measure success, identify problems, or make informed product decisions.

**How it works:**
1. Data is aggregated from various services (user-service, interaction-service, subscription-service)
2. Metrics are calculated and stored in time-series format (hourly, daily)
3. APIs provide cached access to aggregated metrics
4. Admin dashboard consumes these metrics for visualization
5. Real-time endpoints provide current system state

---

## Prerequisites

1. **PostgreSQL** must be running (analytics_db database)
2. **Admin Service** must be running (for admin analytics endpoints)
3. **Analytics Service** must be running (for KPI endpoints)
4. **User Service** should be running (for user data)
5. **Admin Login Required** - You need to login as admin first to get JWT token

---

## Testing Order & Authentication

### Step 1: Admin Login (REQUIRED FIRST)

**⚠️ IMPORTANT:** Most analytics endpoints require admin authentication. You must login first to get a JWT token.

```powershell
# Login to Admin Service to get JWT token
$response = Invoke-RestMethod -Uri "http://localhost:3009/api/auth/login" -Method POST -Body '{"email":"ogollachucho@gmail.com","password":"123456789"}' -ContentType "application/json"

# Save token for later use
$token = $response.token
Write-Host "Token: $token"

# Create headers with token
$headers = @{ Authorization = "Bearer $token" }
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "admin001",
    "email": "ogollachucho@gmail.com",
    "firstName": "Super",
    "lastName": "Admin",
    "role": "SUPER_ADMIN",
    "permissions": []
  }
}
```

---

## Admin Service Analytics Endpoints

**Base URL:** `http://localhost:3009`  
**Authentication:** ✅ Required (Admin JWT Token)  
**Permission Required:** `analytics.read`

### 1. Get Dashboard Analytics

**Endpoint:** `GET /api/analytics/dashboard`

**Description:** Returns overview metrics for admin dashboard including user stats, report counts, and moderation actions.

**Authentication:** ✅ Required - Admin JWT Token  
**Permission:** `analytics.read`

**Request:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3009/api/analytics/dashboard" -Headers $headers -Method GET
```

**Expected Response:**
```json
{
  "users": {
    "total": 1250,
    "active": 980,
    "suspended": 270
  },
  "reports": {
    "total": 45,
    "pending": 12,
    "resolved": 33
  },
  "moderation": {
    "totalActions": 156
  }
}
```

**Testing Order:** Test this **FIRST** after login - it's the main dashboard endpoint.

---

### 2. Get User Growth Analytics

**Endpoint:** `GET /api/analytics/users/growth`

**Description:** Returns user growth trends over time (currently returns placeholder - needs integration with user-service API).

**Authentication:** ✅ Required - Admin JWT Token  
**Permission:** `analytics.read`

**Request:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3009/api/analytics/users/growth" -Headers $headers -Method GET
```

**Expected Response:**
```json
{
  "message": "User growth data - integrate with user-service API"
}
```

**Note:** This endpoint is a placeholder and needs integration with user-service API.

**Testing Order:** Test this **SECOND** after dashboard endpoint.

---

## Analytics Service KPI Endpoints

**Base URL:** `http://localhost:3008`  
**Authentication:** ⚠️ Note: These endpoints don't explicitly require authentication in code, but may need JWT tokens in production. Check service configuration.

### 3. Get KPI Overview

**Endpoint:** `GET /kpis/kpis/overview`

**Description:** Returns comprehensive KPI overview including current metrics, trends, and business metrics. Used by admin dashboard for "Active Now" card.

**Authentication:** ⚠️ Check service config (may require JWT)  
**Query Parameters:** None

**Request:**
```powershell
# If authentication is required, use headers
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/overview" -Headers $headers -Method GET

# If no auth required
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/overview" -Method GET
```

**Expected Response:**
```json
{
  "currentMetrics": {
    "dailyActiveUsers": 450,
    "newRegistrations": 23,
    "totalMatches": 1250,
    "totalMessages": 8900,
    "dailyRevenue": 1250.50,
    "avgSessionDuration": 12.5,
    "conversionRate": 0.15
  },
  "trends": {
    "avgDailyActiveUsers": 420,
    "avgDailyRevenue": 1100.25,
    "avgMatchesPerUser": 2.8,
    "avgMessagesPerUser": 19.8,
    "userGrowth": [
      {
        "date": "2024-01-15",
        "newUsers": 20,
        "activeUsers": 430,
        "revenue": 1200
      }
    ]
  },
  "businessMetrics": {
    "totalRevenue30Days": 33000,
    "avgRevenuePerUser": 2.75,
    "userRetentionDay7": 0.65,
    "userRetentionDay30": 0.45
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Testing Order:** Test this **THIRD** - it's the main KPI endpoint used by dashboard.

---

### 4. Get Active Users Metrics

**Endpoint:** `GET /kpis/kpis/active-users`

**Description:** Returns active user metrics with granularity options (hourly, daily, weekly, monthly, quarterly) and time range filtering.

**Authentication:** ⚠️ Check service config  
**Query Parameters:**
- `granularity` (optional): `hourly` | `daily` | `weekly` | `monthly` | `quarterly` (default: `daily`)
- `range` (optional): `24h` | `7d` | `30d` | `90d` | `12w` | `6m` | `4q` (default: based on granularity)

**Request:**
```powershell
# Daily active users for last 30 days
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/active-users?granularity=daily&range=30d" -Method GET

# Hourly active users for last 24 hours
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/active-users?granularity=hourly&range=24h" -Method GET
```

**Expected Response:**
```json
{
  "summary": {
    "latestBucketActiveUsers": 450,
    "averageBucketActiveUsers": 420,
    "totalBuckets": 30,
    "granularity": "daily",
    "range": {
      "startDate": "2023-12-16T00:00:00.000Z",
      "endDate": "2024-01-15T23:59:59.999Z"
    }
  },
  "breakdown": [
    {
      "label": "2024-01-15",
      "startDate": "2024-01-15T00:00:00.000Z",
      "endDate": "2024-01-15T23:59:59.999Z",
      "activeUsers": 450,
      "metadata": {
        "newRegistrations": 23,
        "totalSessions": 1250
      }
    }
  ]
}
```

**Testing Order:** Test this **FOURTH** - after overview endpoint.

---

### 5. Get Retention Cohorts

**Endpoint:** `GET /kpis/kpis/retention`

**Description:** Returns user retention cohort analysis showing how well users are retained over time periods.

**Authentication:** ⚠️ Check service config  
**Query Parameters:**
- `period` (optional): `weekly` | `monthly` (default: `weekly`)
- `cohortCount` (optional): Number (default: `12`)

**Request:**
```powershell
# Weekly retention for last 12 cohorts
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/retention?period=weekly&cohortCount=12" -Method GET

# Monthly retention
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/retention?period=monthly&cohortCount=6" -Method GET
```

**Expected Response:**
```json
{
  "cohortTable": [
    {
      "cohortWeek": "2024-01-01",
      "cohortSize": 150,
      "retentionRates": [
        {
          "period": 0,
          "retentionRate": 1.0,
          "usersReturned": 150
        },
        {
          "period": 1,
          "retentionRate": 0.65,
          "usersReturned": 98
        }
      ]
    }
  ],
  "periodAverages": [
    {
      "period": 0,
      "averageRetention": 1.0,
      "cohortCount": 12
    }
  ],
  "insights": {
    "strongestCohort": {
      "cohortWeek": "2024-01-01",
      "retention": 0.75
    },
    "overallRetentionTrend": [1.0, 0.65, 0.50, 0.40]
  }
}
```

**Testing Order:** Test this **FIFTH**.

---

### 6. Get Revenue Analytics

**Endpoint:** `GET /kpis/kpis/revenue`

**Description:** Returns revenue metrics including MRR, churn rates, subscription trends, and plan breakdowns.

**Authentication:** ⚠️ Check service config  
**Query Parameters:**
- `timeframe` (optional): `7d` | `30d` | `90d` (default: `30d`)

**Request:**
```powershell
# Revenue for last 30 days
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/revenue?timeframe=30d" -Method GET

# Revenue for last 7 days
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/revenue?timeframe=7d" -Method GET
```

**Expected Response:**
```json
{
  "summary": {
    "totalRevenue": 33000,
    "totalNewSubscriptions": 125,
    "totalChurnedSubscriptions": 15,
    "netSubscriptionGrowth": 110,
    "averageMRR": 1100,
    "averageChurnRate": 0.05,
    "averageRevenuePerUser": 2.75
  },
  "planBreakdown": [
    {
      "plan": "premium",
      "totalRevenue": 25000,
      "totalSubscriptions": 100,
      "avgRevenuePerUser": 25.0
    }
  ],
  "timeline": [
    {
      "date": "2024-01-15",
      "revenue": 1250,
      "newSubscriptions": 5,
      "churnedSubscriptions": 1,
      "mrr": 1100
    }
  ],
  "insights": {
    "topPerformingPlan": {
      "plan": "premium",
      "revenue": 25000
    },
    "revenueGrowthRate": 0.12
  }
}
```

**Testing Order:** Test this **SIXTH**.

---

### 7. Get User Behavior Analytics

**Endpoint:** `GET /kpis/kpis/user-behavior`

**Description:** Returns user behavior patterns including event breakdowns, platform distribution, and temporal patterns.

**Authentication:** ⚠️ Check service config  
**Query Parameters:**
- `timeframe` (optional): `7d` | `30d` (default: `7d`)
- `eventType` (optional): String (filter by specific event type)

**Request:**
```powershell
# User behavior for last 7 days
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/user-behavior?timeframe=7d" -Method GET

# User behavior for last 30 days
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/user-behavior?timeframe=30d" -Method GET
```

**Expected Response:**
```json
{
  "overview": {
    "totalEvents": 125000,
    "uniqueUsers": 450,
    "avgEventsPerUser": 277.8,
    "topEventType": "message_sent"
  },
  "eventBreakdown": [
    {
      "eventName": "message_sent",
      "count": 45000
    },
    {
      "eventName": "match_created",
      "count": 25000
    }
  ],
  "platformBreakdown": [
    {
      "platform": "iOS",
      "count": 75000,
      "percentage": 60
    },
    {
      "platform": "Android",
      "count": 50000,
      "percentage": 40
    }
  ],
  "temporalPatterns": {
    "hourlyPattern": [
      {
        "hour": 20,
        "eventCount": 8500,
        "uniqueUsers": 320
      }
    ],
    "peakHour": {
      "hour": 20,
      "eventCount": 8500,
      "uniqueUsers": 320
    }
  },
  "insights": {
    "mostActiveHours": [20, 21, 19],
    "dominantPlatform": "iOS"
  }
}
```

**Testing Order:** Test this **SEVENTH**.

---

### 8. Get Conversion Funnel

**Endpoint:** `GET /kpis/kpis/funnel`

**Description:** Returns conversion funnel analysis showing user journey from app open to subscription purchase with drop-off rates.

**Authentication:** ⚠️ Check service config  
**Query Parameters:**
- `timeframe` (optional): `30d` | `7d` | `90d` (default: `30d`)

**Request:**
```powershell
# Conversion funnel for last 30 days
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/funnel?timeframe=30d" -Method GET

# Conversion funnel for last 7 days
Invoke-RestMethod -Uri "http://localhost:3008/kpis/kpis/funnel?timeframe=7d" -Method GET
```

**Expected Response:**
```json
{
  "funnel": [
    {
      "step": "app_open",
      "averageUsers": 1000,
      "averageConverted": 800,
      "conversionRate": 80.0,
      "dropOffCount": 200
    },
    {
      "step": "registration_complete",
      "averageUsers": 600,
      "averageConverted": 500,
      "conversionRate": 83.3,
      "dropOffCount": 100
    },
    {
      "step": "subscription_purchase",
      "averageUsers": 150,
      "averageConverted": 150,
      "conversionRate": 100.0,
      "dropOffCount": 0
    }
  ],
  "stepConversions": [
    {
      "fromStep": "app_open",
      "toStep": "registration_complete",
      "conversionRate": 60.0,
      "dropOffRate": 40.0
    }
  ],
  "insights": {
    "biggestDropOff": {
      "fromStep": "app_open",
      "toStep": "registration_complete",
      "dropOffRate": 40.0
    },
    "overallConversionRate": 15.0,
    "totalUsers": 1000,
    "finalConversions": 150
  }
}
```

**Testing Order:** Test this **EIGHTH**.

---

### 9. Clear Cache

**Endpoint:** `DELETE /kpis/cache/:key?`

**Description:** Clears analytics cache. If key is provided, clears specific cache entry. If no key, clears all cache.

**Authentication:** ⚠️ Check service config  
**Path Parameters:**
- `key` (optional): Cache key to clear (e.g., `kpis_overview`, `revenue_30d`)

**Request:**
```powershell
# Clear specific cache key
Invoke-RestMethod -Uri "http://localhost:3008/kpis/cache/kpis_overview" -Method DELETE

# Clear all cache
Invoke-RestMethod -Uri "http://localhost:3008/kpis/cache" -Method DELETE
```

**Expected Response:**
```json
{
  "message": "Cache key 'kpis_overview' cleared"
}
```

or

```json
{
  "message": "All cache cleared"
}
```

**Testing Order:** Test this **NINTH** (optional - for cache management).

---

### 10. Get Cache Statistics

**Endpoint:** `GET /kpis/cache/stats`

**Description:** Returns cache statistics including hit/miss rates and cache size.

**Authentication:** ⚠️ Check service config

**Request:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3008/kpis/cache/stats" -Method GET
```

**Expected Response:**
```json
{
  "hits": 1250,
  "misses": 150,
  "keys": 8,
  "ksize": 1024,
  "vsize": 51200,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Testing Order:** Test this **TENTH** (optional - for monitoring).

---

## Testing Checklist

- [ ] **Step 1:** Login as admin and get JWT token
- [ ] **Step 2:** Test Admin Service Dashboard endpoint (`/api/analytics/dashboard`)
- [ ] **Step 3:** Test Admin Service User Growth endpoint (`/api/analytics/users/growth`)
- [ ] **Step 4:** Test Analytics Service KPI Overview (`/kpis/kpis/overview`)
- [ ] **Step 5:** Test Active Users endpoint with different granularities
- [ ] **Step 6:** Test Retention Cohorts endpoint
- [ ] **Step 7:** Test Revenue Analytics endpoint
- [ ] **Step 8:** Test User Behavior endpoint
- [ ] **Step 9:** Test Conversion Funnel endpoint
- [ ] **Step 10:** Test Cache Management endpoints (optional)

---

## Common Issues & Troubleshooting

1. **401 Unauthorized:** Make sure you've logged in and are using the correct JWT token in Authorization header
2. **Empty Data:** Check if analytics database has data. Metrics are aggregated from other services
3. **Connection Errors:** Ensure both Admin Service (port 3009) and Analytics Service (port 3008) are running
4. **Cache Issues:** Use cache clear endpoint if you suspect stale data
5. **Missing Permissions:** Ensure admin account has `analytics.read` permission

---

## Notes

- Analytics Service endpoints may not require authentication in development, but should in production
- All metrics are cached for 5-10 minutes to improve performance
- Some endpoints return placeholder data until full integration with other services is complete
- User growth endpoint in Admin Service needs integration with user-service API

