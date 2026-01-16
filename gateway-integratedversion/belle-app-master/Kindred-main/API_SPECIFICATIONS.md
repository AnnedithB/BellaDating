# API Specifications

## Overview

This document defines all RESTful endpoints and WebSocket events for the Real-time Connect backend services. All APIs follow consistent response patterns and error handling.

## Global Response Format

### Success Response
```json
{
  "status": "success",
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-here"
  }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Human readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details (optional)
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-here"
  }
}
```

### Standard HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity (business logic error)
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

---

## User Service API (`localhost:3001`)

### Authentication Endpoints

#### POST `/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "username": "string (3-50 chars, alphanumeric + underscore)",
  "email": "string (valid email)",
  "password": "string (min 8 chars)",
  "role": "male | female"
}
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "role": "male | female",
      "emailVerified": false,
      "createdAt": "ISO 8601 timestamp"
    },
    "token": "JWT token",
    "expiresIn": "24h"
  }
}
```

**Errors:**
- `409` - Username or email already exists
- `400` - Validation errors

#### POST `/auth/login`
Authenticate user and return JWT token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "role": "male | female",
      "emailVerified": boolean
    },
    "token": "JWT token",
    "expiresIn": "24h"
  }
}
```

**Errors:**
- `401` - Invalid credentials
- `403` - Account inactive

#### GET `/auth/me`
Get current user information (requires JWT).

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "role": "male | female",
      "emailVerified": boolean,
      "lastLogin": "ISO 8601 timestamp"
    },
    "profile": {
      "id": "uuid",
      "displayName": "string",
      "shortBio": "string",
      "photos": ["url1", "url2"],
      "videos": ["url1"],
      "intent": "casual | friends | serious | networking",
      "age": number,
      "locationCity": "string",
      "locationCountry": "string"
    }
  }
}
```

#### POST `/auth/logout`
Invalidate current JWT token.

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "message": "Successfully logged out"
  }
}
```

### Profile Management Endpoints

#### GET `/profile`
Get current user's profile (requires JWT).

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "profile": {
      "id": "uuid",
      "displayName": "string",
      "shortBio": "string",
      "photos": ["url1", "url2"],
      "videos": ["url1"],
      "intent": "casual | friends | serious | networking",
      "age": number,
      "locationCity": "string",
      "locationCountry": "string",
      "preferences": {},
      "updatedAt": "ISO 8601 timestamp"
    }
  }
}
```

#### PUT `/profile`
Update user profile (requires JWT).

**Request Body:**
```json
{
  "displayName": "string (optional)",
  "shortBio": "string (optional, max 500 chars)",
  "intent": "casual | friends | serious | networking (optional)",
  "age": "number (optional, 18-100)",
  "locationCity": "string (optional)",
  "locationCountry": "string (optional)",
  "preferences": "object (optional)"
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "profile": {
      // Updated profile object
    }
  }
}
```

#### POST `/profile/upload`
Upload profile photos or videos (requires JWT).

**Request:**
- Content-Type: `multipart/form-data`
- Field: `file` (image or video file)
- Field: `type` ("photo" | "video")

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "url": "https://cdn.example.com/uploads/uuid.jpg",
    "type": "photo | video",
    "uploadedAt": "ISO 8601 timestamp"
  }
}
```

#### DELETE `/profile/media/{mediaId}`
Remove a photo or video from profile.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "message": "Media removed successfully"
  }
}
```

---

## Queuing Service API (`localhost:3002`)

### REST Endpoints

#### GET `/queue/status`
Get current queue status and user's position (requires JWT).

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "userStatus": "online | offline | queuing | in-call",
    "queuePosition": number,
    "estimatedWaitTime": "number (seconds)",
    "intent": "casual | friends | serious | networking",
    "totalInQueue": number
  }
}
```

### WebSocket Events (Socket.IO)

**Connection URL:** `ws://localhost:3002`

#### Client → Server Events

##### `authenticate`
Authenticate WebSocket connection with JWT.

**Payload:**
```json
{
  "token": "JWT token"
}
```

##### `join-queue`
Join the matching queue with specified intent.

**Payload:**
```json
{
  "intent": "casual | friends | serious | networking"
}
```

##### `leave-queue`
Leave the current queue.

**Payload:**
```json
{}
```

##### `update-status`
Update user presence status.

**Payload:**
```json
{
  "status": "online | offline | in-call"
}
```

