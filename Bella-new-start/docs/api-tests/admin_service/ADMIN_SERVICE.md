# Admin Service API Testing Guide

**Base URL:** `http://localhost:3009`  
**Container Port:** 3009 (internal) → 3009 (host)

---

## What is the Admin Service?

The **Admin Service** is the administrative control panel for the Kindred app. It's responsible for:

- **Admin Management:** Create and manage admin accounts with role-based access control (RBAC)
- **User Moderation:** Review and moderate user reports, ban/suspend users
- **Content Moderation:** Review flagged content, conversations, and profiles
- **Customer Support:** Ticket management system with SLA tracking
- **Knowledge Base:** Create and manage help articles for users
- **System Settings:** Configure app-wide settings and features
- **Analytics Dashboard:** View platform metrics and admin performance
- **Audit Logging:** Track all admin actions for compliance

**Why it's important:** Without this service, there's no way to moderate content, handle user reports, manage customer support tickets, or configure the platform. It's the control center for platform operations and safety.

**How it works:**
1. Admins log in with email/password (JWT authentication)
2. Role-based permissions control what each admin can do
3. Admins can review user reports, moderate content, and manage tickets
4. All admin actions are logged for audit trails
5. Support tickets are tracked with SLA metrics
6. Knowledge base articles help users self-serve

---

## Prerequisites

1. **PostgreSQL** must be running (admin_db database)
2. **Redis** must be running (for caching and sessions)
3. **User Service** should be running (for user data lookups)
4. **Create first admin account** - See "Creating First Admin" section below

---

## Admin Roles & Permissions

```
SUPER_ADMIN  → Full access to everything
ADMIN        → Most features except system settings
MODERATOR    → Content moderation and user reports only
SUPPORT      → Customer support tickets and knowledge base only
```

---

## Creating First Admin Account

**✅ ALREADY DONE! Default admin account has been created:**

- **Email:** `ogollachucho@gmail.com`
- **Password:** `123456789`
- **Role:** `SUPER_ADMIN`

You can now login and start testing!

---

## Authentication & Testing

### Step 1: Login

```powershell
# Login to get JWT token
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

### Step 2: Use Token in Requests

All protected endpoints require the JWT token in the Authorization header:

```powershell
# Example: Get all support tickets
Invoke-RestMethod -Uri "http://localhost:3009/api/support-tickets" -Headers $headers
cd services/admin-service

# Run the seed script
npm run prisma:seed
```

This creates an admin with:
- **Email:** `ogollachucho@gmail.com`
- **Password:** `123456789`
- **Role:** `SUPER_ADMIN`

### Method 2: Custom Admin via Environment Variables

```powershell
cd services/admin-service

# Set custom credentials
$env:ADMIN_SEED_EMAIL="admin@kindred.com"
$env:ADMIN_SEED_PASSWORD="Admin123!@#"
$env:ADMIN_SEED_FIRST_NAME="Super"
$env:ADMIN_SEED_LAST_NAME="Admin"

# Run seed
npm run prisma:seed
```

### Method 3: Direct Database Insert

```sql
-- Connect to admin_db
\c admin_db

-- Create first super admin
INSERT INTO admins (id, email, "passwordHash", "firstName", "lastName", role, "isActive", "createdAt", "updatedAt")
VALUES (
  'admin_' || gen_random_uuid()::text,
  'admin@kindred.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEgKK3q',
  'Super',
  'Admin',
  'SUPER_ADMIN',
  true,
  NOW(),
  NOW()
);
```

Password for the hash above: `Admin123!@#`

---

## Testing Order

### Step 1: Health Check

```http
GET http://localhost:3009/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "admin-service",
  "timestamp": "2025-12-17T..."
}
```

---

### Step 2: Admin Login

**Note:** Use the credentials from the admin you created in the "Creating First Admin Account" section above.

```http
POST http://localhost:3009/api/auth/login
Content-Type: application/json

{
  "email": "ogollachucho@gmail.com",
  "password": "123456789"
}
```

Or if you used custom credentials:

