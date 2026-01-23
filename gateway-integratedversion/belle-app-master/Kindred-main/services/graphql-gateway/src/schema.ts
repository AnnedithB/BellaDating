import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON

  type User {
    id: ID!
    email: String!
    username: String
    name: String
    bio: String
    age: Int
    gender: String
    interests: [String!]!
    location: String
    profilePicture: String
    photos: [String!]!
    isOnline: Boolean!
    lastSeen: DateTime
    isActive: Boolean!
    isVerified: Boolean!
    createdAt: DateTime
    updatedAt: DateTime
    profile: UserProfile
    sessions: [InteractionSession!]!
    messages: [ChatMessage!]!
    notifications: [Notification!]!
    connections: [Connection!]!
  }

  type UserProfile {
    id: ID!
    userId: ID!
    displayName: String
    bio: String
    location: String
    interests: [String!]
    profilePicture: String
    isPublic: Boolean
    showAge: Boolean
    showLocation: Boolean
    createdAt: DateTime
    updatedAt: DateTime
    user: User!
  }

  # Discovery/Matching Preferences
  type DiscoveryPreferences {
    id: ID!
    userId: ID!
    ageMin: Int!
    ageMax: Int!
    maxDistance: Int!
    interestedIn: String!
    connectionType: String!
    lookingFor: [String!]!
    showOnDiscovery: Boolean!
    updatedAt: DateTime
  }

  type InteractionSession {
    id: ID!
    user1Id: ID!
    user2Id: ID!
    type: String!
    status: String!
    startedAt: DateTime!
    endedAt: DateTime
    metadata: JSON
    user1: User!
    user2: User!
    messages: [ChatMessage!]!
    duration: Int
  }

  type ChatMessage {
    id: ID!
    sessionId: ID!
    senderId: ID!
    content: String!
    messageType: String!
    metadata: JSON
    sentAt: DateTime!
    deliveredAt: DateTime
    readAt: DateTime
    session: InteractionSession!
    sender: User!
    isDelivered: Boolean!
    isRead: Boolean!
  }

  type Notification {
    id: ID!
    userId: ID!
    title: String!
    message: String!
    type: String!
    data: JSON
    read: Boolean!
    createdAt: DateTime
    user: User!
  }

  type UserReport {
    id: ID!
    reporterId: ID!
    reportedUserId: ID!
    sessionId: ID
    reason: String!
    description: String
    status: String!
    priority: String!
    createdAt: DateTime
    reporter: User!
    reportedUser: User!
    session: InteractionSession
  }

  type QueueStatus {
    userId: ID!
    status: String!
    position: Int
    estimatedWaitTime: Int
    preferences: JSON
    joinedAt: DateTime!
    user: User!
  }

  type Connection {
    id: ID!
    user1Id: ID!
    user2Id: ID!
    connectionType: String!
    status: String!
    matchScore: Float
    createdAt: DateTime
    user1: User!
    user2: User!
  }

  type AuthPayload {
    token: String!
    user: User!
    expiresIn: String!
  }

  type MatchResult {
    matched: Boolean!
    partner: User
    session: InteractionSession
    queueStatus: QueueStatus
  }

  type Analytics {
    totalUsers: Int!
    activeUsers: Int!
    totalSessions: Int!
    averageSessionDuration: Float!
    popularInterests: [String!]!
    userGrowth: [UserGrowthData!]!
    sessionMetrics: SessionMetrics!
  }

  type UserGrowthData {
    date: DateTime!
    newUsers: Int!
    totalUsers: Int!
  }

  type SessionMetrics {
    totalSessions: Int!
    completedSessions: Int!
    averageDuration: Float!
    successfulMatches: Int!
  }

  # Input Types
  input UserInput {
    email: String!
    username: String
    password: String!
    name: String
    age: Int
    gender: String
    interests: [String!]
    location: String
  }

  input UserUpdateInput {
    name: String
    bio: String
    age: Int
    gender: String
    interests: [String!]
    location: String
    profilePicture: String
  }

  input ProfileUpdateInput {
    displayName: String
    bio: String
    location: String
    interests: [String!]
    profilePicture: String
    isPublic: Boolean
    showAge: Boolean
    showLocation: Boolean
  }

  input QueuePreferences {
    ageRange: AgeRangeInput
    genderPreference: String
    interests: [String!]
    location: String
    maxDistance: Int
  }

  input AgeRangeInput {
    min: Int!
    max: Int!
  }

  input MessageInput {
    sessionId: ID!
    content: String!
    messageType: String!
    metadata: JSON
  }

  input ReportInput {
    reportedUserId: ID!
    sessionId: ID
    reason: String!
    description: String
  }

  input NotificationPreferences {
    pushEnabled: Boolean!
    emailEnabled: Boolean!
    smsEnabled: Boolean!
    types: [String!]!
  }

  input DiscoveryPreferencesInput {
    ageMin: Int
    ageMax: Int
    maxDistance: Int
    interestedIn: String
    connectionType: String
    lookingFor: [String!]
    showOnDiscovery: Boolean
  }

  # Queries
  type Query {
    # User queries
    me: User
    user(id: ID!): User
    users(limit: Int, offset: Int): [User!]!
    searchUsers(query: String!, limit: Int): [User!]!

    # Session queries
    myActiveSessions: [InteractionSession!]!
    session(id: ID!): InteractionSession
    sessionHistory(limit: Int, offset: Int): [InteractionSession!]!

    # Message queries
    sessionMessages(sessionId: ID!, limit: Int, offset: Int): [ChatMessage!]!
    messageHistory(userId: ID, limit: Int, offset: Int): [ChatMessage!]!

    # Queue queries
    queueStatus: QueueStatus
    queueStatistics: JSON

    # Notification queries
    notifications(limit: Int, offset: Int): [Notification!]
    unreadNotifications: [Notification!]

    # Analytics queries (admin only)
    analytics(period: String): Analytics
    userAnalytics(userId: ID!): JSON

    # Safety queries
    myReports: [UserReport!]
    reportsAgainstMe: [UserReport!]

    # Connection queries
    myConnections: [Connection!]
    connectionSuggestions(limit: Int): [User!]

    # Discovery preferences
    myDiscoveryPreferences: DiscoveryPreferences
  }

  type PasswordResetResponse {
    success: Boolean!
    message: String!
  }

  # Mutations
  type Mutation {
    # Authentication
    register(input: UserInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    logout: Boolean!
    refreshToken: AuthPayload!
    forgotPassword(email: String!): PasswordResetResponse!
    resetPassword(token: String!, password: String!): PasswordResetResponse!

    # User management
    updateProfile(input: UserUpdateInput!): User!
    updateProfileSettings(input: ProfileUpdateInput!): UserProfile!
    deactivateAccount: Boolean!
    deleteAccount: Boolean!

    # Queue management
    joinQueue(preferences: QueuePreferences): QueueStatus!
    leaveQueue: Boolean!
    updateQueuePreferences(preferences: QueuePreferences!): QueueStatus!

    # Session management
    startSession(partnerId: ID!): InteractionSession!
    endSession(sessionId: ID!): Boolean!
    reportTechnicalIssue(sessionId: ID!, issue: String!): Boolean!

    # Messaging
    sendMessage(input: MessageInput!): ChatMessage!
    markMessageAsRead(messageId: ID!): Boolean!
    markSessionAsRead(sessionId: ID!): Boolean!

    # Notifications
    markNotificationAsRead(notificationId: ID!): Boolean!
    markAllNotificationsAsRead: Boolean!
    updateNotificationPreferences(preferences: NotificationPreferences!): Boolean!

    # Safety & Reporting
    reportUser(input: ReportInput!): UserReport!
    blockUser(userId: ID!): Boolean!
    unblockUser(userId: ID!): Boolean!

    # Connections
    sendConnectionRequest(userId: ID!): Connection!
    respondToConnectionRequest(connectionId: ID!, accept: Boolean!): Connection!
    removeConnection(connectionId: ID!): Boolean!

    # Discovery preferences
    updateDiscoveryPreferences(input: DiscoveryPreferencesInput!): DiscoveryPreferences!

    # Admin mutations (admin only)
    banUser(userId: ID!, reason: String!): Boolean!
    unbanUser(userId: ID!): Boolean!
    resolveReport(reportId: ID!, resolution: String!): UserReport!
  }

  # Subscriptions
  type Subscription {
    # Real-time messaging
    messageReceived(sessionId: ID!): ChatMessage!
    sessionUpdated(sessionId: ID!): InteractionSession!

    # Queue updates
    queueStatusUpdated: QueueStatus!
    matchFound: MatchResult!

    # Notifications
    notificationReceived: Notification!

    # Connection updates
    connectionRequestReceived: Connection!
    connectionStatusChanged: Connection!
  }
`;

export default typeDefs;