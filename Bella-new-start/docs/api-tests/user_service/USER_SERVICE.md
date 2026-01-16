# User Service API Tests

Base URL: `http://localhost:3001`

## Typical Flow

1. **Anyone** checks health endpoint
2. **New User** registers → gets JWT token
3. **User** creates/updates profile
4. **User** manages safety (block, report)
5. **Anyone** views public profiles

---

## 1. Health Check (Public)

```http
GET /health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "user-service",
  "timestamp": "2025-12-17T10:00:00.000Z"
}
```

---

## 2. Authentication (Public)

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "SecurePass123!"
}
```

**Expected Response (201 Created):**
```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "cm1234567890",
      "username": "testuser",
      "email": "test@example.com",
      "status": "ACTIVE",
      "createdAt": "2025-12-17T10:00:00.000Z"
    }
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "status": "error",
  "message": "Email already exists"
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "SecurePass123!"
}
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "cm1234567890",
      "username": "testuser",
      "email": "test@example.com",
      "status": "ACTIVE",
      "lastActiveAt": "2025-12-17T10:00:00.000Z"
    }
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "status": "error",
  "message": "Invalid credentials"
}
```

### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "cm1234567890",
    "username": "testuser",
    "email": "test@example.com",
    "status": "ACTIVE",
    "emailVerified": false,
    "phoneVerified": false,
    "createdAt": "2025-12-17T10:00:00.000Z",
    "lastActiveAt": "2025-12-17T10:00:00.000Z"
  }
}
```

### Logout
```http
POST /auth/logout
Authorization: Bearer <token>
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

## 3. Profile Management (User - Auth Required)

### Get My Profile
```http
GET /profile
Authorization: Bearer <token>
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "cm1234567890",
    "userId": "cm1234567890",
    "displayName": "John Doe",
    "shortBio": "Looking for meaningful connections",
    "age": 28,
    "gender": "MAN",
    "intent": "LONG_TERM",
    "locationCity": "New York",
    "locationCountry": "USA",
    "locationLatitude": 40.7128,
    "locationLongitude": -74.0060,
    "photos": [
      {
        "url": "https://storage.example.com/photo1.jpg",
        "order": 1,
        "isVerified": false
      }
    ],
    "videos": [],
    "interests": ["travel", "music", "fitness"],
    "languages": ["en", "es"],
    "isComplete": true,
    "createdAt": "2025-12-17T10:00:00.000Z",
    "updatedAt": "2025-12-17T10:00:00.000Z"
  }
}
```

**If No Profile (404 Not Found):**
```json
{
  "status": "error",
  "message": "Profile not found"
}
```

### Create/Update Profile
```http
PUT /profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "John Doe",
  "shortBio": "Looking for meaningful connections",
  "age": 28,
  "gender": "MAN",
  "intent": "LONG_TERM",
  "locationCity": "New York",
  "locationCountry": "USA"
}
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "id": "cm1234567890",
    "displayName": "John Doe",
    "shortBio": "Looking for meaningful connections",
    "age": 28,
    "gender": "MAN",
    "intent": "LONG_TERM",
    "locationCity": "New York",
    "locationCountry": "USA",
    "isComplete": true,
    "updatedAt": "2025-12-17T10:00:00.000Z"
  }
}
```

### Update Preferences
```http
PUT /profile/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "preferredGenders": ["WOMAN"],
  "preferredMinAge": 25,
  "preferredMaxAge": 35,
  "preferredRelationshipIntents": ["LONG_TERM"]
}
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "message": "Preferences updated successfully",
  "data": {
    "preferredGenders": ["WOMAN"],
    "preferredMinAge": 25,
    "preferredMaxAge": 35,
    "preferredRelationshipIntents": ["LONG_TERM"],
    "preferredEthnicities": [],
    "preferredReligions": [],
    "updatedAt": "2025-12-17T10:00:00.000Z"
  }
}
```

### Upload Photo/Video
```http
POST /profile/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image/video file>
type: "photo" or "video"
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "message": "Media uploaded successfully",
  "data": {
    "url": "https://storage.example.com/uploads/photo123.jpg",
    "type": "photo",
    "order": 2,
    "uploadedAt": "2025-12-17T10:00:00.000Z"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "status": "error",
  "message": "Invalid file type. Only images (jpg, png) and videos (mp4) allowed"
}
```

### Remove Media
```http
DELETE /profile/media
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://media-url.com/image.jpg",
  "type": "photo"
}
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "message": "Media removed successfully"
}
```

---

## 4. Public Profiles (No Auth)

### Get User Profile
```http
GET /profile/users/:userId
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "cm1234567890",
    "displayName": "John Doe",
    "shortBio": "Looking for meaningful connections",
    "age": 28,
    "gender": "MAN",
    "locationCity": "New York",
    "locationCountry": "USA",
    "photos": [
      {
        "url": "https://storage.example.com/photo1.jpg",
        "order": 1
      }
    ],
    "interests": ["travel", "music", "fitness"],
    "languages": ["en", "es"],
    "isVerified": false
  }
}
```

**Note:** Sensitive information (email, phone, exact location coordinates) is not included in public profiles.

### Batch Fetch Users
```http
POST /profile/users/batch
Content-Type: application/json