```http
POST http://localhost:3009/api/auth/login
Content-Type: application/json

{
  "email": "admin@kindred.com",
  "password": "Admin123!@#"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "admin_xxx",
      "email": "admin@kindred.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "SUPER_ADMIN",
      "permissions": ["ALL"]
    }
  }
}
```

**Note:** Save the token - you'll need it for all subsequent requests as `Authorization: Bearer TOKEN`

---

### Step 3: Create Admin Account (Super Admin Only)

```http
POST http://localhost:3009/api/auth/register
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "email": "moderator@kindred.com",
  "password": "Moderator123!@#",
  "firstName": "John",
  "lastName": "Moderator",
  "role": "MODERATOR"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Admin account created successfully",
  "data": {
    "id": "admin_xxx",
    "email": "moderator@kindred.com",
    "role": "MODERATOR"
  }
}
```

**Roles:** `SUPER_ADMIN`, `ADMIN`, `MODERATOR`, `SUPPORT`

---

### Step 4: Get All User Reports

```http
GET http://localhost:3009/api/moderation/reports?status=PENDING&limit=20
Authorization: Bearer YOUR_TOKEN
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "reports": [
      {
        "id": "report_xxx",
        "reporterUserId": "user1_id",
        "reportedUserId": "user2_id",
        "reportType": "HARASSMENT",
        "reason": "Inappropriate messages",
        "description": "User sent offensive messages",
        "status": "PENDING",
        "priority": "HIGH",
        "createdAt": "2025-12-17T..."
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

**Report Types:**
- `INAPPROPRIATE_BEHAVIOR`
- `HARASSMENT`
- `FAKE_PROFILE`
- `SPAM`
- `UNDERAGE`
- `VIOLENCE_THREAT`
- `SEXUAL_CONTENT`
- `HATE_SPEECH`
- `OTHER`

**Status:** `PENDING`, `IN_REVIEW`, `RESOLVED`, `DISMISSED`, `ESCALATED`

---

### Step 5: Review and Take Action on Report

```http
PUT http://localhost:3009/api/moderation/reports/REPORT_ID/action
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "action": "BAN",
  "reason": "Confirmed harassment violation",
  "severity": "HIGH",
  "details": {
    "banDuration": "30_DAYS",
    "notifyUser": true
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Moderation action completed",
  "data": {
    "reportId": "report_xxx",
    "action": "BAN",
    "targetUserId": "user2_id",
    "actionId": "action_xxx"
  }
}
```

**Actions:** `WARN`, `SUSPEND`, `BAN`, `DELETE`, `APPROVE`, `REJECT`, `REVIEW`  
**Severity:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

---

### Step 6: Get All Support Tickets

```http
GET http://localhost:3009/api/support-tickets?status=OPEN&priority=HIGH&limit=20
Authorization: Bearer YOUR_TOKEN
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "tickets": [
      {
        "id": "ticket_xxx",
        "ticketNumber": "TKT-2025-001",
        "subject": "Cannot send messages",
        "category": "TECHNICAL",
        "priority": "HIGH",
        "status": "OPEN",
        "customerId": "user_xxx",
        "customerEmail": "user@example.com",
        "assignedAdminId": null,
        "createdAt": "2025-12-17T..."
      }
    ],
    "total": 8,
    "page": 1
  }
}
```

**Categories:** `TECHNICAL`, `BILLING`, `ACCOUNT`, `SAFETY`, `GENERAL`, `BUG_REPORT`, `FEATURE_REQUEST`  
**Priority:** `LOW`, `MEDIUM`, `HIGH`, `URGENT`  
**Status:** `OPEN`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`, `RESOLVED`, `CLOSED`

---

### Step 7: Assign Ticket to Self

```http
PUT http://localhost:3009/api/support-tickets/TICKET_ID/assign
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "assignToSelf": true
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Ticket assigned successfully",
  "data": {
    "ticketId": "ticket_xxx",
    "assignedAdminId": "admin_xxx"
  }
}
```

---

### Step 8: Add Comment to Ticket

