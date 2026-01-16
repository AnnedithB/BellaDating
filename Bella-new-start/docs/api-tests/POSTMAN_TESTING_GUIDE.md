# Postman Testing Guide - User Service

## 📋 Table of Contents
1. [Setup Postman](#setup-postman)
2. [Testing Flow (Step-by-Step)](#testing-flow)
3. [All Endpoints with Examples](#all-endpoints)
4. [Common Issues & Solutions](#troubleshooting)

---

## 🚀 Setup Postman

### Step 1: Create a New Collection
1. Open Postman
2. Click "New" → "Collection"
3. Name it: "User Service API"
4. Save

### Step 2: Set Up Environment Variables
1. Click the "Environments" tab (eye icon in top right)
2. Click "Add" to create new environment
3. Name it: "User Service Local"
4. Add these variables:

| Variable | Initial Value | Current Value |
|----------|--------------|---------------|
| `base_url` | `http://localhost:3001` | `http://localhost:3001` |
| `token` | (leave empty) | (leave empty) |
| `user_id` | (leave empty) | (leave empty) |

5. Save and select this environment

### Step 3: Auto-Save Token Script
For Register and Login requests, add this to the "Tests" tab:

```javascript
// Auto-save token after successful login/register
if (pm.response.code === 200 || pm.response.code === 201) {
    const response = pm.response.json();
    if (response.data && response.data.token) {
        pm.environment.set("token", response.data.token);
        pm.environment.set("user_id", response.data.user.id);
        console.log("✅ Token saved:", response.data.token);
    }
}
```

---

## 🎯 Testing Flow (Step-by-Step)

### **Phase 1: Authentication** (Start Here!)

#### 1️⃣ Health Check (Optional but Recommended)
**Purpose:** Verify service is running  
**When:** Before anything else  
**Auth Required:** ❌ No

```
GET {{base_url}}/health
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "service": "user-service",
    "uptime": 123.456
  }
}
```

---

#### 2️⃣ Register New User
**Purpose:** Create your account  
**When:** First time using the API  
**Auth Required:** ❌ No

```
POST {{base_url}}/auth/register
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "cm4r8...",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "USER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**✅ Success Indicator:** Token is automatically saved to environment

---

#### 3️⃣ Login (Alternative to Register)
**Purpose:** Get token for existing user  
**When:** If you already have an account  
**Auth Required:** ❌ No

```
POST {{base_url}}/auth/login
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

---

#### 4️⃣ Get Current User Info
**Purpose:** Verify authentication works  
**When:** After register/login  
**Auth Required:** ✅ Yes

```
GET {{base_url}}/auth/me
```

**Headers:**
```
Authorization: Bearer {{token}}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "cm4r8...",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "USER",
      "isActive": true
    }
  }
}
```

---

### **Phase 2: Profile Management** (Do This Next!)

#### 5️⃣ Try to Get Profile (Will Fail First Time!)
**Purpose:** Check if profile exists  
**When:** After authentication  
**Auth Required:** ✅ Yes  
**Expected Result:** ❌ 404 Not Found (This is normal!)

```
GET {{base_url}}/profile
```

**Headers:**
```
Authorization: Bearer {{token}}
```

**Expected Response (First Time):**
```json
{
  "status": "error",
  "error": {
    "message": "Profile not found"
  }
}
```

**💡 This is NORMAL! You need to create a profile first.**

---

#### 6️⃣ Create Profile (Do This First!)
**Purpose:** Create your user profile  
**When:** After registration, before fetching profile  
**Auth Required:** ✅ Yes

```
PUT {{base_url}}/profile
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (raw JSON) - Minimal:**
```json
{
  "displayName": "John Doe",
  "age": 25,
  "gender": "MAN"
}
```

**Body (raw JSON) - Complete:**
```json
{
  "displayName": "John Doe",
  "shortBio": "Software developer who loves hiking and photography",
  "age": 28,
  "gender": "MAN",
  "intent": "FRIENDS",
  "locationCity": "New York",
  "locationCountry": "USA",
  "relationshipIntents": ["LONG_TERM", "CASUAL_DATES"],
  "familyPlans": "DOESNT_HAVE_KIDS_WANTS_KIDS",
  "religion": "AGNOSTIC",
  "educationLevel": "UNDERGRADUATE",
  "politicalViews": "MODERATE",
  "exercise": "FREQUENTLY",
  "smoking": "NEVER",
  "drinking": "SOCIALLY"
}
```

**Valid Values:**

**Gender:**
- `MAN`
- `WOMAN`
- `NONBINARY`

**Intent:**
- `CASUAL`
- `FRIENDS`
- `SERIOUS`
- `NETWORKING`

**Relationship Intents:**
- `LONG_TERM`
- `CASUAL_DATES`
- `MARRIAGE`
- `INTIMACY`
- `INTIMACY_NO_COMMITMENT`
- `LIFE_PARTNER`
- `ETHICAL_NON_MONOGAMY`

**Family Plans:**
- `HAS_KIDS_WANTS_MORE`
- `HAS_KIDS_DOESNT_WANT_MORE`
- `DOESNT_HAVE_KIDS_WANTS_KIDS`
- `DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS`
- `NOT_SURE_YET`

**Religion:**
- `AGNOSTIC`, `ATHEIST`, `BUDDHIST`, `CATHOLIC`, `CHRISTIAN`, `HINDU`, `JEWISH`, `MUSLIM`, `SPIRITUAL`, `OTHER`

**Education Level:**
- `HIGH_SCHOOL`, `IN_COLLEGE`, `UNDERGRADUATE`, `IN_GRAD_SCHOOL`, `POSTGRADUATE`

**Political Views:**
- `LIBERAL`, `MODERATE`, `CONSERVATIVE`, `APOLITICAL`, `OTHER`

**Habits (Exercise/Smoking/Drinking):**
- `FREQUENTLY`, `SOCIALLY`, `RARELY`, `NEVER`

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "profile": {
      "id": "...",
      "displayName": "John Doe",
      "shortBio": "Software developer...",
      "age": 28,
      "gender": "MAN",
      ...
    }
  }
}
```

---

#### 7️⃣ Get Profile (Now It Works!)
**Purpose:** Fetch your profile  
**When:** After creating profile  
**Auth Required:** ✅ Yes

```
GET {{base_url}}/profile
```

**Headers:**
```
Authorization: Bearer {{token}}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "profile": {
      "id": "...",
      "displayName": "John Doe",
      "shortBio": "...",
      "photos": [],
      "videos": [],
      "age": 28,
      ...
    }
  }
}
```

---

#### 8️⃣ Update Profile
**Purpose:** Modify existing profile  
**When:** After profile is created  
**Auth Required:** ✅ Yes

```
PUT {{base_url}}/profile
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (raw JSON) - Update Only What You Want:**
```json
{
  "shortBio": "Updated bio - I love coding!",
  "locationCity": "San Francisco",
  "exercise": "SOCIALLY"
}
```

---

#### 9️⃣ Update Partner Preferences
**Purpose:** Set dating preferences  
**When:** After profile is created  
**Auth Required:** ✅ Yes

```
PUT {{base_url}}/profile/preferences
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "preferredGenders": ["WOMAN", "NONBINARY"],
  "preferredMinAge": 25,
  "preferredMaxAge": 35,
  "preferredRelationshipIntents": ["LONG_TERM", "MARRIAGE"],
  "preferredExerciseHabits": ["FREQUENTLY", "SOCIALLY"],
  "preferredSmokingHabits": ["NEVER"],
  "preferredDrinkingHabits": ["SOCIALLY", "RARELY"]
}
```

---

### **Phase 3: Media Upload** (Optional)

#### 🔟 Upload Profile Photo
**Purpose:** Add photos to profile  
**When:** After profile is created  
**Auth Required:** ✅ Yes

```
POST {{base_url}}/profile/upload
```

**Headers:**
```
Authorization: Bearer {{token}}
```

**Body (form-data):**
- Key: `file` | Type: File | Value: (select image file)
- Key: `type` | Type: Text | Value: `photo`

**For Video:**
- Key: `file` | Type: File | Value: (select video file)
- Key: `type` | Type: Text | Value: `video`

---

#### 1️⃣1️⃣ Remove Media
**Purpose:** Delete photo/video from profile  
**When:** After uploading media  
**Auth Required:** ✅ Yes

```
DELETE {{base_url}}/profile/media
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "url": "https://your-media-url.com/image.jpg",
  "type": "photo"
}
```

---

### **Phase 4: Public Endpoints** (No Auth Needed)

#### 1️⃣2️⃣ Get Another User's Profile
**Purpose:** View public profile of any user  
**When:** When you have a user ID  
**Auth Required:** ❌ No

```
GET {{base_url}}/profile/users/USER_ID_HERE
```

Replace `USER_ID_HERE` with actual user ID.

---

#### 1️⃣3️⃣ Batch Fetch Users
**Purpose:** Get multiple user profiles at once  
**When:** When you have multiple user IDs  
**Auth Required:** ❌ No

```
POST {{base_url}}/profile/users/batch
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "userIds": [
    "user-id-1",
    "user-id-2",
    "user-id-3"
  ]
}
```

---

### **Phase 5: Safety Features**

#### 1️⃣4️⃣ Report a User
**Purpose:** Report inappropriate behavior  
**When:** When you encounter a problem user  
**Auth Required:** ✅ Yes

```
POST {{base_url}}/safety/report
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "reportedUserId": "user-id-to-report",
  "reportType": "inappropriate_behavior",
  "description": "This user was sending inappropriate messages"
}
```

**Report Types:**
- `inappropriate_behavior`
- `harassment`
- `spam`
- `fake_profile`
- `underage`
- `inappropriate_content`
- `violence_threat`
- `other`

---

#### 1️⃣5️⃣ Block a User
**Purpose:** Prevent interaction with a user  
**When:** When you want to block someone  
**Auth Required:** ✅ Yes

```
POST {{base_url}}/safety/block
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "blockedUserId": "user-id-to-block",
  "reason": "Unwanted contact"
}
```

---

#### 1️⃣6️⃣ Get Blocked Users List
**Purpose:** See who you've blocked  
**When:** Anytime after blocking users  
**Auth Required:** ✅ Yes

```
GET {{base_url}}/safety/blocked
```

**Headers:**
```
Authorization: Bearer {{token}}
```

---

#### 1️⃣7️⃣ Unblock a User
**Purpose:** Remove a block  
**When:** When you want to unblock someone  
**Auth Required:** ✅ Yes

```
DELETE {{base_url}}/safety/block/USER_ID_TO_UNBLOCK
```

**Headers:**
```
Authorization: Bearer {{token}}
```

---

#### 1️⃣8️⃣ Get Safety Status
**Purpose:** Check your account safety status  
**When:** Anytime  
**Auth Required:** ✅ Yes

```
GET {{base_url}}/safety/safety-status
```

**Headers:**
```
Authorization: Bearer {{token}}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "...",
    "trustScore": 100.0,
    "status": "GOOD_STANDING",
    "reportsMade": 0,
    "reportsReceived": 0
  }
}
```

---

#### 1️⃣9️⃣ Check if Can Interact
**Purpose:** Check if you can interact with another user  
**When:** Before sending messages/interactions  
**Auth Required:** ✅ Yes

```
POST {{base_url}}/safety/can-interact
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "otherUserId": "user-id-to-check"
}
```

---

#### 2️⃣0️⃣ Get My Reports
**Purpose:** See reports you've submitted  
**When:** Anytime after reporting users  
**Auth Required:** ✅ Yes

```
GET {{base_url}}/safety/my-reports
```

**Headers:**
```
Authorization: Bearer {{token}}
```

---

#### 2️⃣1️⃣ Submit an Appeal
**Purpose:** Appeal account restrictions  
**When:** If your account is restricted  
**Auth Required:** ✅ Yes

```
POST {{base_url}}/safety/appeal
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "appealReason": "I believe my account was restricted by mistake. I have always followed community guidelines and would like to request a review of my case.",
  "evidence": ["https://evidence-url.com/screenshot.jpg"]
}
```

---

#### 2️⃣2️⃣ Logout
**Purpose:** End session (client-side token removal)  
**When:** When done testing  
**Auth Required:** ✅ Yes

```
POST {{base_url}}/auth/logout
```

**Headers:**
```
Authorization: Bearer {{token}}
```

---

## 📊 Complete Testing Flow Summary

### ✅ Correct Order:

1. **Health Check** → Verify service is up
2. **Register** → Create account (token auto-saved)
3. **Get Current User** → Verify auth works
4. **Try Get Profile** → Will fail (404) - This is normal!
5. **Create Profile** → Must do this first!
6. **Get Profile** → Now it works!
7. **Update Profile** → Modify as needed
8. **Update Preferences** → Set dating preferences
9. **Upload Media** → Add photos/videos (optional)
10. **Safety Features** → Test reporting, blocking, etc.
11. **Logout** → Clean up

---

## 🎨 Postman Collection JSON

Save this as `User-Service-API.postman_collection.json`:

```json
{
  "info": {
    "name": "User Service API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/health",
          "host": ["{{base_url}}"],
          "path": ["health"]
        }
      }
    },
    {
      "name": "2. Register",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "if (pm.response.code === 201) {",
              "    const response = pm.response.json();",
              "    pm.environment.set('token', response.data.token);",
              "    pm.environment.set('user_id', response.data.user.id);",
              "    console.log('✅ Token saved');",
              "}"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"username\": \"johndoe\",\n  \"email\": \"john@example.com\",\n  \"password\": \"SecurePass123!\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/auth/register",
          "host": ["{{base_url}}"],
          "path": ["auth", "register"]
        }
      }
    },
    {
      "name": "3. Get Current User",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/auth/me",
          "host": ["{{base_url}}"],
          "path": ["auth", "me"]
        }
      }
    },
    {
      "name": "4. Create Profile",
      "request": {
        "method": "PUT",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"displayName\": \"John Doe\",\n  \"shortBio\": \"Software developer\",\n  \"age\": 28,\n  \"gender\": \"MAN\",\n  \"intent\": \"FRIENDS\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/profile",
          "host": ["{{base_url}}"],
          "path": ["profile"]
        }
      }
    },
    {
      "name": "5. Get Profile",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/profile",
          "host": ["{{base_url}}"],
          "path": ["profile"]
        }
      }
    }
  ]
}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Profile not found" (404)
**Cause:** You haven't created a profile yet  
**Solution:** Use `PUT /profile` to create profile first

