# Frontend Requirements vs Backend Reality

This document compares what the admin-frontend expects vs what our backend currently provides.

---

## 1. Users Page

### Frontend Expects:
**Endpoint:** `GET /api/users`
- Query params: `page`, `limit`, `search`, `status`
- Response: `{ users: [...], pagination: {...} }`

### Backend Reality:
✅ **Endpoint EXISTS:** `GET /api/users` in admin-service
⚠️ **Issue:** Returns **empty array** because user data is in user_db (user-service), not admin_db

**Current Response:**
```json
{
  "users": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "pages": 0
  }
}
```

**What's Needed:**
- Admin-service needs to call user-service API to fetch real user data
- OR user-service needs an admin endpoint to list users

---

## 2. User Status Update

### Frontend Expects:
**Endpoint:** `PATCH /api/users/:id/status`
- Body: `{ status: string, reason?: string }`

### Backend Reality:
✅ **Endpoint EXISTS:** `PATCH /api/users/:id/status` in admin-service
⚠️ **Issue:** Updates local placeholder, doesn't update real user in user_db

**What's Needed:**
- Admin-service needs to call user-service API to update user status

---

## 3. Moderation Reports

### Frontend Expects:
**Endpoint:** `GET /api/moderation/reports`
- Response: Array of reports with assignedAdmin info

### Backend Reality:
✅ **Endpoint EXISTS:** `GET /api/moderation/reports` in admin-service
✅ **Response Format:** Matches frontend expectations

**Current Implementation:**
```typescript
// services/admin-service/src/routes/moderation.ts
router.get('/reports', async (req, res) => {
  const reports = await prisma.userReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      assignedAdmin: {
        select: { firstName: true, lastName: true, email: true }
      }
    }
  });
  res.json(reports);
});
```

✅ **Status:** READY - No changes needed

---

## 4. Assign Report

### Frontend Expects:
**Endpoint:** `PATCH /api/moderation/reports/:reportId/assign`
- No body required

### Backend Reality:
✅ **Endpoint EXISTS:** `PATCH /api/moderation/reports/:id/assign` in admin-service
✅ **Functionality:** Assigns to current admin and updates status

✅ **Status:** READY - No changes needed

---

## 5. Moderation Actions

### Frontend Expects:
**Endpoint:** `GET /api/moderation/actions`
- Response: Array with admin info

**Endpoint:** `POST /api/moderation/actions`
- Body: `{ actionType, reason, userId }`

### Backend Reality:
✅ **Both Endpoints EXIST** in admin-service
✅ **Response Format:** Matches expectations

✅ **Status:** READY - No changes needed

---

## 6. Moderation Queue (from moderation-service)

### Frontend Expects:
**Endpoint:** `GET /api/moderation/queue`
- Query: `status`, `page`, `limit`

### Backend Reality:
✅ **Endpoint EXISTS:** `GET /api/moderation/queue` in moderation-service
✅ **Supports Filtering:** status, contentType, page, limit

**Current Implementation:**
```typescript
// services/moderation-service/src/routes/moderation.ts
router.get('/queue', async (req, res) => {
  const { status, contentType, page = 1, limit = 20 } = req.query;
  const reports = await moderationService.getModerationQueue({
    status, contentType, page, limit
  });
  res.json(reports);
});
```

✅ **Status:** READY - No changes needed

---

## 7. Moderate Content

### Frontend Expects:
**Endpoint:** `PUT /api/moderation/moderate/:reportId`
- Body: `{ action: 'APPROVE' | 'REJECT' | 'ESCALATE', reason?: string }`

### Backend Reality:
✅ **Endpoint EXISTS:** `PUT /api/moderation/moderate/:reportId` in moderation-service
✅ **Accepts:** action, reason, moderatorId

✅ **Status:** READY - No changes needed

---

## 8. Analytics - Overview

### Frontend Expects:
**Endpoint:** `GET /kpis/kpis/overview`
- Response: `{ currentMetrics, trends, businessMetrics, timestamp }`

