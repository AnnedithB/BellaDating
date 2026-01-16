# Quick API Testing Guide

## Testing Order & Dependencies

Services should be tested in this order due to dependencies:

1. **User Service** (3001) - Base authentication
2. **Queuing Service** (3002) - Matching system
3. **Interaction Service** (3003) - Call interactions
4. **History Service** (3004) - Session tracking
5. **Notification Service** (3006) - Push notifications
6. **Moderation Service** (3007) - Content moderation
7. **Subscription Service** (3010) - Premium features

---

## 1. User Service (Port 3001)

### Step 1: Health Check
```
GET http://localhost:3001/health
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "service": "user-service",
    "version": "1.0.0",
    "status": "healthy"
  }
}
```

### Step 2: Register User
```
POST http://localhost:3001/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test123!@#",
  "username": "testuser",
  "dateOfBirth": "1995-01-01"
}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "clx123abc...",
      "email": "test@example.com",
      "username": "testuser"
    }
  }
}
```

### Step 3: Login
```
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test123!@#"
}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clx123abc...",
      "email": "test@example.com",
      "username": "testuser"
    }
  }
}
```
**Save the token for subsequent requests!**

### Step 4: Get Profile
```
GET http://localhost:3001/api/users/profile
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "id": "clx123abc...",
    "email": "test@example.com",
    "username": "testuser",
    "profile": { ... }
  }
}
```

---

## 2. Queuing Service (Port 3002)

### Step 1: Health Check
```
GET http://localhost:3002/health
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "service": "queuing-service",
    "version": "1.0.0",
    "status": "healthy"
  }
}
```

### Step 2: Join Queue
```
POST http://localhost:3002/api/queue/join
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "clx123abc...",
  "preferences": {
    "ageRange": { "min": 18, "max": 35 },
    "interests": ["music", "sports"]
  }
}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "queueId": "queue123...",
    "position": 1,
    "estimatedWaitTime": 30
  }
}
```

### Step 3: Check Queue Status
```
GET http://localhost:3002/api/queue/status/{userId}
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "inQueue": true,
    "position": 1,
    "matchFound": false
  }
}
```

---

## 3. Interaction Service (Port 3003)

### Step 1: Health Check
```
GET http://localhost:3003/health
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "service": "interaction-service",
    "version": "1.0.0",
    "status": "healthy"
  }
}
```

### Step 2: Get User Interaction History
```
GET http://localhost:3003/api/interactions/user/{userId}?page=1&limit=10
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "interactions": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "pages": 0
    }
  }
}
```

### Step 3: Get Interaction Stats
```
GET http://localhost:3003/api/interactions/stats/overview
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "totalInteractions": 0,
    "completedInteractions": 0,
    "videoInteractions": 0,
    "completionRate": 0,
    "videoAdoptionRate": 0,
    "averageDuration": 0
  }
}
```

### Step 4: Get Interaction Details (if interaction exists)
```
GET http://localhost:3003/api/interactions/{interactionId}
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "id": "interaction123...",
    "roomId": "room123...",
    "status": "CONNECTED",
    "callType": "VIDEO",
    "startedAt": "2025-12-13T19:00:00.000Z",
    "callEvents": []
  }
}
```

### Step 5: Rate Interaction Quality
```
PATCH http://localhost:3003/api/interactions/{interactionId}/rating
Authorization: Bearer {token}
Content-Type: application/json

{
  "qualityRating": 5,
  "connectionIssues": false
}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "id": "interaction123...",
    "qualityRating": 5,
    "connectionIssues": false
  }
}
```

---

## 4. History Service (Port 3004)

### Step 1: Health Check
```
GET http://localhost:3004/health
```
**Expected Response:**
```json
{
  "status": "OK",
  "service": "history-service",
  "timestamp": "2025-12-13T19:00:00.000Z",
  "version": "1.0.0"
}
```

### Step 2: Get Session History
```
GET http://localhost:3004/api/history/sessions/{userId}?page=1&limit=10
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "sessions": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "pages": 0
    }
  }
}
```

### Step 3: Get User Analytics
```
GET http://localhost:3004/api/analytics/user/{userId}
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "clx123abc...",
    "totalSessions": 0,
    "totalDuration": 0,
    "avgSessionLength": 0,
    "completedSessions": 0,
    "skippedSessions": 0
  }
}
```

### Step 4: Get Chat Messages (if session exists)
```
GET http://localhost:3004/api/history/messages/{sessionId}
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "messages": [],
    "sessionId": "session123..."
  }
}
```

### Step 5: Submit Report
```
POST http://localhost:3004/api/reports
Authorization: Bearer {token}
Content-Type: application/json

{
  "reporterId": "clx123abc...",
  "reportedUserId": "clx456def...",
  "reportType": "INAPPROPRIATE_CONTENT",
  "reason": "Inappropriate behavior",
  "description": "User was being inappropriate during call"
}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "id": "report123...",
    "status": "PENDING",
    "severity": "MEDIUM",
    "createdAt": "2025-12-13T19:00:00.000Z"
  }
}
```

