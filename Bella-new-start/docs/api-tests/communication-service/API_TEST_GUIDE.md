# Communication Service API Test Guide

## How It Works (Simple Explanation)

1. **Create 2 users** (testuser1 and testuser2)
2. **Login both users** to get their tokens and IDs:
   - User 1 → USER1_TOKEN and USER1_ID
   - User 2 → USER2_TOKEN and USER2_ID
3. **User 1 creates a conversation** and invites User 2:
   - Sends: `{"participant2Id": "USER2_ID"}` (User 2's ID)
   - Gets back: `roomId` (e.g., "room_1765838427706_ibh4giq02") - **SAVE THIS!**
4. **Both users send messages to the SAME `roomId`:**
   - User 1 sends: "Hello!" (using USER1_TOKEN + roomId)
   - User 2 replies: "Hi back!" (using USER2_TOKEN + SAME roomId)
5. **Either user can read all messages** using that `roomId`

**⚠️ IMPORTANT:**
- Use the `roomId` field from the conversation response (e.g., "room_1765838427706_ibh4giq02")
- The `roomId` is what you use in message URLs
- The `id` is just the database primary key

**Key Concepts:**
- `participant2Id` = Who you want to chat with (their user ID)
- `roomId` = The conversation room ID (use this in message URLs!)
- `id` = Database primary key (not used in URLs)
- Each user uses their own token but the SAME `roomId`

---

## Prerequisites & Setup

### Services Required
1. **User Service** (Host Port 3001) - for authentication
2. **Communication Service** (Host Port 3005) - for chat functionality

### Test Users Setup
You need to create **at least 2 users** to test conversations properly:

#### Step 1: Create First User
```
POST http://localhost:3001/auth/register
Content-Type: application/json

{
  "username": "testuser1",
  "email": "test1@example.com",
  "password": "password123"
}
```

#### Step 2: Create Second User
```
POST http://localhost:3001/auth/register
Content-Type: application/json

{
  "username": "testuser2", 
  "email": "test2@example.com",
  "password": "password123"
}
```

#### Step 3: Get Authentication Tokens
Login as each user to get their JWT tokens:

**User 1 Login:**
```
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "test1@example.com",
  "password": "password123"
}
```

**User 2 Login:**
```
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "test2@example.com", 
  "password": "password123"
}
```

**Save the tokens from responses:**
- `USER1_TOKEN` = token from user1 login response
- `USER2_TOKEN` = token from user2 login response
- `USER1_ID` = user id from user1 login response
- `USER2_ID` = user id from user2 login response

## Communication Service Testing

### Service Info
- **Host Port**: 3005
- **Base URL**: `http://localhost:3005`
- **Authentication**: Bearer token required for all endpoints except health checks

## Test Order & Endpoints

### 1. Health Check (No Auth Required)
```
GET /health
```
**Expected Response:**
```json
{
  "status": "OK",
  "service": "communication-service",
  "timestamp": "2024-12-16T...",
  "version": "1.0.0",
  "socketConnections": 0
}
```

### 2. WebSocket Status (No Auth Required)
```
GET /ws-status
```
**Expected Response:**
```json
{
  "status": "OK",
  "activeConnections": 0,
  "rooms": 0,
  "socketIOVersion": "4.x.x"
}
```

### 3. Create Conversation (User 1 Creates Chat with User 2)
**User 1 creates a conversation and invites User 2 to join**

```
POST /api/chat/conversations
Authorization: Bearer USER1_TOKEN
Content-Type: application/json

{
  "participant2Id": "USER2_ID",
  "isAnonymous": true
}
```

**What these fields mean:**
- `participant2Id`: The ID of the person you want to chat with (User 2's ID)
  - Think of it like: "I want to start a chat with USER2_ID"
- `isAnonymous`: Whether the chat is anonymous or not
  - `true` = anonymous chat (usernames hidden, like Omegle)
  - `false` = regular chat (usernames visible, like WhatsApp)

**Note:** User 1 is automatically added as participant1 (from the token). You only specify who else to add.

**Simple Analogy:**
- Creating a conversation = Creating a WhatsApp group
- `participant2Id` = The person you're adding to the group
- `roomId` = The group chat ID
- After creation, both people can send messages to that group using the roomId
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx123abc456",
    "roomId": "room_1765837904011_yfa98fixq",
    "participant1Id": "USER1_ID",
    "participant2Id": "USER2_ID",
    "participants": [
      {
        "userId": "USER1_ID",
        "role": "ADMIN",
        "joinedAt": "2024-12-16T..."
      },
      {
        "userId": "USER2_ID",
        "role": "MEMBER",
        "joinedAt": "2024-12-16T..."
      }
    ]
  }
}
```

**IMPORTANT: Save the `roomId` field for sending messages!**
- Use `data.roomId` (e.g., "room_1765838427706_ibh4giq02") in the URL
- The `id` is the database primary key, but messages use `roomId` as the foreign key

### 4. Get User Conversations (Use USER1_TOKEN)
```
GET /api/chat/conversations?limit=20&offset=0
Authorization: Bearer USER1_TOKEN
```
**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "room_xxx",
      "roomId": "room_1234567890_abcdef123",
      "participants": [...],
      "messages": [
        {
          "id": "msg_xxx",
          "content": "Hello",
          "messageType": "TEXT",
          "timestamp": "2024-12-16T...",
          "senderId": "user_id"
        }
      ]
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 1
  }
}
```