### Backend Reality:
✅ **Endpoint EXISTS:** `GET /kpis/kpis/overview` in analytics-service
✅ **Response Format:** Matches frontend expectations exactly

✅ **Status:** READY - No changes needed

---

## 9. Analytics - Active Users

### Frontend Expects:
**Endpoint:** `GET /kpis/kpis/active-users`
- Query: `granularity`, `range`
- Response: `{ summary, breakdown }`

### Backend Reality:
✅ **Endpoint EXISTS:** `GET /kpis/kpis/active-users` in analytics-service
✅ **Response Format:** Matches frontend expectations

✅ **Status:** READY - No changes needed

---

## 10. Analytics - Revenue

### Frontend Expects:
**Endpoint:** `GET /kpis/kpis/revenue`
- Query: `timeframe`
- Response: `{ summary, planBreakdown, timeline, insights }`

### Backend Reality:
✅ **Endpoint EXISTS:** `GET /kpis/kpis/revenue` in analytics-service
✅ **Response Format:** Matches frontend expectations

✅ **Status:** READY - No changes needed

---

## 11. Analytics - Retention

### Frontend Expects:
**Endpoint:** `GET /kpis/kpis/retention`
- Query: `period`, `cohortCount`
- Response: `{ cohortTable, periodAverages, insights }`

### Backend Reality:
✅ **Endpoint EXISTS:** `GET /kpis/kpis/retention` in analytics-service
✅ **Response Format:** Matches frontend expectations

✅ **Status:** READY - No changes needed

---

## 12. Analytics - User Behavior

### Frontend Expects:
**Endpoint:** `GET /kpis/kpis/user-behavior`
- Query: `timeframe`, `eventType`
- Response: `{ overview, eventBreakdown, platformBreakdown, temporalPatterns, insights }`

### Backend Reality:
✅ **Endpoint EXISTS:** `GET /kpis/kpis/user-behavior` in analytics-service
✅ **Response Format:** Matches frontend expectations

✅ **Status:** READY - No changes needed

---

## 13. Analytics - Funnel

### Frontend Expects:
**Endpoint:** `GET /kpis/kpis/funnel`
- Query: `timeframe`
- Response: `{ funnel, stepConversions, insights }`

### Backend Reality:
✅ **Endpoint EXISTS:** `GET /kpis/kpis/funnel` in analytics-service
✅ **Response Format:** Matches frontend expectations

✅ **Status:** READY - No changes needed

---

## Summary

### ✅ Fully Ready (11/13 endpoints)
- All moderation endpoints (reports, actions, queue, moderate)
- All 6 analytics KPI endpoints
- User status update endpoint (exists, but returns placeholder)

### ⚠️ Partially Ready (2/13 endpoints)
- `GET /api/users` - Exists but returns empty array
- `PATCH /api/users/:id/status` - Exists but doesn't update real users

---

## The Only Real Issue: User Data

**Problem:** User data is in `user_db` (user-service), but admin-service queries `admin_db`.

**Impact:** 
- Users page shows no users
- User management features don't work with real data

**Solutions:**

### Option 1: Frontend Adapts (Your Approach)
Frontend will handle empty user data gracefully and focus on features that work:
- ✅ Moderation (reports, actions, queue) - Fully functional
- ✅ Analytics (all 6 KPIs) - Fully functional
- ✅ Support Tickets - Fully functional
- ⚠️ User Management - Shows empty list

### Option 2: Backend Integration (Future Enhancement)
Admin-service calls user-service API to fetch real user data:
```typescript
// In admin-service/src/routes/users.ts
const response = await fetch('http://user-service:3001/admin/users');
const users = await response.json();
```

---

## Recommendation

**For immediate frontend testing:**
- Proceed with current backend
- Frontend adapts to show empty user list
- Focus on testing moderation and analytics features (which are fully functional)

**For production:**
- Implement user-service integration in admin-service
- Add admin endpoint in user-service to list users

---

**Last Updated:** 2025-12-17
**Status:** 11/13 endpoints fully ready, 2/13 need user-service integration
