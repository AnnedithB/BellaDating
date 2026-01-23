# GraphQL Schema Reference - All Services

## Overview

This document shows the complete GraphQL schema that federates all 9 microservices. Use this as a reference for testing each service through the GraphQL Gateway.

---

## 1. User Service (Port 3001)

### Queries

#### Get Current User
```graphql
query GetMe {
  me {
    id
    email
    username
    phoneNumber
    dateOfBirth
    isVerified
    isActive
    createdAt
    updatedAt
  }
}
```

#### Get User by ID
```graphql
query GetUser($userId: ID!) {
  user(id: $userId) {
    id
    username
    profile {
      bio
      age
      gender
      interests
      location
      profilePicture
    }
    isOnline
    lastSeen
  }
}
```

#### Search Users
```graphql
query SearchUsers($query: String!, $limit: Int) {
  searchUsers(query: $query, limit: $limit) {
    id
    username
    profile {
      profilePicture
      bio
    }
  }
}
```

### Mutations

#### Register
```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    token
    user {
      id
      email
      username
    }
  }
}

# Variables
{
  "input": {
    "email": "user@example.com",
    "password": "Password123!",
    "username": "johndoe",
    "dateOfBirth": "1995-01-01"
  }
}
```

#### Login
```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user {
      id
      email
      username
    }
  }
}

# Variables
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

#### Update Profile
```graphql
mutation UpdateProfile($input: UpdateProfileInput!) {
  updateProfile(input: $input) {
    id
    profile {
      bio
      age
      gender
      interests
      location
      profilePicture
    }
  }
}

# Variables
{
  "input": {
    "bio": "Love hiking and music",
    "age": 28,
    "gender": "male",
    "interests": ["hiking", "music", "travel"],
    "location": "New York, NY"
  }
}
```

#### Update Settings
```graphql
mutation UpdateSettings($input: UpdateSettingsInput!) {
  updateSettings(input: $input) {
    id
    settings {
      notificationsEnabled
      emailNotifications
      pushNotifications
      showOnlineStatus
      discoverable
    }
  }
}

# Variables
{
  "input": {
    "notificationsEnabled": true,
    "showOnlineStatus": true,
    "discoverable": true
  }
}
```

---

## 2. Queuing Service (Port 3002)

### Queries

#### Get Queue Status
```graphql
query GetQueueStatus {
  myQueueStatus {
    inQueue
    position
    estimatedWaitTime
    preferences {
      ageRange {
        min
        max
      }
      interests
      distance
    }
  }
}
```

#### Get Match History
```graphql
query GetMatchHistory($limit: Int, $offset: Int) {
  myMatchHistory(limit: $limit, offset: $offset) {
    id
    matchedUser {
      id
      username
      profile {
        profilePicture
        age
      }
    }
    matchedAt
    status
  }
}
```

### Mutations

#### Join Queue
```graphql
mutation JoinQueue($input: JoinQueueInput!) {
  joinQueue(input: $input) {
    queueId
    position
    estimatedWaitTime
  }
}

