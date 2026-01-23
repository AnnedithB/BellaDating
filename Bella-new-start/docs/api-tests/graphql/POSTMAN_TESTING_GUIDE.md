# GraphQL Testing with Postman - Step by Step Guide

## ⚠️ Important: GraphQL Gateway Status

### Current Implementation

The GraphQL Gateway is currently running with a **minimal server** that provides:

✅ **Available:**
- Health check endpoint
- Basic GraphQL endpoint structure
- Service connectivity

⏳ **In Development:**
- Full GraphQL schema definitions
- Mutations (register, login, update, etc.)
- Queries (user data, matches, messages, etc.)
- Subscriptions (real-time updates)

### Testing Options

**Option 1: GraphQL (Recommended for Future)**
- All tests use `POST {{baseUrl}}/graphql`
- Requires schema implementation
- Single endpoint for all operations

**Option 2: REST Fallback (Current)**
- Direct service endpoints (3001, 3002, etc.)
- Fully functional now
- Multiple endpoints

**This guide shows both approaches** - use REST fallback where GraphQL is not yet implemented.

---

## Setup Postman

### Step 1: Create New Collection

1. Open Postman
2. Click "New" → "Collection"
3. Name it: "Kindred GraphQL API"
4. Save

### Step 2: Set Collection Variables

1. Click on your collection
2. Go to "Variables" tab
3. Add these variables:

| Variable | Initial Value | Current Value |
|----------|--------------|---------------|
| `baseUrl` | `http://localhost:4000` | `http://localhost:4000` |
| `token` | (leave empty) | (leave empty) |

4. Save

---

## Testing Flow (In Order)

Follow this exact order for testing:

```
1. Health Check (No Auth)
2. Register User (No Auth)
3. Login User (No Auth) → Save Token
4. Get My Profile (Auth Required)
5. Update Profile (Auth Required)
6. Find Matches (Auth Required)
7. Send Message (Auth Required)
8. Get Conversations (Auth Required)
9. Subscribe to Premium (Auth Required)
10. Get Notifications (Auth Required)
```

---

## Test 1: Health Check

**Purpose:** Verify GraphQL Gateway is running

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
```

**Body (GraphQL):**
```json
{
  "query": "query HealthCheck { __typename }"
}
```

### Expected Response

```json
{
  "data": {
    "__typename": "Query"
  }
}
```

✅ **Success:** Gateway is running and responding

---

## Test 2: Register User (via GraphQL)

**Purpose:** Create a new user account through GraphQL Gateway

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
```

**Body (GraphQL):**
```json
{
  "query": "mutation RegisterUser($input: RegisterInput!) { register(input: $input) { user { id email username } } }",
  "variables": {
    "input": {
      "email": "testuser@example.com",
      "password": "Test123!@#",
      "username": "testuser",
      "dateOfBirth": "1995-01-01"
    }
  }
}
```

### Expected Response

```json
{
  "data": {
    "register": {
      "user": {
        "id": "clx123abc...",
        "email": "testuser@example.com",
        "username": "testuser"
      }
    }
  }
}
```

### ⚠️ Current Status

**Note:** This mutation requires GraphQL schema implementation. If not yet implemented, use REST fallback:

**REST Fallback:**
```
POST http://localhost:3001/api/auth/register
Content-Type: application/json

{
  "email": "testuser@example.com",
  "password": "Test123!@#",
  "username": "testuser",
  "dateOfBirth": "1995-01-01"
}
```

✅ **Success:** User created  
📝 **Note:** Save the user ID for later

---

## Test 3: Login User (via GraphQL)

**Purpose:** Get authentication token through GraphQL Gateway

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
```

**Body (GraphQL):**
```json
{
  "query": "mutation LoginUser($email: String!, $password: String!) { login(email: $email, password: $password) { token user { id email username } } }",
  "variables": {
    "email": "testuser@example.com",
    "password": "Test123!@#"
  }
}
```

### Expected Response

```json
{
  "data": {
    "login": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "clx123abc...",
        "email": "testuser@example.com",
        "username": "testuser"
      }
    }
  }
}
```

### ⚠️ Current Status

**Note:** This mutation requires GraphQL schema implementation. If not yet implemented, use REST fallback:

**REST Fallback:**
```
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "testuser@example.com",
  "password": "Test123!@#"
}
```

### 🔑 IMPORTANT: Save Token

1. Copy the `token` value from response
2. Go to Collection → Variables
3. Paste token into `token` variable (both Initial and Current Value)
4. Save

**Or use Postman Test Script:**
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    const token = response.data.login.token;
    pm.collectionVariables.set("token", token);
    console.log("Token saved:", token);
}
```

