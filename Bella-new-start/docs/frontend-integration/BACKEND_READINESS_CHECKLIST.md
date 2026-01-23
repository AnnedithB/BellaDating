# Backend Readiness Checklist for Admin Frontend Integration

This document tracks what needs to be done to make the backend fully compatible with the `admin-frontend` Next.js application.

---

## Current Status Summary

### ✅ What's Already Working

1. **Services Running:**
   - ✅ Admin Service (port 3009)
   - ✅ Moderation Service (port 3007)
   - ✅ Analytics Service (port 3008)

2. **CORS Configuration:**
   - ✅ Admin Service: Configured for `http://localhost:3000`
   - ✅ Moderation Service: Configured with allowed origins
   - ⚠️ Analytics Service: Uses `cors()` without origin restriction (needs fixing)

3. **Health Endpoints:**
   - ✅ All services have `/health` endpoints

4. **Authentication:**
   - ✅ `POST /api/auth/login` exists and returns `{ token, admin }`
   - ✅ JWT token validation in place
   - ✅ Returns 401 for invalid tokens

---

## 🔧 Required Fixes

### 1. Analytics Service CORS (HIGH PRIORITY)

**Issue:** Analytics service uses `cors()` without origin restriction.

**Fix Required:**
```typescript
// services/analytics-service/src/index.ts
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

### 2. Admin Service - User Endpoints (HIGH PRIORITY)

**Status:** Currently returns placeholder data or 501 errors.

**Required Endpoints:**
- ✅ `GET /api/users` - Exists but needs user-service integration
- ✅ `GET /api/users/:id` - Exists but needs user-service integration
- ✅ `PATCH /api/users/:id/status` - Exists but needs user-service integration

**Action Required:**
- Integrate with user-service API to fetch real user data
- Remove TODOs and implement actual API calls
- Test with real data

**Files to Update:**
- `services/admin-service/src/routes/users.ts`

---

### 3. Admin Service - Moderation Endpoints (MEDIUM PRIORITY)

**Required Endpoints:**
- ❓ `GET /api/moderation/reports` - Need to verify implementation
- ❓ `PATCH /api/moderation/reports/:reportId/assign` - Need to verify
- ❓ `GET /api/moderation/actions` - Need to verify
- ❓ `POST /api/moderation/actions` - Need to verify

**Action Required:**
- Check `services/admin-service/src/routes/moderation.ts`
- Ensure all endpoints match frontend contract
- Verify response shapes match frontend expectations

---

### 4. Admin Service - Analytics Dashboard (HIGH PRIORITY)

**Status:** Partially implemented with TODOs.

**Required Endpoints:**
- ⚠️ `GET /api/analytics/dashboard` - Returns placeholder data (user counts = 0)
- ⚠️ `GET /api/analytics/users/growth` - Returns empty array

**Action Required:**
- Integrate with user-service API for user statistics
- Implement real analytics calculations
- Remove placeholder data

**Files to Update:**
- `services/admin-service/src/routes/analytics.ts`
- `services/admin-service/src/routes/analytics.v2.ts`

---

### 5. Moderation Service - Queue Endpoints (VERIFY)

**Required Endpoints:**
- ✅ `GET /api/moderation/queue` - Exists
- ✅ `PUT /api/moderation/moderate/:reportId` - Exists

**Action Required:**
- Verify response shapes match frontend expectations
- Test with actual data
- Ensure proper error handling

---

### 6. Analytics Service - KPI Endpoints (VERIFY)

**Required Endpoints:**
- ❓ `GET /kpis/kpis/overview`
- ❓ `GET /kpis/kpis/active-users`
- ❓ `GET /kpis/kpis/revenue`
- ❓ `GET /kpis/kpis/retention`
- ❓ `GET /kpis/kpis/user-behavior`
- ❓ `GET /kpis/kpis/funnel`

**Action Required:**
- Check `services/analytics-service/src/routes/analytics-new.ts`
- Verify all endpoints exist
- Ensure response shapes match frontend contract

---

## 📋 Detailed Action Items

### Priority 1: Critical for Basic Functionality

1. **Fix Analytics Service CORS**
   - File: `services/analytics-service/src/index.ts`
   - Add proper origin restriction
   - Rebuild and restart container

2. **Implement User-Service Integration in Admin Service**
   - Files: 
     - `services/admin-service/src/routes/users.ts`
     - `services/admin-service/src/routes/analytics.ts`
     - `services/admin-service/src/routes/analytics.v2.ts`
   - Create HTTP client to call user-service API
   - Replace placeholder data with real API calls
   - Handle errors properly

3. **Verify Support Ticket Endpoints**
   - File: `services/admin-service/src/routes/support-tickets.ts`
   - Test all CRUD operations
   - Verify response shapes
   - Test metrics endpoint

### Priority 2: Important for Full Functionality

4. **Verify Moderation Endpoints in Admin Service**
   - File: `services/admin-service/src/routes/moderation.ts`
   - Ensure all required endpoints exist
   - Match response shapes to frontend contract

5. **Verify Analytics KPI Endpoints**
   - File: `services/analytics-service/src/routes/analytics-new.ts`
   - Ensure all 6 KPI endpoints exist
   - Test with real data

6. **Test Moderation Queue**
   - File: `services/moderation-service/src/routes/moderation.ts`
   - Verify queue filtering works
   - Test moderation actions

### Priority 3: Nice to Have

7. **Add Request Validation**
   - Add input validation for all endpoints
   - Return proper 400 errors for invalid input

8. **Improve Error Messages**
   - Standardize error response format
   - Add helpful error messages

9. **Add Rate Limiting Headers**
   - Return rate limit info in headers
   - Help frontend handle rate limits

---

## 🧪 Testing Checklist

Before connecting frontend, test each endpoint:

### Admin Service (port 3009)
```bash
# Login
curl -X POST http://localhost:3009/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ogollachucho@gmail.com","password":"123456789"}'

# Get users (with token)
curl http://localhost:3009/api/users \
  -H "Authorization: Bearer <token>"

# Get dashboard analytics
curl http://localhost:3009/api/analytics/dashboard \
  -H "Authorization: Bearer <token>"

# Get support tickets
curl http://localhost:3009/api/support-tickets \
  -H "Authorization: Bearer <token>"
```

### Moderation Service (port 3007)
```bash
# Get moderation queue
curl http://localhost:3007/api/moderation/queue \
  -H "Authorization: Bearer <token>"
```

### Analytics Service (port 3008)
```bash
# Get KPI overview
curl http://localhost:3008/kpis/kpis/overview \
  -H "Authorization: Bearer <token>"
```

---

## 📝 Frontend Environment Variables

Once backend is ready, frontend needs:

```env
NEXT_PUBLIC_ADMIN_SERVICE_URL=http://localhost:3009
NEXT_PUBLIC_MODERATION_SERVICE_URL=http://localhost:3007
NEXT_PUBLIC_ANALYTICS_SERVICE_URL=http://localhost:3008
```

---

## 🚀 Deployment Checklist

Before going to production:

- [ ] All endpoints tested and working
- [ ] CORS configured for production frontend URL
- [ ] Rate limiting configured appropriately
- [ ] Error handling tested
- [ ] Authentication working correctly
- [ ] All services healthy and stable
- [ ] Database migrations applied
- [ ] Environment variables set correctly

---

## 📚 Related Documentation

- Frontend Contract: `BACKEND_CONTRACT.md` (in frontend repo)
- Admin Service API: `docs/api-tests/admin-service/ADMIN_SERVICE.md`
- Service Architecture: `docs/architecture/DATABASE_RELATIONSHIPS.md`