#### Server → Client Events

##### `authenticated`
Confirmation of successful authentication.

**Payload:**
```json
{
  "userId": "uuid",
  "status": "online"
}
```

##### `queue-joined`
Confirmation of joining queue.

**Payload:**
```json
{
  "intent": "casual",
  "position": 3,
  "estimatedWaitTime": 45
}
```

##### `queue-left`
Confirmation of leaving queue.

**Payload:**
```json
{
  "reason": "user_action | match_found | timeout"
}
```

##### `status-updated`
User status change confirmation.

**Payload:**
```json
{
  "status": "online | offline | in-call | queuing",
  "timestamp": "ISO 8601 timestamp"
}
```

##### `error`
Error notification.

**Payload:**
```json
{
  "code": "ERROR_CODE",
  "message": "Error description"
}
```

---

## Interaction Service API (`localhost:3003`)

### REST Endpoints

#### POST `/api/interactions/connect`
Create permanent connection (female users only, requires JWT).

**Request Body:**
```json
{
  "interactionLogId": "uuid"
}
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "connection": {
      "id": "uuid",
      "partnerId": "uuid",
      "partnerProfile": {
        "displayName": "string",
        "photos": ["url1"]
      },
      "connectionType": "chat_only",
      "createdAt": "ISO 8601 timestamp"
    }
  }
}
```

**Errors:**
- `403` - Only female users can create connections
- `404` - Interaction log not found
- `409` - Connection already exists

#### POST `/api/interactions/request-video`
Request video call in existing connection (requires JWT).

**Request Body:**
```json
{
  "connectionId": "uuid"
}
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "videoRequest": {
      "id": "uuid",
      "connectionId": "uuid",
      "status": "pending",
      "expiresAt": "ISO 8601 timestamp"
    }
  }
}
```

#### PUT `/api/interactions/video-request/{requestId}`
Approve or reject video request (female users only).

**Request Body:**
```json
{
  "action": "approve | reject"
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "videoRequest": {
      "id": "uuid",
      "status": "approved | rejected",
      "respondedAt": "ISO 8601 timestamp"
    }
  }
}
```

### WebSocket Events (Socket.IO)

**Connection URL:** `ws://localhost:3003`

#### Client → Server Events

##### `authenticate`
Authenticate WebSocket connection.

**Payload:**
```json
{
  "token": "JWT token"
}
```

##### `offer`
Send WebRTC offer to peer in room.

**Payload:**
```json
{
  "roomId": "string",
  "offer": "WebRTC SDP offer"
}
```

##### `answer`
Send WebRTC answer to peer in room.

**Payload:**
```json
{
  "roomId": "string",
  "answer": "WebRTC SDP answer"
}
```

##### `ice-candidate`
Send ICE candidate to peer.

**Payload:**
```json
{
  "roomId": "string",
  "candidate": "ICE candidate object"
}
```

##### `leave-room`
Leave current interaction room.

**Payload:**
```json
{
  "roomId": "string"
}
```

#### Server → Client Events

##### `found-match`
Notification of successful match.

**Payload:**
```json
{
  "roomId": "uuid",
  "partnerId": "uuid",
  "partnerProfile": {
    "displayName": "string",
    "photos": ["url1"],
    "age": number
  },
  "callDuration": 180,
  "interactionLogId": "uuid"
}
```

##### `offer-received`
Received WebRTC offer from peer.

**Payload:**
```json
{
  "roomId": "string",
  "offer": "WebRTC SDP offer",
  "from": "uuid"
}
```

##### `answer-received`
Received WebRTC answer from peer.

**Payload:**
```json
{
  "roomId": "string",
  "answer": "WebRTC SDP answer",
  "from": "uuid"
}
```

##### `ice-candidate-received`
Received ICE candidate from peer.

**Payload:**
```json
{
  "roomId": "string",
  "candidate": "ICE candidate object",
  "from": "uuid"
}
```

##### `call-ended`
Call timer expired or ended.

**Payload:**
```json
{
  "roomId": "string",
  "reason": "timeout | user_left | error",
  "duration": number,
  "interactionLogId": "uuid"
}
```

##### `peer-left`
Other user left the room.

**Payload:**
```json
{
  "roomId": "string",
  "userId": "uuid"
}
```

---

## History Service API (`localhost:3004`)

### REST Endpoints