✅ **Success:** Token saved, ready for authenticated requests

---

## Test 4: Get My Profile

**Purpose:** Fetch current user's profile data

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "query GetMyProfile { me { id email username profile { bio age interests } } }"
}
```

### Alternative (Formatted Query)

```json
{
  "query": "query GetMyProfile {\n  me {\n    id\n    email\n    username\n    profile {\n      bio\n      age\n      interests\n    }\n  }\n}"
}
```

### Expected Response

```json
{
  "data": {
    "me": {
      "id": "clx123abc...",
      "email": "testuser@example.com",
      "username": "testuser",
      "profile": {
        "bio": null,
        "age": null,
        "interests": []
      }
    }
  }
}
```

✅ **Success:** Profile data retrieved

---

## Test 5: Update Profile

**Purpose:** Update user profile information

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "mutation UpdateProfile($input: UpdateProfileInput!) { updateProfile(input: $input) { id profile { bio age interests } } }",
  "variables": {
    "input": {
      "bio": "Love hiking and music",
      "age": 28,
      "interests": ["hiking", "music", "travel"]
    }
  }
}
```

### Expected Response

```json
{
  "data": {
    "updateProfile": {
      "id": "clx123abc...",
      "profile": {
        "bio": "Love hiking and music",
        "age": 28,
        "interests": ["hiking", "music", "travel"]
      }
    }
  }
}
```

✅ **Success:** Profile updated

---

## Test 6: Find Matches

**Purpose:** Search for potential matches

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "query FindMatches($filters: MatchFilters!) { findMatches(filters: $filters, limit: 10) { id username profile { age bio interests profilePicture } compatibility { score commonInterests } } }",
  "variables": {
    "filters": {
      "ageRange": {
        "min": 25,
        "max": 35
      },
      "interests": ["music", "travel"],
      "distance": 50
    }
  }
}
```

### Expected Response

```json
{
  "data": {
    "findMatches": [
      {
        "id": "user456",
        "username": "jane_doe",
        "profile": {
          "age": 27,
          "bio": "Music lover and traveler",
          "interests": ["music", "travel", "food"],
          "profilePicture": "https://..."
        },
        "compatibility": {
          "score": 85,
          "commonInterests": ["music", "travel"]
        }
      }
    ]
  }
}
```

✅ **Success:** Matches found

---

## Test 7: Swipe on User

**Purpose:** Like or pass on a user

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "mutation SwipeUser($input: SwipeInput!) { swipe(input: $input) { action isMatch match { id matchedUser { username profilePicture } matchedAt } } }",
  "variables": {
    "input": {
      "targetUserId": "user456",
      "action": "LIKE"
    }
  }
}
```

### Expected Response (No Match)

```json
{
  "data": {
    "swipe": {
      "action": "LIKE",
      "isMatch": false,
      "match": null
    }
  }
}
```

### Expected Response (Match!)

```json
{
  "data": {
    "swipe": {
      "action": "LIKE",
      "isMatch": true,
      "match": {
        "id": "match123",
        "matchedUser": {
          "username": "jane_doe",
          "profilePicture": "https://..."
        },
        "matchedAt": "2025-12-13T20:00:00.000Z"
      }
    }
  }
}
```

✅ **Success:** Swipe recorded

---

## Test 8: Send Message

**Purpose:** Send a message to a matched user

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "mutation SendMessage($input: SendMessageInput!) { sendMessage(input: $input) { id content timestamp deliveryStatus sender { username } } }",
  "variables": {
    "input": {
      "roomId": "room123",
      "content": "Hey! How are you?",
      "messageType": "TEXT"
    }
  }
}
```

### Expected Response

```json
{
  "data": {
    "sendMessage": {
      "id": "msg123",
      "content": "Hey! How are you?",
      "timestamp": "2025-12-13T20:00:00.000Z",
      "deliveryStatus": "DELIVERED",
      "sender": {
        "username": "testuser"
      }
    }
  }
}
```

✅ **Success:** Message sent

---

## Test 9: Get Conversations

**Purpose:** Retrieve all active conversations

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "query GetConversations { myConversations { id participants { username profilePicture isOnline } lastMessage { content timestamp } unreadCount } }"
}
```