### Issue 2: "Unauthorized" (401)
**Cause:** Token is missing or invalid  
**Solution:** 
- Check Authorization header: `Bearer {{token}}`
- Re-login to get fresh token
- Make sure token variable is set in environment

### Issue 3: "Validation error" (400)
**Cause:** Invalid data in request body  
**Solution:** Check the valid values lists above

### Issue 4: "User already exists" (409)
**Cause:** Email or username already registered  
**Solution:** Use different email/username or login instead

### Issue 5: Can't upload files
**Cause:** Wrong body type  
**Solution:** Use `form-data` not `raw JSON` for file uploads

---

## 💡 Pro Tips

1. **Save Responses:** Click "Save Response" to keep examples
2. **Use Variables:** Always use `{{base_url}}` and `{{token}}`
3. **Test Scripts:** Auto-save tokens with test scripts
4. **Organize:** Create folders for Auth, Profile, Safety
5. **Document:** Add descriptions to each request
6. **Share:** Export collection to share with team

---

## 🎯 Quick Reference

**Must Create Profile Before:**
- ✅ GET /profile
- ✅ PUT /profile/preferences
- ✅ POST /profile/upload

**Can Use Without Profile:**
- ✅ GET /auth/me
- ✅ POST /auth/logout
- ✅ All safety endpoints
- ✅ All public endpoints

**No Auth Required:**
- ✅ GET /health
- ✅ POST /auth/register
- ✅ POST /auth/login
- ✅ GET /profile/users/:id
- ✅ POST /profile/users/batch

---

Happy Testing! 🚀
