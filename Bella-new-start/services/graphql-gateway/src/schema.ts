export const typeDefs = `
  scalar DateTime
  scalar JSON

  type User {
    id: ID!
    email: String!
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
    isPhotoVerified: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    profile: UserProfile
    sessions: [InteractionSession!]!
    messages: [ChatMessage!]!
    notifications: [Notification!]!
    connections: [Connection!]!
    # Profile fields from user's profile
    educationLevel: String
    religion: String
    familyPlans: String
    hasKids: String
    languages: [String!]
    ethnicity: String
    politicalViews: String
    exercise: String
    smoking: String
    drinking: String
  }

  type UserProfile {
    id: ID!
    userId: ID!
    displayName: String
    bio: String
    location: String
    interests: [String!]!
    profilePicture: String
    isPublic: Boolean!
    showAge: Boolean!
    showLocation: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    user: User!
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
    voiceUrl: String
    voiceDuration: Int
    imageUrl: String
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
    createdAt: DateTime!
    user: User!
  }

  type PrivacySettings {
    showOnlineStatus: Boolean!
    sendReadReceipts: Boolean!
  }

  type NotificationSettings {
    all: Boolean!
    newMatches: Boolean!
    newMessages: Boolean!
    appPromotions: Boolean!
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
    createdAt: DateTime!
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
    createdAt: DateTime!
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

  type PhotoVerificationResult {
    success: Boolean!
    message: String!
    confidence: Float
    livenessDetected: Boolean!
  }

  type DiscoveryPreferences {
    id: ID!
    userId: ID!
    ageMin: Int
    ageMax: Int
    maxDistance: Int
    interestedIn: String
    connectionType: String
    lookingFor: [String!]!
    interests: [String!]!
    preferredEducationLevels: [String!]!
    preferredFamilyPlans: [String!]!
    preferredHasKids: [String!]!
    preferredReligions: [String!]!
    preferredPoliticalViews: [String!]!
    preferredDrinkingHabits: [String!]!
    preferredSmokingHabits: [String!]!
    heightMin: Int
    heightMax: Int
    updatedAt: DateTime!
  }

  type MatchAttempt {
    id: ID!
    user1Id: ID!
    user2Id: ID!
    status: String!
    totalScore: Float!
    ageScore: Float
    locationScore: Float
    interestScore: Float
    languageScore: Float
    ethnicityScore: Float
    genderCompatScore: Float
    relationshipIntentScore: Float
    familyPlansScore: Float
    religionScore: Float
    educationScore: Float
    politicalScore: Float
    lifestyleScore: Float
    premiumBonus: Float
    acceptedAt: DateTime
    rejectedAt: DateTime
    session: InteractionSession
    chatRoomId: String
    createdAt: DateTime!
    updatedAt: DateTime!
    user1: User!
    user2: User!
  }

  type SuggestedProfile {
    user: User!
    compatibilityScore: Float!
    matchReasons: [String!]!
    distance: Float
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

  input PrivacySettingsInput {
    showOnlineStatus: Boolean!
    sendReadReceipts: Boolean!
  }

  input NotificationSettingsInput {
    all: Boolean!
    newMatches: Boolean!
    newMessages: Boolean!
    appPromotions: Boolean!
  }

  input DiscoveryPreferencesInput {
    ageMin: Int
    ageMax: Int
    maxDistance: Int
    interestedIn: String
    connectionType: String
    lookingFor: [String!]
    interests: [String!]
    preferredEducationLevels: [String!]
    preferredFamilyPlans: [String!]
    preferredHasKids: [String!]
    preferredReligions: [String!]
    preferredPoliticalViews: [String!]
    preferredDrinkingHabits: [String!]
    preferredSmokingHabits: [String!]
    heightMin: Int
    heightMax: Int
  }

  input SocialLoginInput {
    provider: String! # "google" or "apple"
    idToken: String # Apple ID token or Google ID token
    accessToken: String # Google access token
    authorizationCode: String # Apple authorization code
    email: String
    name: String
    picture: String # Google profile picture URL
    googleId: String # Google user ID
    appleUserId: String # Apple user ID
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
    notifications(limit: Int, offset: Int): [Notification!]!
    unreadNotifications: [Notification!]!

    # Settings queries
    myPrivacySettings: PrivacySettings!
    myNotificationSettings: NotificationSettings!

    # Analytics queries (admin only)
    analytics(period: String): Analytics!
    userAnalytics(userId: ID!): JSON!

    # Safety queries
    myReports: [UserReport!]!
    reportsAgainstMe: [UserReport!]!

    # Connection queries
    myConnections: [Connection!]!
    connectionSuggestions(limit: Int): [User!]!

    # Discovery preferences
    myDiscoveryPreferences: DiscoveryPreferences

    # Match queries
    myPendingMatches: [MatchAttempt!]!
    myMatchHistory(limit: Int, offset: Int): [MatchAttempt!]!

    # Discovery queries
    discoverProfiles(preferences: QueuePreferences, limit: Int): [SuggestedProfile!]!
  }

  # Mutations
  type Mutation {
    # Authentication
    register(input: UserInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    socialLogin(input: SocialLoginInput!): AuthPayload!
    logout: Boolean!
    refreshToken: AuthPayload!

    # User management
    updateProfile(input: UserUpdateInput!): User!
    updateProfileSettings(input: ProfileUpdateInput!): UserProfile!
    deactivateAccount: Boolean!
    deleteAccount: Boolean!

    # Queue management
    joinQueue(preferences: QueuePreferences): QueueStatus!
    leaveQueue: Boolean!
    updateQueuePreferences(preferences: QueuePreferences!): QueueStatus!
    skipMatch(sessionId: String): Boolean!

    # Session management
    startSession(partnerId: ID!, callType: String): InteractionSession!
    endSession(sessionId: ID!): Boolean!
    reportTechnicalIssue(sessionId: ID!, issue: String!): Boolean!

    # Messaging
    sendMessage(input: MessageInput!): ChatMessage!
    markMessageAsRead(messageId: ID!): Boolean!
    markSessionAsRead(sessionId: ID!): Boolean!
    deleteMessage(messageId: ID!, roomId: ID!): Boolean!
    clearMessages(roomId: ID!, all: Boolean): Boolean!

    # Notifications
    markNotificationAsRead(notificationId: ID!): Boolean!
    markAllNotificationsAsRead: Boolean!
    deleteAllNotifications: Boolean!
    updateNotificationPreferences(preferences: NotificationPreferences!): Boolean!
    updatePrivacySettings(input: PrivacySettingsInput!): PrivacySettings!
    updateNotificationSettings(input: NotificationSettingsInput!): NotificationSettings!

    # Safety & Reporting
    reportUser(input: ReportInput!): UserReport!
    blockUser(userId: ID!): Boolean!
    unblockUser(userId: ID!): Boolean!

    # Connections
    sendConnectionRequest(userId: ID!): Connection!
    respondToConnectionRequest(connectionId: ID!, accept: Boolean!): Connection!
    removeConnection(connectionId: ID!): Boolean!

    # Photo Verification
    verifyPhoto(selfieImage: String!): PhotoVerificationResult!

    # Discovery preferences
    updateDiscoveryPreferences(input: DiscoveryPreferencesInput!): DiscoveryPreferences!

    # Match mutations
    acceptMatch(matchId: ID!): MatchAttempt!
    declineMatch(matchId: ID!): MatchAttempt!
    createMatchFromSuggestion(userId: ID!): MatchAttempt!

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