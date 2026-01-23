# Moderation Endpoints Testing Guide

**Base URLs:**
- **Admin Service Moderation:** `http://localhost:3009`
- **Moderation Service:** `http://localhost:3007`

---

## What is the Moderation System?

The **Moderation System** is responsible for maintaining platform safety and content quality in the Kindred app. It consists of two main components:

1. **Admin Service Moderation** - Admin panel endpoints for viewing reports, assigning moderators, and tracking moderation actions
2. **Moderation Service** - Core moderation service handling content reports, moderation queue, and content moderation actions

**Purpose & Role:**
- **Content Safety:** Review and moderate user-reported content (profiles, messages, images)
- **User Reports:** Handle user reports about inappropriate behavior, harassment, spam, etc.
- **Moderation Queue:** Manage workflow for moderators to review pending content
- **Action Tracking:** Log all moderation actions (warnings, suspensions, bans) for audit trails
- **Assignment System:** Assign reports to specific admins/moderators for review
- **Appeals Process:** Handle user appeals for moderation actions

**Why it's important:** Moderation is critical for platform safety, user trust, and compliance. Without proper moderation, harmful content can spread, users can be harassed, and the platform can face legal issues. It ensures a safe and positive user experience.

**How it works:**
1. Users report content or other users through the app
2. Reports are stored and appear in the moderation queue
3. Admins/moderators review reports and assign them to team members
4. Moderators take actions (approve, reject, escalate, ban, suspend)
5. All actions are logged for audit and compliance
6. Users can appeal moderation decisions

---

## Prerequisites

1. **PostgreSQL** must be running (admin_db database for admin-service, moderation_db for moderation-service)
2. **Admin Service** must be running (port 3009)
3. **Moderation Service** must be running (port 3007)
4. **Admin Login Required** - You need to login as admin first to get JWT token
5. **User Service** should be running (for user data lookups)

---

## Testing Order & Authentication

### Step 1: Admin Login (REQUIRED FIRST)

**⚠️ IMPORTANT:** All moderation endpoints require authentication. You must login first to get a JWT token.

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

## Admin Service Moderation Endpoints

**Base URL:** `http://localhost:3009`  
**Authentication:** ✅ Required (Admin JWT Token)  
**Permissions:** Various (see each endpoint)

### 1. Get All Reports

**Endpoint:** `GET /api/moderation/reports`

**Description:** Returns all user reports with assigned admin information. Used by admin panel to display reports table.

**Authentication:** ✅ Required - Admin JWT Token  
**Permission:** `moderation.read`