#### GET `/api/history/interactions`
Get user's interaction history (requires JWT).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `outcome` (optional): Filter by outcome

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "interactions": [
      {
        "id": "uuid",
        "partnerId": "uuid",
        "partnerProfile": {
          "displayName": "string",
          "photos": ["url1"]
        },
        "interactionType": "voice_call | video_call",
        "startedAt": "ISO 8601 timestamp",
        "endedAt": "ISO 8601 timestamp",
        "duration": number,
        "outcome": "no_action | female_connected | both_left | timeout"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

#### GET `/api/history/connections`
Get user's established connections (requires JWT).

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `active` (optional): Filter by active status

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "connections": [
      {
        "id": "uuid",
        "partnerId": "uuid",
        "partnerProfile": {
          "displayName": "string",
          "photos": ["url1"]
        },
        "connectionType": "chat_only | video_enabled",
        "isActive": true,
        "createdAt": "ISO 8601 timestamp",
        "lastActivity": "ISO 8601 timestamp"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

#### POST `/api/history/log-interaction`
Log interaction (internal service call).

**Request Body:**
```json
{
  "user1Id": "uuid",
  "user2Id": "uuid",
  "roomId": "string",
  "interactionType": "voice_call | video_call",
  "startedAt": "ISO 8601 timestamp",
  "endedAt": "ISO 8601 timestamp",
  "outcome": "no_action | female_connected | both_left | timeout",
  "femaleUserId": "uuid",
  "metadata": {}
}
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "interactionLog": {
      "id": "uuid",
      "createdAt": "ISO 8601 timestamp"
    }
  }
}
```

---

## Communication Service API (`localhost:3005`)

### REST Endpoints

#### GET `/api/chat/rooms`
Get user's chat rooms (requires JWT).

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "chatRooms": [
      {
        "id": "uuid",
        "connectionId": "uuid",
        "roomName": "string",
        "partnerId": "uuid",
        "partnerProfile": {
          "displayName": "string",
          "photos": ["url1"]
        },
        "lastMessage": {
          "content": "string",
          "sentAt": "ISO 8601 timestamp",
          "senderId": "uuid"
        },
        "unreadCount": number
      }
    ]
  }
}
```

#### GET `/api/chat/rooms/{roomId}/messages`
Get message history for a chat room (requires JWT).

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Messages per page (default: 50)
- `before` (optional): Get messages before timestamp

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "uuid",
        "senderId": "uuid",
        "content": "string",
        "messageType": "text | image | video | voice | system",
        "metadata": {},
        "isEdited": false,
        "createdAt": "ISO 8601 timestamp",
        "readStatus": {
          "isRead": boolean,
          "readAt": "ISO 8601 timestamp"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "hasMore": true
    }
  }
}
```

#### POST `/api/chat/rooms/{roomId}/read`
Mark messages as read (requires JWT).

**Request Body:**
```json
{
  "messageIds": ["uuid1", "uuid2"]
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "markedAsRead": number
  }
}
```

### WebSocket Events (Socket.IO)

**Connection URL:** `ws://localhost:3005/chat`

#### Client → Server Events

##### `authenticate`
Authenticate WebSocket connection.

**Payload:**
```json
{
  "token": "JWT token"
}
```

##### `join-room`
Join a chat room.

**Payload:**
```json
{
  "roomName": "string"
}
```

##### `leave-room`
Leave a chat room.

**Payload:**
```json
{
  "roomName": "string"
}
```

##### `send-message`
Send a message to the room.

**Payload:**
```json
{
  "roomName": "string",
  "content": "string",
  "messageType": "text | image | video | voice",
  "metadata": {}
}
```

##### `typing-start`
Indicate user is typing.

**Payload:**
```json
{
  "roomName": "string"
}
```

##### `typing-stop`
Indicate user stopped typing.

**Payload:**
```json
{
  "roomName": "string"
}
```

#### Server → Client Events

##### `room-joined`
Confirmation of joining room.

**Payload:**
```json
{
  "roomName": "string",
  "partnerId": "uuid"
}
```

##### `message-received`
New message in room.

**Payload:**
```json
{
  "roomName": "string",
  "message": {
    "id": "uuid",
    "senderId": "uuid",
    "content": "string",
    "messageType": "text | image | video | voice | system",
    "metadata": {},
    "createdAt": "ISO 8601 timestamp"
  }
}
```

##### `typing-indicator`
Partner typing status.

**Payload:**
```json
{
  "roomName": "string",
  "userId": "uuid",
  "isTyping": boolean
}
```

##### `user-online`
Partner came online.

**Payload:**
```json
{
  "roomName": "string",
  "userId": "uuid"
}
```

##### `user-offline`
Partner went offline.

**Payload:**
```json
{
  "roomName": "string",
  "userId": "uuid"
}
```

---

## Rate Limiting

All services implement rate limiting:

- **Authentication endpoints**: 5 requests per minute per IP
- **File upload endpoints**: 10 requests per hour per user
- **General API endpoints**: 100 requests per minute per user
- **WebSocket connections**: 1 connection per user per service

Rate limit headers included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642234567
```

## Error Codes

### User Service
- `USER_NOT_FOUND` - User does not exist
- `INVALID_CREDENTIALS` - Wrong email/password
- `USERNAME_TAKEN` - Username already in use
- `EMAIL_TAKEN` - Email already registered
- `PROFILE_NOT_FOUND` - User profile not found
- `UPLOAD_FAILED` - File upload failed

### Queuing Service
- `ALREADY_IN_QUEUE` - User already queued
- `NOT_IN_QUEUE` - User not in any queue
- `INVALID_INTENT` - Invalid intent specified
- `QUEUE_FULL` - Queue at capacity

### Interaction Service
- `ROOM_NOT_FOUND` - Interaction room not found
- `NOT_AUTHORIZED` - Insufficient permissions
- `ALREADY_CONNECTED` - Connection already exists
- `REQUEST_EXPIRED` - Video request expired
- `INVALID_ROOM_STATE` - Room in invalid state

### History Service
- `INTERACTION_NOT_FOUND` - Interaction log not found
- `CONNECTION_NOT_FOUND` - Connection not found
- `ACCESS_DENIED` - Cannot access other user's data

### Communication Service
- `ROOM_NOT_FOUND` - Chat room not found
- `MESSAGE_NOT_FOUND` - Message not found
- `NOT_ROOM_MEMBER` - User not in chat room
- `MESSAGE_TOO_LONG` - Message exceeds length limit

### Admin/Customer Support Service
- `TICKET_NOT_FOUND` - Support ticket not found
- `ARTICLE_NOT_FOUND` - Knowledge base article not found
- `PERMISSION_DENIED` - Insufficient admin permissions
- `FILE_UPLOAD_FAILED` - File attachment failed
- `INVALID_TICKET_STATUS` - Invalid status transition
- `ASSIGNMENT_FAILED` - Cannot assign ticket
- `EMAIL_MISMATCH` - Customer email does not match ticket

---

## Admin/Customer Support Service API (`localhost:3007`)

### Admin Support Tickets Management

#### GET `/api/support-tickets`
Get all support tickets with filtering (requires admin auth).

**Headers:**
```
Authorization: Bearer {ADMIN_JWT_TOKEN}
```

**Query Parameters:**
- `status` (optional): Filter by status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
- `priority` (optional): Filter by priority (LOW, MEDIUM, HIGH, URGENT)
- `category` (optional): Filter by category (GENERAL, TECHNICAL, BILLING, ACCOUNT, CONTENT, SAFETY)
- `assignedTo` (optional): Filter by assigned admin ID
- `search` (optional): Search in title, description, or ticket number
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response (200):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "ticketNumber": "TIK-1234567890-ABC12",
      "title": "Login Issues",
      "description": "Cannot log into my account",
      "category": "ACCOUNT",
      "priority": "HIGH",
      "status": "OPEN",
      "userEmail": "user@example.com",
      "userName": "John Doe",
      "assignedToId": "admin-uuid",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "lastActivityAt": "2024-01-01T00:00:00Z",
      "assignedTo": {
        "id": "admin-uuid",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@company.com"
      },
      "_count": {
        "comments": 3,
        "attachments": 1
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### POST `/api/support-tickets`
Create new support ticket (admin only).

**Request Body:**
```json
{
  "title": "Customer Issue Title",
  "description": "Detailed description of the issue",
  "category": "TECHNICAL",
  "priority": "HIGH",
  "userEmail": "customer@example.com",
  "userName": "Customer Name",
  "assignedToId": "admin-uuid"
}
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "ticketNumber": "TIK-1234567890-ABC12",
    "title": "Customer Issue Title",
    "status": "OPEN",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### PATCH `/api/support-tickets/{id}/status`
Update ticket status.

**Request Body:**
```json
{
  "status": "RESOLVED",
  "resolutionNote": "Issue resolved by clearing cache"
}
```

#### POST `/api/support-tickets/{id}/assign`
Assign ticket to admin.

**Request Body:**
```json
{
  "assignedToId": "admin-uuid"
}
```

#### GET `/api/support-tickets/analytics/dashboard`
Get support analytics dashboard.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "overview": {
      "totalTickets": 1250,
      "openTickets": 45,
      "resolvedToday": 23,
      "avgResponseTime": 2.5,
      "avgResolutionTime": 24.3
    },
    "statusDistribution": [
      { "status": "OPEN", "count": 45 }
    ],
    "agentWorkload": [
      {
        "adminId": "uuid",
        "firstName": "John",
        "lastName": "Doe",
        "openTickets": 8,
        "avgResponseTime": 1.5
      }
    ]
  }
}
```

### Knowledge Base Management

#### GET `/api/knowledge-base`
Get knowledge base articles (admin).

#### POST `/api/knowledge-base`
Create new knowledge base article.

**Request Body:**
```json
{
  "title": "How to Reset Your Password",
  "content": "Step-by-step guide content in markdown...",
  "summary": "Quick guide to reset your account password",
  "category": "Account",
  "tags": ["password", "reset", "account"],
  "searchKeywords": ["password", "forgot", "reset", "login"],
  "isPublished": true
}
```

#### PATCH `/api/knowledge-base/{id}/publish`
Publish or unpublish article.

**Request Body:**
```json
{
  "isPublished": true
}
```

### Customer Support (Public API)

#### POST `/api/customer-support/submit`
Submit new support ticket (public).

**Request Body (multipart/form-data):**
```json
{
  "title": "Cannot access my account",
  "description": "I've been trying to log in but getting error messages",
  "category": "ACCOUNT",
  "priority": "MEDIUM",
  "userEmail": "customer@example.com",
  "userName": "John Customer"
}
```

**File Upload:** Use `attachments` field (max 5 files, 10MB each)

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "id": "ticket-uuid",
    "ticketNumber": "CUS-1234567890-ABC12",
    "title": "Cannot access my account",
    "status": "OPEN",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "message": "Ticket submitted successfully. You will receive an email confirmation shortly."
}
```

