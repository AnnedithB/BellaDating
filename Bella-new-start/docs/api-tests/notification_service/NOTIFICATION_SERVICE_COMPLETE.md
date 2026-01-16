# Notification Service API Testing Guide

**Base URL:** `http://localhost:3006`  
**Container Port:** 3006 (internal) → 3006 (host)

---

## What is the Notification Service?

The **Notification Service** handles all user notifications in the Kindred app. It's responsible for:

- **Push Notifications:** Sends notifications to user devices (iOS, Android, Web)
- **Device Management:** Registers and manages user device tokens
- **Notification Preferences:** Respects user settings (quiet hours, notification types)
- **Delivery Tracking:** Tracks if notifications were sent, delivered, and clicked
- **Templates:** Uses reusable templates for consistent messaging
- **Multi-Platform:** Supports Firebase (Android/Web) and APNs (iOS)

**Why it's important:** Keeps users engaged by notifying them about matches, messages, calls, and other important events. Without this service, users would miss critical updates and the app would feel disconnected.

**How it works:**
1. User registers their device token when they log in
2. Other services (chat, matching, etc.) request notifications via internal API
3. Notification service sends push notifications to user devices
4. Delivery status is tracked and analytics are collected
5. User preferences are respected (quiet hours, disabled types)

---

## Prerequisites

1. **User Service** must be running (for user authentication)
2. **Create test users** in user-service first
3. Get user IDs from user-service database
4. **Firebase/APNs** are optional (service works without them for testing)

---

## Testing Order

### Step 1: Health Check

```http
GET http://localhost:3006/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "notification-service",
  "version": "1.0.0"
}
```

---

### Step 2: Register Device Token

```http
POST http://localhost:3006/api/notifications/device-tokens
Content-Type: application/json

{
  "userId": "USER1_ID",
  "token": "device_token_abc123",
  "platform": "ANDROID",
  "appVersion": "1.0.0",
  "deviceModel": "Pixel 7",
  "osVersion": "Android 14"
}
```

**Where to get the device token:**
- **For Testing:** Use any random string like `"test_device_token_123"` or `"device_token_abc123"`
- **In Production:** 
  - **Android:** Firebase Cloud Messaging (FCM) provides the token when user installs the app
  - **iOS:** Apple Push Notification Service (APNs) provides the token
  - **Web:** Firebase generates token for web push notifications
- **For API Testing:** Just use a fake token - the service will accept it and store it

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "deviceTokenId": "device_token_id_xxx"
  }
}
```

**Platform Options:** `IOS`, `ANDROID`, `WEB`

---

### Step 3: Get User Notification Preferences

```http
GET http://localhost:3006/api/notifications/preferences/USER1_ID
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "USER1_ID",
    "globalEnabled": true,
    "newMatchEnabled": true,
    "newMessageEnabled": true,
    "callStartEnabled": true,
    "marketingEnabled": false,
    "quietHoursStart": null,
    "quietHoursEnd": null,
    "timezone": "UTC"
  }
}
```

---

### Step 4: Update Notification Preferences

```http
PUT http://localhost:3006/api/notifications/preferences/USER1_ID
Content-Type: application/json

{
  "globalEnabled": true,
  "newMatchEnabled": true,
  "newMessageEnabled": true,
  "callStartEnabled": true,
  "marketingEnabled": false,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00",
  "timezone": "America/New_York"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "USER1_ID",
    "globalEnabled": true,
    "newMatchEnabled": true,
    "newMessageEnabled": true,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00"
  }
}
```

**Notification Types:**
- `NEW_MATCH` - When matched with someone
- `NEW_MESSAGE` - New chat message received
- `CALL_STARTING` - Video call starting
- `CALL_MISSED` - Missed video call
- `MATCH_EXPIRED` - Match about to expire
- `PROFILE_VIEWED` - Someone viewed your profile
- `SUBSCRIPTION_EXPIRING` - Premium subscription ending

---

### Step 5: Send Notification

```http
POST http://localhost:3006/api/notifications/send
Content-Type: application/json