### Expected Response

```json
{
  "data": {
    "myConversations": [
      {
        "id": "room123",
        "participants": [
          {
            "username": "jane_doe",
            "profilePicture": "https://...",
            "isOnline": true
          }
        ],
        "lastMessage": {
          "content": "Hey! How are you?",
          "timestamp": "2025-12-13T20:00:00.000Z"
        },
        "unreadCount": 0
      }
    ]
  }
}
```

✅ **Success:** Conversations retrieved

---

## Test 10: Get Conversation Messages

**Purpose:** Get message history for a conversation

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "query GetMessages($roomId: ID!, $limit: Int) { conversation(roomId: $roomId) { id messages(limit: $limit) { id content messageType sender { username } timestamp isRead } } }",
  "variables": {
    "roomId": "room123",
    "limit": 50
  }
}
```

### Expected Response

```json
{
  "data": {
    "conversation": {
      "id": "room123",
      "messages": [
        {
          "id": "msg123",
          "content": "Hey! How are you?",
          "messageType": "TEXT",
          "sender": {
            "username": "testuser"
          },
          "timestamp": "2025-12-13T20:00:00.000Z",
          "isRead": false
        }
      ]
    }
  }
}
```

✅ **Success:** Messages retrieved

---

## Test 11: Get Subscription Plans

**Purpose:** View available subscription tiers

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "query GetPlans { subscriptionPlans { id name price interval features description } }"
}
```

### Expected Response

```json
{
  "data": {
    "subscriptionPlans": [
      {
        "id": "free",
        "name": "Free",
        "price": 0,
        "interval": "month",
        "features": ["basic_swipes", "limited_matches"],
        "description": "Basic features"
      },
      {
        "id": "premium",
        "name": "Premium",
        "price": 9.99,
        "interval": "month",
        "features": ["unlimited_swipes", "video_calls", "no_ads"],
        "description": "Full access to all features"
      }
    ]
  }
}
```

✅ **Success:** Plans retrieved

---

## Test 12: Subscribe to Premium

**Purpose:** Upgrade to premium subscription

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "mutation Subscribe($input: SubscribeInput!) { subscribe(input: $input) { id tier status features expiresAt } }",
  "variables": {
    "input": {
      "planId": "premium",
      "paymentMethod": "stripe"
    }
  }
}
```

### Expected Response

```json
{
  "data": {
    "subscribe": {
      "id": "sub123",
      "tier": "premium",
      "status": "active",
      "features": ["unlimited_swipes", "video_calls", "no_ads"],
      "expiresAt": "2026-01-13T20:00:00.000Z"
    }
  }
}
```

✅ **Success:** Subscription activated

---

## Test 13: Get Notifications

**Purpose:** Retrieve user notifications

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "query GetNotifications($unreadOnly: Boolean) { myNotifications(unreadOnly: $unreadOnly) { id type message isRead createdAt } }",
  "variables": {
    "unreadOnly": true
  }
}
```

### Expected Response

```json
{
  "data": {
    "myNotifications": [
      {
        "id": "notif123",
        "type": "NEW_MATCH",
        "message": "You have a new match with jane_doe!",
        "isRead": false,
        "createdAt": "2025-12-13T20:00:00.000Z"
      }
    ]
  }
}
```

✅ **Success:** Notifications retrieved

---

## Test 14: Get User Stats

**Purpose:** View user activity statistics

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "query GetStats { me { id stats { totalMatches activeConversations profileViews totalSwipes } } }"
}
```

### Expected Response

```json
{
  "data": {
    "me": {
      "id": "clx123abc...",
      "stats": {
        "totalMatches": 5,
        "activeConversations": 3,
        "profileViews": 42,
        "totalSwipes": 150
      }
    }
  }
}
```

✅ **Success:** Stats retrieved

---

## Test 15: Dashboard Query (Complex)

**Purpose:** Get all dashboard data in one request

### Request Setup

**Method:** `POST`  
**URL:** `{{baseUrl}}/graphql`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{token}}
```

**Body (GraphQL):**
```json
{
  "query": "query Dashboard { me { id username stats { totalMatches activeConversations } recentMatches(limit: 5) { id username profile { profilePicture } matchedAt } activeConversations { id lastMessage { content timestamp } unreadCount participant { username isOnline } } notifications(unreadOnly: true) { id type message } } }"
}
```

