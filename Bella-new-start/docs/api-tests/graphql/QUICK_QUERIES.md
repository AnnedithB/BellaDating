# GraphQL Quick Test Queries - All Services

## 🚀 Quick Start

**GraphQL Endpoint:** `http://localhost:4000/graphql`

**Test in order:**
1. Register → 2. Login → 3. Get Token → 4. Test other services

---

## 1️⃣ User Service (Port 3001)

### Register User
```graphql
mutation {
  register(input: {
    email: "test@example.com"
    username: "testuser"
    password: "Test123!@#"
  }) {
    token
    user {
      id
      username
      email
    }
  }
}
```

### Login
```graphql
mutation {
  login(
    email: "test@example.com"
    password: "Test123!@#"
  ) {
    token
    user {
      id
      username
      email
    }
  }
}
```

### Get My Profile (Requires Token)
```graphql
query {
  me {
    id
    username
    email
    isOnline
    createdAt
  }
}
```

**Add to HTTP Headers:**
```json
{
  "Authorization": "Bearer YOUR_TOKEN_HERE"
}
```

### Update Profile
```graphql
mutation {
  updateProfile(input: {
    name: "John Doe"
    bio: "Love hiking and music"
    age: 28
    interests: ["hiking", "music", "travel"]
  }) {
    id
    name
    bio
    age
    interests
  }
}
```

---

## 2️⃣ Queuing Service (Port 3002)

### Join Queue
```graphql
mutation {
  joinQueue(preferences: {
    ageRange: {
      min: 25
      max: 35
    }
    interests: ["music", "travel"]
    maxDistance: 50
  }) {
    userId
    status
    position
    estimatedWaitTime
  }
}
```

### Check Queue Status
```graphql
query {
  queueStatus {
    userId
    status
    position
    estimatedWaitTime
    preferences
  }
}
```

### Leave Queue
```graphql
mutation {
  leaveQueue
}
```

---

## 3️⃣ Interaction Service (Port 3003)

### Get My Active Sessions
```graphql
query {
  myActiveSessions {
    id
    type
    status
    startedAt
    duration
  }
}
```

### Get Session History
```graphql
query {
  sessionHistory(limit: 10) {
    id
    type
    status
    startedAt
    endedAt
    duration
  }
}
```

### Get Session Details
```graphql
query {
  session(id: "session-id-here") {
    id
    type
    status
    startedAt
    endedAt
    duration
    metadata
  }
}
```

---

## 4️⃣ History Service (Port 3004)

### Get User Analytics
```graphql
query {
  userAnalytics(userId: "user-id-here")
}
```

**Response includes:**
- Total sessions
- Average session length
- Completed sessions
- Reports received/made

---

## 5️⃣ Communication Service (Port 3005)

### Send Message
```graphql
mutation {
  sendMessage(input: {
    sessionId: "session-id-here"
    content: "Hey! How are you?"
    messageType: "TEXT"
  }) {
    id
    content
    messageType
    sentAt
    isDelivered
  }
}
```

### Get Session Messages
```graphql
query {
  sessionMessages(sessionId: "session-id-here", limit: 50) {
    id
    content
    messageType
    sentAt
    isRead
    sender {
      id
      username
    }
  }
}
```

### Mark Message as Read
```graphql
mutation {
  markMessageAsRead(messageId: "message-id-here")
}
```

---

## 6️⃣ Notification Service (Port 3006)

### Get My Notifications
```graphql
query {
  notifications(limit: 20) {
    id
    title
    message
    type
    read
    createdAt
  }
}
```

### Get Unread Notifications
```graphql
query {
  unreadNotifications {
    id
    title
    message
    type
    createdAt
  }
}
```

### Mark Notification as Read
```graphql
mutation {
  markNotificationAsRead(notificationId: "notif-id-here")
}
```

### Mark All as Read
```graphql
mutation {
  markAllNotificationsAsRead
}
```

---

## 7️⃣ Moderation Service (Port 3007)

*Note: Moderation is typically called internally by other services, not directly via GraphQL*

---

## 8️⃣ Subscription Service (Port 3010)

*Note: Subscription queries would be added to the schema*

---

## 🎯 Complete Dashboard Query (All Services at Once!)

```graphql
query Dashboard {
  # User Service
  me {
    id
    username
    email
    isOnline
  }
  
  # Queuing Service
  queueStatus {
    status
    position
  }
  
  # Interaction Service
  myActiveSessions {
    id
    type
    status
  }
  
  # Communication Service
  sessionHistory(limit: 5) {
    id
    type
    startedAt
  }
  
  # Notification Service
  unreadNotifications {
    id
    message
    type
  }
}
```

---

## 🔥 Real-time Subscriptions

### Subscribe to New Messages
```graphql
subscription {
  messageReceived(sessionId: "session-id-here") {
    id
    content
    messageType
    sender {
      username
    }
    sentAt
  }
}
```

### Subscribe to Match Found
```graphql
subscription {
  matchFound {
    matched
    partner {
      id
      username
    }
    session {
      id
      type
    }
  }
}
```

### Subscribe to Notifications
```graphql
subscription {
  notificationReceived {
    id
    title
    message
    type
    createdAt
  }
}
```

---

## 📝 Testing Checklist

Use this order for complete testing:

- [ ] **1. Register** - Create new user
- [ ] **2. Login** - Get JWT token
- [ ] **3. Me Query** - Verify authentication works
- [ ] **4. Update Profile** - Test user mutations
- [ ] **5. Join Queue** - Test queuing service
- [ ] **6. Queue Status** - Check queue position
- [ ] **7. Get Sessions** - Test interaction service
- [ ] **8. Send Message** - Test communication service
- [ ] **9. Get Messages** - Verify message delivery
- [ ] **10. Get Notifications** - Test notification service
- [ ] **11. Dashboard Query** - Test multiple services at once
- [ ] **12. Subscriptions** - Test real-time updates

---

## 🛠️ Testing Tools

### Option 1: GraphQL Playground (Browser)
```
http://localhost:4000/graphql
```
- Visual interface
- Auto-completion
- Documentation explorer
- Easy to add headers

### Option 2: Postman
```
POST http://localhost:4000/graphql
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

Body:
{
  "query": "query { me { id username } }"
}
```

### Option 3: cURL
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query":"query { me { id username } }"}'
```

---

## 🎨 Variables Example

Instead of hardcoding values, use variables:

**Query:**
```graphql
mutation Register($input: UserInput!) {
  register(input: $input) {
    token
    user {
      id
      username
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "email": "test@example.com",
    "username": "testuser",
    "password": "Test123!@#"
  }
}
```

---

## 🚨 Common Errors

### "Unauthorized"
- Missing or invalid token
- Add: `Authorization: Bearer YOUR_TOKEN`

### "Not found"
- Service endpoint doesn't exist yet
- Check service is running: `docker ps`

### "Field not found"
- Field doesn't exist in schema
- Check schema in GraphQL Playground

---

## 📚 Full Documentation

For complete details, see:
- **GRAPHQL_SCHEMA_REFERENCE.md** - All queries/mutations for each service
- **POSTMAN_TESTING_GUIDE.md** - Step-by-step Postman guide
- **GRAPHQL_GATEWAY_GUIDE.md** - Complete GraphQL Gateway guide

---

**Happy Testing! 🚀**

All 9 services accessible through one endpoint: `http://localhost:4000/graphql`
