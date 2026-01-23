# Queuing Service API Testing Guide

**Base URL:** `http://localhost:3002`  
**Container Port:** 3002 (internal) → 3002 (host)

---

## What is the Queuing Service?

The **Queuing Service** is the matchmaking engine of the Kindred app. It's responsible for:

- **Smart Matching:** Connects users based on compatibility scores (age, location, interests, lifestyle)
- **Queue Management:** Handles users waiting to be matched with others
- **Real-time Matching:** Automatically processes matches every 5 seconds in the background
- **Preference-based Filtering:** Respects user preferences for gender, age range, relationship intent, etc.
- **Match History:** Tracks all match attempts and compatibility scores

**Why it's important:** Without this service, users can't find compatible matches. It's the core feature that makes the dating/social app work. The service uses a sophisticated algorithm that considers multiple factors (location proximity, shared interests, age compatibility, lifestyle habits) to create meaningful connections between users.

**How it works:**
1. Users join the queue with their profile data and preferences
2. Background worker scans the queue every 5 seconds
3. Algorithm calculates compatibility scores between waiting users
4. High-scoring matches are created and users are notified
5. Match history is stored for analytics and user review

---

## Prerequisites

1. **User Service** must be running (for user data)
2. **Create test users** in user-service first
3. Get user IDs from user-service database

---

## Testing Order

### Step 1: Health Check

```http
GET http://localhost:3002/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "queuing-service"
}
```

---

### Step 2: Join Queue (First User)

```http
POST http://localhost:3002/api/queue/join
Content-Type: application/json

{
  "userId": "USER1_ID",
  "intent": "CASUAL",
  "gender": "MAN",
  "age": 28,
  "latitude": 40.7128,
  "longitude": -74.0060,
  "interests": ["music", "travel", "fitness"],
  "languages": ["en", "es"]
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Successfully joined queue",
  "data": {
    "queuePosition": 1,
    "estimatedWaitTime": "2-5 minutes"
  }
}
```

**Intent Options:** `CASUAL`, `FRIENDS`, `SERIOUS`, `NETWORKING`  
**Gender Options:** `MAN`, `WOMAN`, `NONBINARY`

---

### Step 3: Join Queue (Second User)

```http
POST http://localhost:3002/api/queue/join
Content-Type: application/json

{
  "userId": "USER2_ID",
  "intent": "CASUAL",
  "gender": "WOMAN",
  "age": 26,
  "latitude": 40.7580,
  "longitude": -73.9855,
  "interests": ["music", "fitness", "cooking"],
  "languages": ["en"]
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Successfully joined queue",
  "data": {
    "queuePosition": 2,
    "estimatedWaitTime": "2-5 minutes"
  }
}
```

---

### Step 4: Update Matching Preferences (Optional)

```http
PUT http://localhost:3002/api/matching/preferences/USER1_ID
Content-Type: application/json

{
  "minAge": 24,
  "maxAge": 30,
  "maxRadius": 50,
  "preferredGenders": ["WOMAN"],
  "interests": ["music", "travel"],
  "languages": ["en"]
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Preferences updated successfully"
}
```

---

### Step 5: Find Matches

```http
POST http://localhost:3002/api/matching/find-dating-matches
Content-Type: application/json

{
  "userId": "USER1_ID",
  "intent": "CASUAL",
  "maxMatches": 10
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "matches": [
      {
        "userId": "USER2_ID",
        "matchId": "match_xxx",
        "compatibility": {
          "totalScore": 85,
          "breakdown": {
            "ageCompatibility": 90,
            "locationCompatibility": 80,
            "interestCompatibility": 75
          }
        }
      }
    ]
  }
}
```

---

### Step 6: Check Queue Status

```http
GET http://localhost:3002/api/queue/status/USER1_ID
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "inQueue": true,
    "position": 1,
    "waitTime": "2 minutes",
    "matchesFound": 1
  }
}
```

---

### Step 7: Get Match History