{
  "userIds": ["user-id-1", "user-id-2"]
}
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "user-id-1",
      "displayName": "John Doe",
      "age": 28,
      "gender": "MAN",
      "locationCity": "New York",
      "photos": [
        {
          "url": "https://storage.example.com/photo1.jpg",
          "order": 1
        }
      ]
    },
    {
      "id": "user-id-2",
      "displayName": "Jane Smith",
      "age": 26,
      "gender": "WOMAN",
      "locationCity": "Los Angeles",
      "photos": []
    }
  ]
}
```

---

## 5. Safety Features (User - Auth Required)

### Report User
```http
POST /safety/report
Authorization: Bearer <token>
Content-Type: application/json

{
  "reportedUserId": "user-id",
  "reportType": "inappropriate_behavior",
  "description": "Detailed description"
}
```

**Report Types:** `inappropriate_behavior`, `harassment`, `spam`, `fake_profile`, `underage`, `inappropriate_content`, `violence_threat`, `other`

**Expected Response (201 Created):**
```json
{
  "status": "success",
  "message": "Report submitted successfully",
  "data": {
    "id": "report123",
    "reportedUserId": "user-id",
    "reportType": "inappropriate_behavior",
    "description": "Detailed description",
    "status": "PENDING",
    "createdAt": "2025-12-17T10:00:00.000Z"
  }
}
```

### Block User
```http
POST /safety/block
Authorization: Bearer <token>
Content-Type: application/json

{
  "blockedUserId": "user-id",
  "reason": "Unwanted contact"
}
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "message": "User blocked successfully",
  "data": {
    "blockedUserId": "user-id",
    "reason": "Unwanted contact",
    "blockedAt": "2025-12-17T10:00:00.000Z"
  }
}
```

### Unblock User
```http
DELETE /safety/block/:userId
Authorization: Bearer <token>
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "message": "User unblocked successfully"
}
```

### Get Blocked Users
```http
GET /safety/blocked
Authorization: Bearer <token>
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "blockedUserId": "user-id-1",
      "reason": "Unwanted contact",
      "blockedAt": "2025-12-17T10:00:00.000Z"
    },
    {
      "blockedUserId": "user-id-2",
      "reason": "Harassment",
      "blockedAt": "2025-12-16T15:30:00.000Z"
    }
  ]
}
```

### Get Safety Status
```http
GET /safety/safety-status
Authorization: Bearer <token>
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "accountStatus": "ACTIVE",
    "isSuspended": false,
    "isBanned": false,
    "suspensionReason": null,
    "suspensionExpiresAt": null,
    "warningCount": 0,
    "reportCount": 0,
    "lastWarningAt": null
  }
}
```

**If Suspended:**
```json
{
  "status": "success",
  "data": {
    "accountStatus": "SUSPENDED",
    "isSuspended": true,
    "isBanned": false,
    "suspensionReason": "Multiple reports of inappropriate behavior",
    "suspensionExpiresAt": "2025-12-24T10:00:00.000Z",
    "warningCount": 2,
    "reportCount": 5,
    "lastWarningAt": "2025-12-15T10:00:00.000Z"
  }
}
```

### Submit Appeal
```http
POST /safety/appeal
Authorization: Bearer <token>
Content-Type: application/json