# Variables
{
  "input": {
    "preferences": {
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

#### Leave Queue
```graphql
mutation LeaveQueue {
  leaveQueue {
    success
    message
  }
}
```

#### Update Queue Preferences
```graphql
mutation UpdateQueuePreferences($input: QueuePreferencesInput!) {
  updateQueuePreferences(input: $input) {
    success
    preferences {
      ageRange {
        min
        max
      }
      interests
      distance
    }
  }
}

# Variables
{
  "input": {
    "ageRange": {
      "min": 22,
      "max": 40
    },
    "interests": ["sports", "music", "food"],
    "distance": 100
  }
}
```

### Subscriptions

#### Match Found
```graphql
subscription OnMatchFound {
  matchFound {
    matchId
    matchedUser {
      id
      username
      profile {
        profilePicture
        bio
        age
      }
    }
    roomId
    expiresAt
  }
}
```

---

## 3. Interaction Service (Port 3003)

### Queries

#### Get Interaction Details
```graphql
query GetInteraction($id: ID!) {
  interaction(id: $id) {
    id
    roomId
    status
    callType
    startedAt
    endedAt
    duration
    videoEnabled
    qualityRating
    callEvents {
      id
      eventType
      timestamp
      metadata
    }
  }
}
```

#### Get User Interactions
```graphql
query GetUserInteractions($userId: ID!, $page: Int, $limit: Int) {
  userInteractions(userId: $userId, page: $page, limit: $limit) {
    interactions {
      id
      roomId
      status
      callType
      duration
      startedAt
    }
    pagination {
      page
      limit
      total
      pages
    }
  }
}
```

#### Get Interaction Stats
```graphql
query GetInteractionStats($startDate: DateTime, $endDate: DateTime) {
  interactionStats(startDate: $startDate, endDate: $endDate) {
    totalInteractions
    completedInteractions
    videoInteractions
    completionRate
    videoAdoptionRate
    averageDuration
  }
}
```

### Mutations

#### Rate Interaction
```graphql
mutation RateInteraction($id: ID!, $input: RateInteractionInput!) {
  rateInteraction(id: $id, input: $input) {
    id
    qualityRating
    connectionIssues
  }
}

# Variables
{
  "id": "interaction123",
  "input": {
    "qualityRating": 5,
    "connectionIssues": false
  }
}
```

---

## 4. History Service (Port 3004)

### Queries

#### Get Session History
```graphql
query GetSessionHistory($userId: ID!, $page: Int, $limit: Int) {
  sessionHistory(userId: $userId, page: $page, limit: $limit) {
    sessions {
      id
      sessionId
      type
      status
      startedAt
      endedAt
      duration
    }
    pagination {
      page
      limit
      total
      pages
    }
  }
}
```

#### Get User Analytics
```graphql
query GetUserAnalytics($userId: ID!) {
  userAnalytics(userId: $userId) {
    userId
    totalSessions
    totalDuration
    avgSessionLength
    completedSessions
    skippedSessions
    reportsReceived
    reportsMade
  }
}
```

#### Get Chat Messages
```graphql
query GetChatMessages($sessionId: ID!, $limit: Int) {
  chatMessages(sessionId: $sessionId, limit: $limit) {
    id
    content
    messageType
    senderId
    timestamp
    isModerated
    toxicityScore
  }
}
```

### Mutations

#### Submit Report
```graphql
mutation SubmitReport($input: ReportInput!) {
  submitReport(input: $input) {
    id
    reportType
    status
    severity
    createdAt
  }
}

# Variables
{
  "input": {
    "reporterId": "user123",
    "reportedUserId": "user456",
    "reportType": "INAPPROPRIATE_CONTENT",
    "reason": "Inappropriate behavior",
    "description": "User was being inappropriate during call"
  }
}
```

---

## 5. Communication Service (Port 3005)

### Queries

#### Get Chat Room
```graphql
query GetChatRoom($roomId: ID!) {
  chatRoom(roomId: $roomId) {
    id
    roomId
    type
    participants {
      userId
      role
      lastReadAt
      notificationsEnabled
    }
    lastActivity
    isActive
  }
}
```

#### Get Messages
```graphql
query GetMessages($roomId: ID!, $limit: Int, $before: DateTime) {
  messages(roomId: $roomId, limit: $limit, before: $before) {
    id
    messageId
    content
    messageType
    senderId
    timestamp
    isRead
    isDelivered
    voiceUrl
    imageUrl
    reactions {
      emoji
      userId
    }
  }
}
```

#### Get My Conversations
```graphql
query GetMyConversations {
  myConversations {
    id
    roomId
    participants {
      userId
      username
      profilePicture
      isOnline
    }
    lastMessage {
      content
      timestamp
    }
    unreadCount
    lastActivity
  }
}
```

### Mutations

#### Send Message
```graphql
mutation SendMessage($input: SendMessageInput!) {
  sendMessage(input: $input) {
    id
    messageId
    content
    messageType
    timestamp
    deliveryStatus
  }
}

# Variables
{
  "input": {
    "roomId": "room123",
    "content": "Hey! How are you?",
    "messageType": "TEXT"
  }
}
```

#### Send Voice Note
```graphql
mutation SendVoiceNote($input: VoiceNoteInput!) {
  sendVoiceNote(input: $input) {
    id
    messageId
    voiceUrl
    voiceDuration
    timestamp
  }
}

# Variables
{
  "input": {
    "roomId": "room123",
    "voiceUrl": "https://storage.example.com/voice123.webm",
    "duration": 15
  }
}
```

#### Mark as Read
```graphql
mutation MarkAsRead($messageIds: [ID!]!) {
  markAsRead(messageIds: $messageIds) {
    success
    count
  }
}

# Variables
{
  "messageIds": ["msg123", "msg124", "msg125"]
}
```

#### React to Message
```graphql
mutation ReactToMessage($messageId: ID!, $emoji: String!) {
  reactToMessage(messageId: $messageId, emoji: $emoji) {
    id
    reactions {
      emoji
      userId
      createdAt
    }
  }
}

# Variables
{
  "messageId": "msg123",
  "emoji": "❤️"
}
```

### Subscriptions

#### New Message
```graphql
subscription OnNewMessage($roomId: ID!) {
  messageReceived(roomId: $roomId) {
    id
    content
    messageType
    sender {
      id
      username
      profilePicture
    }
    timestamp
  }
}
```

#### User Typing
```graphql
subscription OnUserTyping($roomId: ID!) {
  userTyping(roomId: $roomId) {
    userId
    username
    isTyping
  }
}
```

---

## 6. Notification Service (Port 3006)

### Queries

#### Get My Notifications
```graphql
query GetMyNotifications($unreadOnly: Boolean, $page: Int, $limit: Int) {
  myNotifications(unreadOnly: $unreadOnly, page: $page, limit: $limit) {
    notifications {
      id
      type
      title
      message
      data
      isRead
      createdAt
    }
    pagination {
      page
      limit
      total
      unreadCount
    }
  }
}
```

#### Get Notification Settings
```graphql
query GetNotificationSettings {
  notificationSettings {
    pushEnabled
    emailEnabled
    smsEnabled
    matchNotifications
    messageNotifications
    likeNotifications
  }
}
```

### Mutations

#### Register Device
```graphql
mutation RegisterDevice($input: RegisterDeviceInput!) {
  registerDevice(input: $input) {
    id
    deviceToken
    platform
    registered
  }
}

# Variables
{
  "input": {
    "deviceToken": "fcm-token-here",
    "platform": "android"
  }
}
```

#### Mark Notification as Read
```graphql
mutation MarkNotificationRead($notificationId: ID!) {
  markNotificationRead(notificationId: $notificationId) {
    id
    isRead
    readAt
  }
}

# Variables
{
  "notificationId": "notif123"
}
```

#### Update Notification Settings
```graphql
mutation UpdateNotificationSettings($input: NotificationSettingsInput!) {
  updateNotificationSettings(input: $input) {
    pushEnabled
    emailEnabled
    matchNotifications
    messageNotifications
  }
}

# Variables
{
  "input": {
    "pushEnabled": true,
    "emailEnabled": false,
    "matchNotifications": true,
    "messageNotifications": true
  }
}
```

### Subscriptions

#### New Notification
```graphql
subscription OnNewNotification {
  notificationReceived {
    id
    type
    title
    message
    data
    createdAt
  }
}
```

---

## 7. Moderation Service (Port 3007)

### Queries

#### Get Moderation History
```graphql
query GetModerationHistory($userId: ID!, $page: Int, $limit: Int) {
  moderationHistory(userId: $userId, page: $page, limit: $limit) {
    history {
      id
      contentType
      content
      approved
      toxicityScore
      categories
      moderatedAt
    }
    pagination {
      page
      limit
      total
    }
  }
}
```

### Mutations

#### Moderate Text
```graphql
mutation ModerateText($input: ModerateTextInput!) {
  moderateText(input: $input) {
    approved
    toxicityScore
    categories {
      toxic
      severe_toxic
      obscene
      threat
      insult
      identity_hate
    }
    flaggedWords
  }
}

# Variables
{
  "input": {
    "content": "This is some text to moderate",
    "contentType": "text",
    "userId": "user123"
  }
}
```

#### Moderate Image
```graphql
mutation ModerateImage($input: ModerateImageInput!) {
  moderateImage(input: $input) {
    approved
    labels
    moderationCategories {
      explicit
      suggestive
      violence
      visually_disturbing
    }
    confidence
  }
}

# Variables
{
  "input": {
    "imageUrl": "https://example.com/image.jpg",
    "userId": "user123"
  }
}
```

---

## 8. Subscription Service (Port 3010)

### Queries

#### Get Subscription Plans
```graphql
query GetPlans {
  subscriptionPlans {
    id
    name
    price
    interval
    features
    description
    isPopular
  }
}
```

#### Get My Subscription
```graphql
query GetMySubscription {
  mySubscription {
    id
    tier
    status
    features
    currentPeriodStart
    currentPeriodEnd
    cancelAtPeriodEnd
  }
}
```

#### Check Feature Access
```graphql
query CheckFeatureAccess($feature: String!) {
  hasFeatureAccess(feature: $feature) {
    hasAccess
    feature
    tier
    reason
  }
}

# Variables
{
  "feature": "unlimited_swipes"
}
```

### Mutations

#### Subscribe
```graphql
mutation Subscribe($input: SubscribeInput!) {
  subscribe(input: $input) {
    id
    tier
    status
    features
    expiresAt
  }
}

# Variables
{
  "input": {
    "planId": "premium-monthly",
    "paymentMethod": "stripe"
  }
}
```

#### Cancel Subscription
```graphql
mutation CancelSubscription {
  cancelSubscription {
    id
    status
    cancelAtPeriodEnd
    currentPeriodEnd
  }
}
```

#### Update Payment Method
```graphql
mutation UpdatePaymentMethod($input: PaymentMethodInput!) {
  updatePaymentMethod(input: $input) {
    success
    paymentMethod {
      type
      last4
      expiryMonth
      expiryYear
    }
  }
}

# Variables
{
  "input": {
    "paymentMethodId": "pm_123456",
    "type": "card"
  }
}
```

---

## 9. Analytics Service (Port 3008)

### Queries

#### Get User Stats
```graphql
query GetUserStats($userId: ID!) {
  userStats(userId: $userId) {
    totalMatches
    activeConversations
    profileViews
    totalSwipes
    likesReceived
    likesSent
    averageResponseTime
    activeStreak
  }
}
```

#### Get Platform Analytics
```graphql
query GetPlatformAnalytics($startDate: DateTime!, $endDate: DateTime!) {
  platformAnalytics(startDate: $startDate, endDate: $endDate) {
    totalUsers
    activeUsers
    newUsers
    totalMatches
    totalMessages
    averageSessionDuration
    retentionRate
  }
}
```

---

## Complex Queries (Multiple Services)

### Dashboard Query
```graphql
query Dashboard {
  me {
    id
    username
    email
    profile {
      bio
      age
      profilePicture
      interests
    }
    stats {
      totalMatches
      activeConversations
      profileViews
    }
    subscription {
      tier
      features
      expiresAt
    }
  }
  
  myQueueStatus {
    inQueue
    position
  }
  
  recentMatches: myMatchHistory(limit: 5) {
    id
    matchedUser {
      username
      profile {
        profilePicture
        age
      }
    }
    matchedAt
  }
  
  myConversations {
    id
    participants {
      username
      isOnline
    }
    lastMessage {
      content
      timestamp
    }
    unreadCount
  }
  
  myNotifications(unreadOnly: true, limit: 10) {
    notifications {
      id
      type
      message
      createdAt
    }
  }
}
```

### User Profile with Everything
```graphql
query UserProfileComplete($userId: ID!) {
  user(id: $userId) {
    id
    username
    profile {
      bio
      age
      gender
      interests
      location
      profilePicture
    }
    isOnline
    lastSeen
    
    stats {
      totalMatches
      profileViews
    }
    
    subscription {
      tier
      features
    }
  }
  
  userAnalytics(userId: $userId) {
    totalSessions
    avgSessionLength
    completedSessions
  }
}
```

---

## Testing All Services - Complete Flow

### 1. Authentication
```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    user { id username }
  }
}
```

### 2. User Service
```graphql
query { me { id username profile { bio } } }
```

### 3. Queuing Service
```graphql
mutation JoinQueue($input: JoinQueueInput!) {
  joinQueue(input: $input) { queueId position }
}
```

### 4. Interaction Service
```graphql
query { interactionStats { totalInteractions } }
```

### 5. History Service
```graphql
query GetHistory($userId: ID!) {
  sessionHistory(userId: $userId) {
    sessions { id type duration }
  }
}
```

### 6. Communication Service
```graphql
mutation SendMessage($input: SendMessageInput!) {
  sendMessage(input: $input) { id content }
}
```

### 7. Notification Service
```graphql
query { myNotifications { notifications { id message } } }
```

### 8. Moderation Service
```graphql
mutation ModerateText($input: ModerateTextInput!) {
  moderateText(input: $input) { approved toxicityScore }
}
```

### 9. Subscription Service
```graphql
query { subscriptionPlans { id name price } }
```

---

## Summary

This schema reference covers all 9 microservices accessible through the GraphQL Gateway:

1. ✅ **User Service** - Authentication, profiles, settings
2. ✅ **Queuing Service** - Matching queue, preferences
3. ✅ **Interaction Service** - Call interactions, ratings
4. ✅ **History Service** - Session history, analytics, reports
5. ✅ **Communication Service** - Real-time messaging, chat rooms
6. ✅ **Notification Service** - Push notifications, settings
7. ✅ **Moderation Service** - Content moderation, safety
8. ✅ **Subscription Service** - Premium plans, payments
9. ✅ **Analytics Service** - User stats, platform metrics

**Single Endpoint:** `http://localhost:4000/graphql`  
**All Services:** Accessible through unified GraphQL API