#### GET `/api/customer-support/status/{ticketNumber}`
Get ticket status by ticket number (public).

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "id": "ticket-uuid",
    "ticketNumber": "CUS-1234567890-ABC12",
    "title": "Cannot access my account",
    "category": "ACCOUNT",
    "priority": "MEDIUM",
    "status": "IN_PROGRESS",
    "createdAt": "2024-01-01T00:00:00Z",
    "comments": [
      {
        "id": "comment-uuid",
        "content": "Thank you for contacting us. We're looking into your issue.",
        "createdAt": "2024-01-01T02:00:00Z",
        "isFromCustomer": false
      }
    ]
  }
}
```

#### POST `/api/customer-support/{ticketNumber}/respond`
Add customer response to ticket.

**Request Body (multipart/form-data):**
```json
{
  "content": "I tried your suggestions but still having the same issue.",
  "customerEmail": "customer@example.com"
}
```

#### GET `/api/customer-support/help/articles`
Get published knowledge base articles (public).

**Query Parameters:**
- `category` (optional): Filter by category
- `search` (optional): Search articles
- `page` (optional): Page number
- `limit` (optional): Items per page (max 20)

**Response (200):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "article-uuid",
      "title": "How to Reset Your Password",
      "summary": "Step-by-step guide to reset your password",
      "category": "Account",
      "slug": "how-to-reset-your-password",
      "helpfulVotes": 45,
      "notHelpfulVotes": 3,
      "viewCount": 1250,
      "publishedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3,
    "categories": [
      { "category": "Account", "count": 8 }
    ]
  }
}
```

#### GET `/api/customer-support/categories`
Get available ticket categories (public).

**Response (200):**
```json
{
  "status": "success",
  "data": [
    {
      "value": "GENERAL",
      "label": "General Inquiry",
      "description": "General questions about our service"
    },
    {
      "value": "TECHNICAL",
      "label": "Technical Issue",
      "description": "App crashes, bugs, or technical problems"
    }
  ]
}
```