### Expected Response

```json
{
  "data": {
    "me": {
      "id": "clx123abc...",
      "username": "testuser",
      "stats": {
        "totalMatches": 5,
        "activeConversations": 3
      },
      "recentMatches": [
        {
          "id": "match123",
          "username": "jane_doe",
          "profile": {
            "profilePicture": "https://..."
          },
          "matchedAt": "2025-12-13T20:00:00.000Z"
        }
      ],
      "activeConversations": [
        {
          "id": "room123",
          "lastMessage": {
            "content": "Hey! How are you?",
            "timestamp": "2025-12-13T20:00:00.000Z"
          },
          "unreadCount": 0,
          "participant": {
            "username": "jane_doe",
            "isOnline": true
          }
        }
      ],
      "notifications": [
        {
          "id": "notif123",
          "type": "NEW_MATCH",
          "message": "You have a new match!"
        }
      ]
    }
  }
}
```

✅ **Success:** Complete dashboard data in single request!

---

## Common Issues & Solutions

### Issue 1: "Unauthorized" Error

**Error:**
```json
{
  "errors": [
    {
      "message": "Unauthorized",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

**Solution:**
1. Check token is saved in collection variables
2. Verify Authorization header: `Bearer {{token}}`
3. Token might be expired - login again

### Issue 2: "Field not found" Error

**Error:**
```json
{
  "errors": [
    {
      "message": "Cannot query field 'xyz' on type 'User'"
    }
  ]
}
```

**Solution:**
- Field name is incorrect or doesn't exist
- Check GraphQL Playground at `http://localhost:4000/graphql` for available fields

### Issue 3: Variables Not Working

**Error:**
```json
{
  "errors": [
    {
      "message": "Variable '$input' is not defined"
    }
  ]
}
```

**Solution:**
- Ensure variables are in separate `variables` field in JSON body
- Check variable names match between query and variables object

### Issue 4: Connection Refused

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:4000
```

**Solution:**
- GraphQL Gateway is not running
- Start it: `docker compose up -d graphql-gateway`
- Check health: `docker ps | grep graphql`

---

## Tips & Tricks

### 1. Save Requests in Collection

After testing each request:
1. Click "Save" button
2. Name it clearly (e.g., "01 - Health Check")
3. Save to "Kindred GraphQL API" collection

### 2. Use Postman Tests

Add to "Tests" tab to auto-save token:

```javascript
// For Login request
if (pm.response.code === 200) {
    const response = pm.response.json();
    if (response.data && response.data.token) {
        pm.collectionVariables.set("token", response.data.token);
        console.log("Token saved:", response.data.token);
    }
}
```

### 3. Format GraphQL Queries

Use online formatter: https://prettier.io/playground/

Before:
```
query{me{id username profile{bio}}}
```

After:
```graphql
query {
  me {
    id
    username
    profile {
      bio
    }
  }
}
```

### 4. Use Postman Environments

Create environments for different stages:
- **Development**: `http://localhost:4000`
- **Staging**: `https://staging-api.kindred.com`
- **Production**: `https://api.kindred.com`

### 5. Export Collection

Share with team:
1. Click "..." on collection
2. Select "Export"
3. Choose "Collection v2.1"
4. Share JSON file

---

## Quick Reference

### GraphQL Query Structure

```json
{
  "query": "GRAPHQL_QUERY_HERE",
  "variables": {
    "variableName": "value"
  }
}
```

### Required Headers

```
Content-Type: application/json
Authorization: Bearer {{token}}
```

### Common Variable Types

```graphql
$id: ID!              # Required ID
$name: String         # Optional String
$age: Int!            # Required Integer
$active: Boolean      # Optional Boolean
$input: InputType!    # Required Input Object
```

---

## Summary

You've learned how to:

✅ Set up Postman for GraphQL testing  
✅ Register and authenticate users  
✅ Query user profiles and data  
✅ Update user information  
✅ Find and match with users  
✅ Send and receive messages  
✅ Manage subscriptions  
✅ Retrieve notifications  
✅ Execute complex nested queries  
✅ Handle errors and troubleshoot  

**Next Steps:**
1. Test all 15 requests in order
2. Save successful requests to collection
3. Experiment with different variables
4. Try combining multiple queries
5. Explore GraphQL Playground for more fields

**Happy Testing! 🚀**