**Request:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3009/api/moderation/reports" -Headers $headers -Method GET
```

**Expected Response:**
```json
[
  {
    "id": "report-001",
    "reportType": "INAPPROPRIATE_CONTENT",
    "status": "PENDING",
    "reportedUserId": "user-123",
    "reporterUserId": "user-456",
    "description": "User posted inappropriate content",
    "assignedAdmin": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

**Testing Order:** Test this **FIRST** after login - it's the main reports listing endpoint.

---

### 2. Assign Report to Admin

**Endpoint:** `PATCH /api/moderation/reports/:id/assign`

**Description:** Assigns a report to the currently logged-in admin and changes status to IN_REVIEW.

**Authentication:** ✅ Required - Admin JWT Token  
**Permission:** `moderation.assign`  
**Path Parameters:**
- `id` (required): UUID of the report

**Request:**
```powershell
# Replace {report-id} with actual report ID from step 1
Invoke-RestMethod -Uri "http://localhost:3009/api/moderation/reports/{report-id}/assign" -Headers $headers -Method PATCH
```

**Expected Response:**
```json
{
  "id": "report-001",
  "status": "IN_REVIEW",
  "assignedAdminId": "admin001",
  "assignedAdmin": {
    "firstName": "Super",
    "lastName": "Admin",
    "email": "ogollachucho@gmail.com"
  }
}
```

**Testing Order:** Test this **SECOND** - after getting reports list, assign one to yourself.

**Note:** The report ID must be a valid UUID. Get it from the reports list endpoint first.

---

### 3. Get All Moderation Actions

**Endpoint:** `GET /api/moderation/actions`

**Description:** Returns all moderation actions (bans, warnings, suspensions) with admin information who performed them.

**Authentication:** ✅ Required - Admin JWT Token  
**Permission:** `moderation.read`

**Request:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3009/api/moderation/actions" -Headers $headers -Method GET
```

**Expected Response:**
```json
[
  {
    "id": "action-001",
    "actionType": "BAN",
    "reason": "Repeated violations of community guidelines",
    "userId": "user-123",
    "admin": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "createdAt": "2024-01-15T09:00:00.000Z"
  },
  {
    "id": "action-002",
    "actionType": "WARN",
    "reason": "Inappropriate language",
    "userId": "user-456",
    "admin": {
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com"
    },
    "createdAt": "2024-01-14T15:30:00.000Z"
  }
]
```

**Testing Order:** Test this **THIRD** - view existing moderation actions.

---

### 4. Create Moderation Action

**Endpoint:** `POST /api/moderation/actions`

**Description:** Creates a new moderation action (ban, warn, or suspend) against a user. Automatically logs the action with the current admin.

**Authentication:** ✅ Required - Admin JWT Token  
**Permission:** `moderation.write`

**Request Body:**
```json
{
  "actionType": "BAN",
  "reason": "Violation of terms of service",
  "userId": "user-123"
}
```

**Valid actionType values:**
- `BAN` - Permanently ban user
- `WARN` - Issue warning to user
- `SUSPEND` - Temporarily suspend user

**Request:**
```powershell
$body = @{
    actionType = "BAN"
    reason = "Violation of terms of service"
    userId = "user-123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3009/api/moderation/actions" -Headers $headers -Method POST -Body $body -ContentType "application/json"
```

**Expected Response:**
```json
{
  "id": "action-003",
  "actionType": "BAN",
  "reason": "Violation of terms of service",
  "userId": "user-123",
  "adminId": "admin001",
  "createdAt": "2024-01-15T11:00:00.000Z"
}
```

**Testing Order:** Test this **FOURTH** - create a moderation action after viewing existing ones.

**Note:** The userId must be a valid UUID. Use a real user ID from your database.

---

## Moderation Service Endpoints

**Base URL:** `http://localhost:3007`  
**Authentication:** ✅ Required (JWT Token)  
**Note:** These endpoints use `authenticateToken` middleware - any valid JWT token should work.

### 5. Create Content Report

**Endpoint:** `POST /api/moderation/reports`

**Description:** Allows users to report content (profiles, messages, images) for moderation. This is typically called from the mobile app.

**Authentication:** ✅ Required - JWT Token (user token, not admin token)  
**Request Body:**
```json
{
  "contentId": "content-123",
  "contentType": "PROFILE",
  "reason": "INAPPROPRIATE_CONTENT",
  "description": "User has inappropriate profile picture"
}
```

**Valid contentType values:**
- `PROFILE` - User profile
- `MESSAGE` - Chat message
- `IMAGE` - Image content
- `VIDEO` - Video content

**Request:**
```powershell
# Note: This endpoint typically uses user JWT token, not admin token
# You may need to login as a regular user first
$userToken = "user-jwt-token-here"
$userHeaders = @{ Authorization = "Bearer $userToken" }

$body = @{
    contentId = "content-123"
    contentType = "PROFILE"
    reason = "INAPPROPRIATE_CONTENT"
    description = "User has inappropriate profile picture"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3007/api/moderation/reports" -Headers $userHeaders -Method POST -Body $body -ContentType "application/json"
```

**Expected Response:**
```json
{
  "id": "report-002",
  "contentId": "content-123",
  "contentType": "PROFILE",
  "reason": "INAPPROPRIATE_CONTENT",
  "description": "User has inappropriate profile picture",
  "reporterId": "user-456",
  "status": "PENDING",
  "createdAt": "2024-01-15T11:15:00.000Z"
}
```

**Testing Order:** Test this **FIFTH** - create a report (you may need a user token for this).

---

### 6. Get Moderation Queue

**Endpoint:** `GET /api/moderation/queue`

**Description:** Returns moderation queue with filtering options. Shows pending content that needs moderation review.

**Authentication:** ✅ Required - JWT Token  
**Query Parameters:**
- `status` (optional): Filter by status
- `contentType` (optional): Filter by content type
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Request:**
```powershell
# Get all pending reports
Invoke-RestMethod -Uri "http://localhost:3007/api/moderation/queue?status=PENDING" -Headers $headers -Method GET

# Get reports filtered by content type
Invoke-RestMethod -Uri "http://localhost:3007/api/moderation/queue?contentType=PROFILE&page=1&limit=20" -Headers $headers -Method GET
```

**Expected Response:**
```json
{
  "reports": [
    {
      "id": "report-001",
      "contentId": "content-123",
      "contentType": "PROFILE",
      "status": "PENDING",
      "reason": "INAPPROPRIATE_CONTENT",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

**Testing Order:** Test this **SIXTH** - view moderation queue after creating a report.

---

### 7. Moderate Content

**Endpoint:** `PUT /api/moderation/moderate/:reportId`

**Description:** Allows moderator to take action on a reported content item (approve, reject, or escalate).

**Authentication:** ✅ Required - JWT Token (moderator/admin token)  
**Path Parameters:**
- `reportId` (required): ID of the report to moderate

**Request Body:**
```json
{
  "action": "APPROVE",
  "reason": "Content is appropriate"
}
```

**Valid action values:**
- `APPROVE` - Content is fine, dismiss report
- `REJECT` - Content violates guidelines, take action
- `ESCALATE` - Needs higher-level review

**Request:**
```powershell
# Replace {report-id} with actual report ID
$body = @{
    action = "APPROVE"
    reason = "Content is appropriate and follows guidelines"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3007/api/moderation/moderate/{report-id}" -Headers $headers -Method PUT -Body $body -ContentType "application/json"
```

**Expected Response:**
```json
{
  "id": "report-001",
  "status": "RESOLVED",
  "action": "APPROVE",
  "reason": "Content is appropriate and follows guidelines",
  "moderatedBy": "admin001",
  "moderatedAt": "2024-01-15T11:30:00.000Z"
}
```

**Testing Order:** Test this **SEVENTH** - moderate a report from the queue.

**Note:** The reportId must be a valid report ID from the queue.

---

## Testing Checklist

- [ ] **Step 1:** Login as admin and get JWT token
- [ ] **Step 2:** Test Get All Reports endpoint (`GET /api/moderation/reports`)
- [ ] **Step 3:** Test Assign Report endpoint (`PATCH /api/moderation/reports/:id/assign`)
- [ ] **Step 4:** Test Get All Moderation Actions (`GET /api/moderation/actions`)
- [ ] **Step 5:** Test Create Moderation Action (`POST /api/moderation/actions`)
- [ ] **Step 6:** Test Create Content Report (`POST /api/moderation/reports`) - may need user token
- [ ] **Step 7:** Test Get Moderation Queue (`GET /api/moderation/queue`)
- [ ] **Step 8:** Test Moderate Content (`PUT /api/moderation/moderate/:reportId`)

---

## Permission Requirements Summary

| Endpoint | Service | Permission Required |
|----------|---------|-------------------|
| `GET /api/moderation/reports` | Admin Service | `moderation.read` |
| `PATCH /api/moderation/reports/:id/assign` | Admin Service | `moderation.assign` |
| `GET /api/moderation/actions` | Admin Service | `moderation.read` |
| `POST /api/moderation/actions` | Admin Service | `moderation.write` |
| `POST /api/moderation/reports` | Moderation Service | JWT Token (user) |
| `GET /api/moderation/queue` | Moderation Service | JWT Token |
| `PUT /api/moderation/moderate/:reportId` | Moderation Service | JWT Token (moderator/admin) |

---

## Common Issues & Troubleshooting

1. **401 Unauthorized:** 
   - Make sure you've logged in and are using the correct JWT token
   - Check if token has expired
   - Verify Authorization header format: `Bearer <token>`

2. **403 Forbidden:**
   - Check if your admin account has the required permissions
   - Verify role has `moderation.read`, `moderation.write`, or `moderation.assign` permissions

3. **400 Bad Request:**
   - Verify request body matches expected format
   - Check if actionType values are valid (`BAN`, `WARN`, `SUSPEND`)
   - Ensure UUIDs are valid format

4. **404 Not Found:**
   - Verify report ID or user ID exists in database
   - Check if endpoint URL is correct

5. **Empty Reports List:**
   - Reports may not exist yet - create a report first
   - Check database connection

6. **Moderation Service Connection Errors:**
   - Ensure Moderation Service is running on port 3007
   - Check service health endpoint: `GET http://localhost:3007/health`

---

## Notes

- Admin Service moderation endpoints require admin authentication and specific permissions
- Moderation Service endpoints accept any valid JWT token (user or admin)
- Report assignment automatically changes status to `IN_REVIEW`
- All moderation actions are logged for audit purposes
- User reports can be created by regular users, not just admins
- Moderation queue supports pagination for large datasets
- Content moderation actions (approve/reject/escalate) are separate from user moderation actions (ban/warn/suspend)

---

## Integration Notes

- Admin panel uses Admin Service endpoints for viewing and managing reports
- Mobile app uses Moderation Service endpoints for reporting content
- Both services may need to communicate with User Service for user data
- Moderation actions should trigger notifications to affected users
- Reports can be escalated to higher-level admins if needed