---

## 5. Notification Service (Port 3006)

### Step 1: Health Check
```
GET http://localhost:3006/health
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "service": "notification-service",
    "version": "1.0.0",
    "status": "healthy"
  }
}
```

### Step 2: Register Device Token
```
POST http://localhost:3006/api/notifications/register
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "clx123abc...",
  "deviceToken": "fcm-device-token-here",
  "platform": "android"
}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "id": "device123...",
    "userId": "clx123abc...",
    "platform": "android",
    "registered": true
  }
}
```

### Step 3: Get User Notifications
```
GET http://localhost:3006/api/notifications/user/{userId}?page=1&limit=20
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "notifications": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "pages": 0
    }
  }
}
```

### Step 4: Mark Notification as Read
```
PATCH http://localhost:3006/api/notifications/{notificationId}/read
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "id": "notification123...",
    "read": true,
    "readAt": "2025-12-13T19:00:00.000Z"
  }
}
```

---

## 6. Moderation Service (Port 3007)

### Step 1: Health Check
```
GET http://localhost:3007/health
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "service": "moderation-service",
    "version": "1.0.0",
    "status": "healthy"
  }
}
```

### Step 2: Moderate Text Content
```
POST http://localhost:3007/api/moderate/text
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "This is some text to moderate",
  "contentType": "text",
  "userId": "clx123abc..."
}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "approved": true,
    "toxicityScore": 0.02,
    "categories": {
      "toxic": false,
      "severe_toxic": false,
      "obscene": false,
      "threat": false,
      "insult": false,
      "identity_hate": false
    }
  }
}
```

### Step 3: Moderate Image
```
POST http://localhost:3007/api/moderate/image
Authorization: Bearer {token}
Content-Type: application/json

{
  "imageUrl": "https://example.com/image.jpg",
  "userId": "clx123abc..."
}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "approved": true,
    "labels": [],
    "moderationCategories": {
      "explicit": false,
      "suggestive": false,
      "violence": false,
      "visually_disturbing": false
    }
  }
}
```

### Step 4: Get Moderation History
```
GET http://localhost:3007/api/moderate/history/{userId}?page=1&limit=10
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "history": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "pages": 0
    }
  }
}
```

---

## 7. Subscription Service (Port 3010)

### Step 1: Health Check
```
GET http://localhost:3010/health
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "service": "subscription-service",
    "version": "1.0.0",
    "status": "healthy"
  }
}
```

### Step 2: Get Available Plans
```
GET http://localhost:3010/api/subscriptions/plans
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "plans": [
      {
        "id": "premium-monthly",
        "name": "Premium Monthly",
        "price": 9.99,
        "interval": "month",
        "features": ["unlimited_swipes", "video_calls", "no_ads"]
      }
    ]
  }
}
```

### Step 3: Get User Subscription
```
GET http://localhost:3010/api/subscriptions/user/{userId}
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "subscription": null,
    "tier": "free"
  }
}
```

### Step 4: Create Subscription
```
POST http://localhost:3010/api/subscriptions
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "clx123abc...",
  "planId": "premium-monthly",
  "paymentMethod": "stripe"
}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "id": "sub123...",
    "userId": "clx123abc...",
    "planId": "premium-monthly",
    "status": "active",
    "currentPeriodStart": "2025-12-13T19:00:00.000Z",
    "currentPeriodEnd": "2026-01-13T19:00:00.000Z"
  }
}
```

### Step 5: Check Feature Access
```
GET http://localhost:3010/api/subscriptions/user/{userId}/features/unlimited_swipes
Authorization: Bearer {token}
```
**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "hasAccess": false,
    "feature": "unlimited_swipes",
    "tier": "free"
  }
}
```

---

## Complete Test Flow

Follow this sequence for a complete end-to-end test:

1. **User Service**: Register → Login → Get Profile
2. **Subscription Service**: Get Plans → Check Current Subscription
3. **Queuing Service**: Join Queue → Check Status
4. **Notification Service**: Register Device → Get Notifications
5. **Interaction Service**: Get History → Get Stats
6. **History Service**: Get Sessions → Get Analytics
7. **Moderation Service**: Moderate Text → Get History

---

## Notes

- All authenticated endpoints require `Authorization: Bearer {token}` header
- Replace `{userId}`, `{interactionId}`, etc. with actual IDs from responses
- Empty arrays/null values are normal for new users with no activity
- Rate limiting: 1000 requests per 15 minutes per IP
- Health checks don't require authentication

---

## Common Response Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Missing or invalid token
- **404 Not Found**: Resource doesn't exist
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error (check logs)

---

## Troubleshooting

**401 Unauthorized**: Token expired or invalid - login again

**404 Not Found**: Resource doesn't exist yet (normal for new users)

**500 Internal Server Error**: Check service logs: `docker logs kindred-<service-name>`

**Connection Refused**: Service not running - check: `docker ps`