```http
POST http://localhost:3009/api/support-tickets/TICKET_ID/comments
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "content": "I've reviewed your issue. Please try clearing your cache and restarting the app.",
  "isInternal": false
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "commentId": "comment_xxx",
    "ticketId": "ticket_xxx",
    "content": "I've reviewed your issue...",
    "isInternal": false,
    "createdAt": "2025-12-17T..."
  }
}
```

**isInternal:** `true` = only admins see it, `false` = customer sees it

---

### Step 9: Resolve Ticket

```http
PUT http://localhost:3009/api/support-tickets/TICKET_ID/resolve
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "resolution": "Issue resolved by clearing cache. User confirmed it's working now.",
  "status": "RESOLVED"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Ticket resolved successfully",
  "data": {
    "ticketId": "ticket_xxx",
    "status": "RESOLVED",
    "resolvedAt": "2025-12-17T...",
    "resolutionTimeHours": 2.5
  }
}
```

---

### Step 10: Create Knowledge Base Article

```http
POST http://localhost:3009/api/knowledge-base/articles
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "title": "How to Reset Your Password",
  "content": "# Password Reset Guide\n\n1. Go to login page\n2. Click 'Forgot Password'\n3. Enter your email...",
  "summary": "Step-by-step guide to reset your password",
  "category": "ACCOUNT",
  "tags": ["password", "login", "account"],
  "searchKeywords": ["reset password", "forgot password", "can't login"],
  "isPublished": true
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "id": "article_xxx",
    "title": "How to Reset Your Password",
    "slug": "how-to-reset-your-password",
    "category": "ACCOUNT",
    "isPublished": true,
    "authorId": "admin_xxx",
    "createdAt": "2025-12-17T..."
  }
}
```

---

### Step 11: Get Platform Analytics

```http
GET http://localhost:3009/api/analytics/dashboard?period=7d
Authorization: Bearer YOUR_TOKEN
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "users": {
      "total": 15420,
      "active": 8234,
      "newThisWeek": 342
    },
    "moderation": {
      "pendingReports": 23,
      "actionsThisWeek": 45,
      "bannedUsers": 12
    },
    "support": {
      "openTickets": 18,
      "avgResponseTime": 2.3,
      "avgResolutionTime": 12.5,
      "customerSatisfaction": 4.6
    },
    "engagement": {
      "activeConversations": 1234,
      "messagesPerDay": 45678,
      "matchesPerDay": 234
    }
  }
}
```

---

### Step 12: Update System Settings

```http
PUT http://localhost:3009/api/settings/SETTING_KEY
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "value": {
    "enabled": true,
    "maxDailyMatches": 10,
    "cooldownHours": 24
  },
  "description": "Matching system configuration"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Setting updated successfully",
  "data": {
    "key": "matching_config",
    "value": { "enabled": true, "maxDailyMatches": 10 },
    "updatedBy": "admin_xxx",
    "updatedAt": "2025-12-17T..."
  }
}
```

---

### Step 13: Get Admin Activity Logs

```http
GET http://localhost:3009/api/analytics/admin-logs?adminId=ADMIN_ID&limit=50
Authorization: Bearer YOUR_TOKEN
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "logs": [
      {
        "id": "log_xxx",
        "adminId": "admin_xxx",
        "action": "BAN_USER",
        "resource": "user_123",
        "details": {
          "reason": "Harassment",
          "duration": "30_DAYS"
        },
        "ipAddress": "192.168.1.1",
        "createdAt": "2025-12-17T..."
      }
    ],
    "total": 234
  }
}
```

---

## Quick PowerShell Test Script

```powershell
# 1. Health Check
Invoke-RestMethod -Uri "http://localhost:3009/health"

# 2. Admin Login
$login = @{
  email = "admin@kindred.com"
  password = "Admin123!@#"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3009/api/auth/login" -Method POST -Body $login -ContentType "application/json"
$token = $response.data.token

# 3. Get Pending Reports
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:3009/api/moderation/reports?status=PENDING" -Headers $headers

# 4. Get Open Support Tickets
Invoke-RestMethod -Uri "http://localhost:3009/api/support-tickets?status=OPEN" -Headers $headers

# 5. Get Platform Analytics
Invoke-RestMethod -Uri "http://localhost:3009/api/analytics/dashboard?period=7d" -Headers $headers

# 6. Create Knowledge Base Article
$article = @{
  title = "How to Report a User"
  content = "Step-by-step guide to report inappropriate behavior"
  category = "SAFETY"
  tags = @("report", "safety", "moderation")
  isPublished = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3009/api/knowledge-base/articles" -Method POST -Body $article -ContentType "application/json" -Headers $headers
```