{
  "userId": "USER1_ID",
  "type": "NEW_MATCH",
  "payload": {
    "title": "New Match!",
    "body": "You matched with Sarah",
    "data": {
      "matchId": "match_123",
      "userId": "USER2_ID"
    }
  },
  "priority": "NORMAL"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "notificationId": "notif_xxx",
    "targetCount": 1,
    "scheduledFor": "immediate"
  }
}
```

**Priority Options:** `LOW`, `NORMAL`, `HIGH`, `CRITICAL`

---

### Step 6: Get Notification Status

```http
GET http://localhost:3006/api/notifications/NOTIFICATION_ID/status
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "notification": {
      "id": "notif_xxx",
      "type": "NEW_MATCH",
      "status": "SENT",
      "createdAt": "2025-12-15T...",
      "sentAt": "2025-12-15T...",
      "totalTargets": 1,
      "successfulSends": 1,
      "failedSends": 0
    },
    "deliveryStats": {
      "total": 1,
      "sent": 1,
      "delivered": 1,
      "failed": 0,
      "clicked": 0
    }
  }
}
```

---

### Step 7: Send Notification via Internal API (For Other Services)

```http
POST http://localhost:3006/internal/send-notification
Content-Type: application/json

{
  "userId": "USER1_ID",
  "type": "NEW_MESSAGE",
  "title": "New Message",
  "body": "You have a new message from John",
  "data": {
    "conversationId": "conv_123",
    "senderId": "USER2_ID"
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "notificationId": "notif_xxx",
  "sent": true
}
```

**Note:** This endpoint is used by other services (chat, matching, etc.) to send notifications

---

## Quick PowerShell Test Script

```powershell
# 1. Health Check
Invoke-RestMethod -Uri "http://localhost:3006/health"

# 2. Register Device
$device = @{
  userId = "USER1_ID"
  token = "device_token_abc123"
  platform = "ANDROID"
  appVersion = "1.0.0"
  deviceModel = "Pixel 7"
  osVersion = "Android 14"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3006/api/notifications/device-tokens" -Method POST -Body $device -ContentType "application/json"

# 3. Get Preferences
Invoke-RestMethod -Uri "http://localhost:3006/api/notifications/preferences/USER1_ID"

# 4. Update Preferences
$prefs = @{
  globalEnabled = $true
  newMatchEnabled = $true
  newMessageEnabled = $true
  quietHoursStart = "22:00"
  quietHoursEnd = "08:00"
  timezone = "America/New_York"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3006/api/notifications/preferences/USER1_ID" -Method PUT -Body $prefs -ContentType "application/json"

# 5. Send Notification
$notif = @{
  userId = "USER1_ID"
  type = "NEW_MATCH"
  payload = @{
    title = "New Match!"
    body = "You matched with Sarah"
    data = @{
      matchId = "match_123"
    }
  }
  priority = "NORMAL"
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:3006/api/notifications/send" -Method POST -Body $notif -ContentType "application/json"

# 6. Get Notification Status (use the notificationId from step 5)
Invoke-RestMethod -Uri "http://localhost:3006/api/notifications/NOTIFICATION_ID/status"

# 7. Send via Internal API
$internal = @{
  userId = "USER1_ID"
  type = "NEW_MESSAGE"
  title = "New Message"
  body = "You have a new message"
  data = @{ conversationId = "conv_123" }
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:3006/internal/send-notification" -Method POST -Body $internal -ContentType "application/json"
```

---

## Common Issues

### 1. "User not found"
- **Cause:** User doesn't exist in user-service database
- **Fix:** Create user in user-service first

### 2. "Device token already registered"
- **Cause:** Token already exists for this user
- **Fix:** Use a different token or unregister the old one first

### 3. "Notification not sent"
- **Cause:** Firebase/APNs not configured (optional for testing)
- **Fix:** Service logs notification but doesn't send push (this is OK for testing)

### 4. "Quiet hours active"
- **Cause:** Current time is within user's quiet hours
- **Fix:** Notification is queued for later delivery

---

## Admin Endpoints (Optional)

### Get Queue Statistics

```http
GET http://localhost:3006/api/notifications/queue/stats
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "pendingCount": 5,
    "processingCount": 2,
    "completedToday": 150,
    "failedToday": 3
  }
}
```

---

## Reference: Available Options

### Platforms
- `IOS` - Apple devices
- `ANDROID` - Android devices
- `WEB` - Web browsers

### Notification Types
- `NEW_MATCH` - New match found
- `NEW_MESSAGE` - Chat message received
- `CALL_STARTING` - Video call starting
- `CALL_MISSED` - Missed video call
- `MATCH_EXPIRED` - Match expiring soon
- `PROFILE_VIEWED` - Profile view notification
- `SUBSCRIPTION_EXPIRING` - Premium ending

### Priority Levels
- `LOW` - Can be delayed
- `NORMAL` - Standard delivery
- `HIGH` - Deliver quickly
- `CRITICAL` - Immediate delivery

### Delivery Status
- `PENDING` - Queued for sending
- `SENT` - Sent to push service
- `DELIVERED` - Delivered to device
- `FAILED` - Delivery failed
- `CLICKED` - User clicked notification