### 5. User 1 Sends First Message
**Use USER1_TOKEN and the `roomId` from step 3**

```
POST /api/chat/conversations/{roomId}/messages
Authorization: Bearer USER1_TOKEN
Content-Type: application/json

{
  "content": "Hello, this is a test message!",
  "type": "TEXT"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_abc123",
    "messageId": "msg_1234567890_abcdef123",
    "roomId": "clx123abc456",
    "senderId": "USER1_ID",
    "content": "Hello, this is a test message!",
    "messageType": "TEXT",
    "timestamp": "2024-12-16T..."
  }
}
```

**Save the message `id` for editing/deleting later**

### 6. User 2 Sends Reply Message
**Use USER2_TOKEN and the SAME `roomId` from step 3**

```
POST /api/chat/conversations/{roomId}/messages
Authorization: Bearer USER2_TOKEN
Content-Type: application/json

{
  "content": "Hi back! This is user 2 responding.",
  "type": "TEXT"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_def456",
    "messageId": "msg_9876543210_xyz789",
    "roomId": "clx123abc456",
    "senderId": "USER2_ID",
    "content": "Hi back! This is user 2 responding.",
    "messageType": "TEXT",
    "timestamp": "2024-12-16T..."
  }
}
```

**Key Point:** Both users send messages to the SAME `roomId`. User 1 uses USER1_TOKEN, User 2 uses USER2_TOKEN.

**Example URL:** `POST /api/chat/conversations/room_1765838427706_ibh4giq02/messages`

### 7. Get All Messages in Conversation
**Either user can retrieve messages using their token**
```
GET /api/chat/conversations/{roomId}/messages?limit=50
Authorization: Bearer USER1_TOKEN
```
**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg_xxx",
      "messageId": "msg_1234567890_abcdef123",
      "roomId": "room_xxx",
      "senderId": "current_user_id",
      "content": "Hello, this is a test message!",
      "messageType": "TEXT",
      "timestamp": "2024-12-16T...",
      "voiceUrl": null,
      "voiceDuration": null,
      "imageUrl": null
    }
  ],
  "pagination": {
    "limit": 50,
    "hasMore": false
  }
}
```

### 8. Edit Message (Use USER1_TOKEN - can only edit own messages)
```
PATCH /api/chat/conversations/{roomId}/messages/{messageId}
Authorization: Bearer USER1_TOKEN
```
**Request Body:**
```json
{
  "content": "Hello, this is an edited test message!"
}
```
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_xxx",
    "messageId": "msg_1234567890_abcdef123",
    "roomId": "room_xxx",
    "senderId": "current_user_id",
    "content": "Hello, this is an edited test message!",
    "messageType": "TEXT",
    "timestamp": "2024-12-16T...",
    "isEdited": true,
    "editedAt": "2024-12-16T..."
  }
}
```