---

## Common Issues

### 1. "Unauthorized" or "Invalid token"
- **Cause:** Token expired or not provided
- **Fix:** Login again to get a new token

### 2. "Insufficient permissions"
- **Cause:** Admin role doesn't have required permissions
- **Fix:** Use SUPER_ADMIN account or grant permissions

### 3. "Admin not found"
- **Cause:** No admin accounts exist
- **Fix:** Run seed script or create first admin via direct DB insert

### 4. "Database connection failed"
- **Cause:** PostgreSQL not running or wrong credentials
- **Fix:** Check docker-compose and DATABASE_URL

---

---

## Admin Endpoints Summary

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - Create admin (Super Admin only)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current admin info

### User Management
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id/status` - Update user status
- `DELETE /api/users/:id` - Delete user

### Moderation
- `GET /api/moderation/reports` - List reports
- `GET /api/moderation/reports/:id` - Get report details
- `PUT /api/moderation/reports/:id/action` - Take action on report
- `POST /api/moderation/actions` - Create moderation action
- `GET /api/moderation/actions` - List moderation actions

### Support Tickets
- `GET /api/support-tickets` - List tickets
- `POST /api/support-tickets` - Create ticket
- `GET /api/support-tickets/:id` - Get ticket details
- `PUT /api/support-tickets/:id/assign` - Assign ticket
- `POST /api/support-tickets/:id/comments` - Add comment
- `PUT /api/support-tickets/:id/resolve` - Resolve ticket
- `PUT /api/support-tickets/:id/escalate` - Escalate ticket

### Knowledge Base
- `GET /api/knowledge-base/articles` - List articles
- `POST /api/knowledge-base/articles` - Create article
- `GET /api/knowledge-base/articles/:id` - Get article
- `PUT /api/knowledge-base/articles/:id` - Update article
- `DELETE /api/knowledge-base/articles/:id` - Delete article
- `PUT /api/knowledge-base/articles/:id/publish` - Publish article

### Analytics
- `GET /api/analytics/dashboard` - Platform overview
- `GET /api/analytics/users` - User metrics
- `GET /api/analytics/moderation` - Moderation metrics
- `GET /api/analytics/support` - Support metrics
- `GET /api/analytics/admin-logs` - Admin activity logs

### Settings
- `GET /api/settings` - List all settings
- `GET /api/settings/:key` - Get specific setting
- `PUT /api/settings/:key` - Update setting
- `POST /api/settings` - Create new setting

---

## Best Practices

### ✅ DO:

1. **Always use HTTPS** in production
2. **Rotate JWT secrets** regularly
3. **Log all admin actions** for audit trails
4. **Use strong passwords** for admin accounts
5. **Implement 2FA** for admin logins (future enhancement)
6. **Review audit logs** regularly
7. **Set appropriate permissions** per role

### ❌ DON'T:

1. **Don't share admin credentials**
2. **Don't use weak passwords**
3. **Don't give SUPER_ADMIN** to everyone
4. **Don't skip audit logging**
5. **Don't expose admin endpoints** publicly without auth
6. **Don't delete audit logs**

---

## Summary

The Admin Service provides:

✅ **Role-based access control** - Different permissions for different admin roles
✅ **User moderation** - Handle reports and take action on violations
✅ **Support ticket system** - Manage customer support with SLA tracking
✅ **Knowledge base** - Self-service help articles for users
✅ **Analytics dashboard** - Platform metrics and insights
✅ **Audit logging** - Track all admin actions for compliance
✅ **System configuration** - Manage app-wide settings

This is the **control center** for platform operations, safety, and customer support.