{
  "appealReason": "I believe this was a mistake...",
  "evidence": ["https://evidence-url.com/proof.jpg"]
}
```

**Expected Response (201 Created):**
```json
{
  "status": "success",
  "message": "Appeal submitted successfully",
  "data": {
    "id": "appeal123",
    "appealReason": "I believe this was a mistake...",
    "evidence": ["https://evidence-url.com/proof.jpg"],
    "status": "PENDING",
    "submittedAt": "2025-12-17T10:00:00.000Z"
  }
}
```

### Get My Reports
```http
GET /safety/my-reports
Authorization: Bearer <token>
```

**Expected Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "report123",
      "reportedUserId": "user-id-1",
      "reportType": "harassment",
      "description": "Sent inappropriate messages",
      "status": "IN_REVIEW",
      "createdAt": "2025-12-17T10:00:00.000Z",
      "updatedAt": "2025-12-17T11:00:00.000Z"
    },
    {
      "id": "report124",
      "reportedUserId": "user-id-2",
      "reportType": "spam",
      "description": "Sending spam messages",
      "status": "RESOLVED",
      "resolution": "User warned",
      "createdAt": "2025-12-16T10:00:00.000Z",
      "resolvedAt": "2025-12-16T15:00:00.000Z"
    }
  ]
}
```

### Check Interaction Ability
```http
POST /safety/can-interact
Authorization: Bearer <token>
Content-Type: application/json

{
  "otherUserId": "user-id"
}
```

**Expected Response (200 OK) - Can Interact:**
```json
{
  "status": "success",
  "data": {
    "canInteract": true,
    "reason": null
  }
}
```

**Expected Response (200 OK) - Cannot Interact:**
```json
{
  "status": "success",
  "data": {
    "canInteract": false,
    "reason": "You have blocked this user"
  }
}
```

**Other Reasons:**
- `"You have blocked this user"`
- `"This user has blocked you"`
- `"Your account is suspended"`
- `"This user's account is suspended"`
- `"This user's account is banned"`

---

## Quick Test

```powershell
# 1. Register
$register = Invoke-RestMethod -Uri "http://localhost:3001/auth/register" -Method POST -Body (@{username="testuser"; email="test@example.com"; password="SecurePass123!"} | ConvertTo-Json) -ContentType "application/json"
$token = $register.data.token

# 2. Get current user
Invoke-RestMethod -Uri "http://localhost:3001/auth/me" -Headers @{Authorization="Bearer $token"}

# 3. Create profile
Invoke-RestMethod -Uri "http://localhost:3001/profile" -Method PUT -Headers @{Authorization="Bearer $token"} -Body (@{displayName="Test User"; age=25; gender="MAN"} | ConvertTo-Json) -ContentType "application/json"

# 4. Get profile
Invoke-RestMethod -Uri "http://localhost:3001/profile" -Headers @{Authorization="Bearer $token"}
```

---

## Validation Rules

- **Username:** 3-20 chars, alphanumeric + underscore
- **Email:** Valid email format
- **Password:** Min 8 characters
- **Age:** 18-100
- **Display Name:** Required, XSS sanitized
- **Bio:** Max 500 chars, XSS sanitized