### 9. Get Conversation Analytics (Use USER1_TOKEN)
```
GET /api/analytics/conversations/{roomId}/analytics
Authorization: Bearer USER1_TOKEN
```
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "roomId": "room_xxx",
    "messageCount": 1,
    "participantCount": 2,
    "lastActivity": "2024-12-16T...",
    "messageTypes": [
      {
        "type": "TEXT",
        "count": 1
      }
    ]
  }
}
```

### 10. Get User Statistics (Use USER1_TOKEN)
```
GET /api/analytics/user/statistics
Authorization: Bearer USER1_TOKEN
```
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": "current_user_id",
    "sentMessages": 1,
    "receivedMessages": 0,
    "conversationCount": 1,
    "dailyActivity": [
      {
        "date": "2024-12-16T...",
        "messageCount": 1
      }
    ]
  }
}
```

### 11. Delete Message (Use USER1_TOKEN - can only delete own messages)
```
DELETE /api/chat/conversations/{roomId}/messages/{messageId}
Authorization: Bearer USER1_TOKEN
```
**Expected Response:**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

## Important Notes

### Authentication
- **User Service** must be running on host port 3001 for authentication
- **Communication Service** runs on host port 3005
- JWT tokens expire based on config (typically 24h)
- Users can only edit/delete their own messages
- Users can only access conversations they're participants in

### Testing Flow Summary
1. **Create 2 users** → Register testuser1 and testuser2
2. **Login both users** → Get USER1_TOKEN and USER2_TOKEN (save these!)
3. **User 1 creates conversation** → Get roomId (save this!)
4. **User 1 sends message** → Use USER1_TOKEN + roomId
5. **User 2 sends message** → Use USER2_TOKEN + SAME roomId
6. **Either user reads messages** → Use their token + roomId
7. **User 1 edits their message** → Use USER1_TOKEN + messageId (can only edit own messages)
8. **Check analytics** → Use either token + roomId

### Important: What to Save and Use

**From User Registration/Login (Steps 1-2):**
- `USER1_TOKEN` → JWT token from user 1 login response
- `USER2_TOKEN` → JWT token from user 2 login response
- `USER1_ID` → User ID from user 1 response (data.user.id) - **needed to create conversation**
- `USER2_ID` → User ID from user 2 response (data.user.id) - **needed to create conversation**

**From Conversation Creation (Step 3):**
- User 1 sends `participant2Id: USER2_ID` to invite User 2
- Gets back TWO IDs:
  - `roomId` → Room identifier (e.g., "room_1765838427706_ibh4giq02") - **USE THIS for sending messages!**
  - `id` → Database primary key (e.g., "cmj7qlv0c000f34roparusg08") - not used in URLs
- **Both users use the SAME `roomId` to send/receive messages**

**From Sending Messages (Steps 5-6):**
- `messageId` → Each message has unique ID for editing/deleting

**Key Rules:** 
- User 1 always uses USER1_TOKEN (proves they are User 1)
- User 2 always uses USER2_TOKEN (proves they are User 2)
- Both use the SAME `roomId` to chat with each other
- Use `roomId` (like "room_1765838427706_ibh4giq02"), NOT `id`
- `participant2Id` is only used when CREATING the conversation (to invite someone)

### Common Errors

**Error: "Foreign key constraint violated: messages_roomId_fkey"**
- **Cause:** You're using the wrong ID in the URL
- **Solution:** Use the `roomId` field (e.g., "room_1765838427706_ibh4giq02"), NOT the `id` field
- **Example:** 
  - ❌ Wrong: `/api/chat/conversations/cmj7qlv0c000f34roparusg08/messages` (this is the `id`)
  - ✅ Correct: `/api/chat/conversations/room_1765838427706_ibh4giq02/messages` (this is the `roomId`)

**Error: "Conversation not found" or "Access denied"**
- **Cause:** Using wrong token or conversation doesn't exist
- **Solution:** Make sure you're using a valid token and the conversation `id` exists

### Additional Features
- Upload routes are currently disabled (missing dependencies)
- WebSocket functionality available on same port for real-time messaging
- Service supports voice notes and images but upload endpoint is disabled
- Rate limiting: 1500 requests per 15 minutes per IP