```http
GET http://localhost:3002/api/matching/history/USER1_ID?limit=10
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "matches": [
      {
        "matchId": "match_xxx",
        "userId": "USER2_ID",
        "score": 85,
        "createdAt": "2025-12-15T..."
      }
    ],
    "total": 1
  }
}
```

---

### Step 8: Leave Queue

```http
POST http://localhost:3002/api/queue/leave
Content-Type: application/json

{
  "userId": "USER1_ID"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Successfully left queue"
}
```

---

## Quick PowerShell Test Script

```powershell
# 1. Health Check
Invoke-RestMethod -Uri "http://localhost:3002/health"

# 2. Join Queue (User 1)
$user1 = @{
  userId = "USER1_ID"
  intent = "CASUAL"
  gender = "MAN"
  age = 28
  latitude = 40.7128
  longitude = -74.0060
  interests = @("music", "travel")
  languages = @("en")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3002/api/queue/join" -Method POST -Body $user1 -ContentType "application/json"

# 3. Join Queue (User 2)
$user2 = @{
  userId = "USER2_ID"
  intent = "CASUAL"
  gender = "WOMAN"
  age = 26
  latitude = 40.7580
  longitude = -73.9855
  interests = @("music", "fitness")
  languages = @("en")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3002/api/queue/join" -Method POST -Body $user2 -ContentType "application/json"

# 4. Find Matches
$matchReq = @{
  userId = "USER1_ID"
  intent = "CASUAL"
  maxMatches = 10
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3002/api/matching/find-dating-matches" -Method POST -Body $matchReq -ContentType "application/json"

# 5. Check Status
Invoke-RestMethod -Uri "http://localhost:3002/api/queue/status/USER1_ID"

# 6. Get History
Invoke-RestMethod -Uri "http://localhost:3002/api/matching/history/USER1_ID"

# 7. Leave Queue
$leave = @{ userId = "USER1_ID" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3002/api/queue/leave" -Method POST -Body $leave -ContentType "application/json"
```

---

## Common Issues

### 1. "User not found"
- **Cause:** User doesn't exist in user-service database
- **Fix:** Create user in user-service first

### 2. "Already in queue"
- **Cause:** User already joined queue
- **Fix:** Leave queue first, then rejoin

### 3. "No matches found"
- **Cause:** No compatible users in queue
- **Fix:** Add more users with compatible preferences

### 4. Connection refused
- **Cause:** Service not running
- **Fix:** Check `docker ps` and restart container

---

## Background Matching

The service automatically processes matches every 5 seconds:
- Scans waiting users in queue
- Calculates compatibility scores (0-100%)
- Creates match proposals
- Prioritizes premium users

**Compatibility Factors:**
- Age difference (15%)
- Location proximity (20%)
- Shared interests (10%)
- Language compatibility (5%)
- Gender preferences (25%)
- Relationship intent (15%)
- Lifestyle habits (10%)

---

## Admin Endpoints (Optional)

### Get Queue Stats (Admin)

```http
GET http://localhost:3002/api/queue/stats
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "totalInQueue": 15,
    "averageWaitTime": "3 minutes",
    "matchesCreatedToday": 42
  }
}
```

---

## Reference: Available Options

### Intent Types
- `CASUAL` - Casual dating
- `FRIENDS` - Looking for friends
- `SERIOUS` - Serious relationship
- `NETWORKING` - Professional networking

### Gender Options
- `MAN`
- `WOMAN`
- `NONBINARY`

### Relationship Intent (for dating preferences)
- `LONG_TERM` - Long-term relationship
- `CASUAL_DATES` - Casual dating
- `MARRIAGE` - Looking for marriage
- `LIFE_PARTNER` - Life partner
- `INTIMACY` - Physical intimacy
- `ETHICAL_NON_MONOGAMY` - Open relationships

### Lifestyle Options
- `FREQUENTLY` - Often/regularly
- `SOCIALLY` - In social settings
- `RARELY` - Occasionally
- `NEVER` - Not at all
