/**
 * @openapi
 * components:
 *   schemas:
 *     # ============ COMMON SCHEMAS ============
 *     ErrorResponse:
 *       type: object
 *       required: [status, message]
 *       properties:
 *         status:
 *           type: string
 *           enum: [error]
 *           example: error
 *         message:
 *           type: string
 *           example: "An error occurred"
 *         code:
 *           type: string
 *           example: "VALIDATION_ERROR"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-10-01T12:00:00.000Z"
 *         requestId:
 *           type: string
 *           example: "req_123456789"
 *
 *     ValidationErrorResponse:
 *       type: object
 *       required: [status, message, errors]
 *       properties:
 *         status:
 *           type: string
 *           enum: [error]
 *           example: error
 *         message:
 *           type: string
 *           example: "Validation failed"
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 example: "email"
 *               message:
 *                 type: string
 *                 example: "Invalid email format"
 *               code:
 *                 type: string
 *                 example: "INVALID_FORMAT"
 *
 *     SuccessResponse:
 *       type: object
 *       required: [status, data]
 *       properties:
 *         status:
 *           type: string
 *           enum: [success]
 *           example: success
 *         data:
 *           type: object
 *           description: "Response data"
 *         meta:
 *           type: object
 *           properties:
 *             timestamp:
 *               type: string
 *               format: date-time
 *             requestId:
 *               type: string
 *             pagination:
 *               $ref: '#/components/schemas/PaginationMeta'
 *
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           example: 20
 *         total:
 *           type: integer
 *           example: 150
 *         totalPages:
 *           type: integer
 *           example: 8
 *         hasNext:
 *           type: boolean
 *           example: true
 *         hasPrev:
 *           type: boolean
 *           example: false
 *
 *     # ============ USER & AUTH SCHEMAS ============
 *     User:
 *       type: object
 *       required: [id, email, username, gender, createdAt]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: "Unique user identifier"
 *           example: "clqj5b2q000009m08g3h4e1k2"
 *         email:
 *           type: string
 *           format: email
 *           description: "User's email address"
 *           example: "john.doe@example.com"
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 50
 *           description: "User's unique username"
 *           example: "johndoe123"
 *         gender:
 *           type: string
 *           enum: [MALE, FEMALE, OTHER]
 *           description: "User's gender"
 *           example: "MALE"
 *         permissionRole:
 *           type: string
 *           enum: [USER, MODERATOR, ADMIN]
 *           description: "User's permission level"
 *           example: "USER"
 *         emailVerified:
 *           type: boolean
 *           description: "Whether email is verified"
 *           example: true
 *         isActive:
 *           type: boolean
 *           description: "Whether user account is active"
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: "Account creation timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Last login timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *
 *     AuthTokens:
 *       type: object
 *       required: [accessToken, refreshToken]
 *       properties:
 *         accessToken:
 *           type: string
 *           description: "JWT access token for API authentication"
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         refreshToken:
 *           type: string
 *           description: "JWT refresh token for obtaining new access tokens"
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         expiresIn:
 *           type: integer
 *           description: "Access token expiration time in seconds"
 *           example: 3600
 *
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: "User's email address"
 *           example: "john.doe@example.com"
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           description: "User's password"
 *           example: "SecurePassword123!"
 *
 *     RegisterRequest:
 *       type: object
 *       required: [email, password, username, gender]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: "User's email address"
 *           example: "john.doe@example.com"
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           description: "User's password (min 8 characters)"
 *           example: "SecurePassword123!"
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 50
 *           description: "Desired username (must be unique)"
 *           example: "johndoe123"
 *         gender:
 *           type: string
 *           enum: [MALE, FEMALE, OTHER]
 *           description: "User's gender"
 *           example: "MALE"
 *
 *     # ============ PROFILE SCHEMAS ============
 *     DatingProfile:
 *       type: object
 *       required: [id, userId, displayName, intent]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: "Profile unique identifier"
 *           example: "prof_clqj5b2q000009m08g3h4e1k2"
 *         userId:
 *           type: string
 *           format: uuid
 *           description: "Associated user ID"
 *           example: "clqj5b2q000009m08g3h4e1k2"
 *         displayName:
 *           type: string
 *           maxLength: 100
 *           description: "User's display name"
 *           example: "John D."
 *         shortBio:
 *           type: string
 *           nullable: true
 *           maxLength: 500
 *           description: "Short biography"
 *           example: "Love hiking, coffee, and meaningful conversations"
 *         photos:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *           description: "Array of photo URLs"
 *           example: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]
 *         videos:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *           description: "Array of video URLs"
 *           example: ["https://example.com/video1.mp4"]
 *         intent:
 *           type: string
 *           enum: [CASUAL, DATING, SERIOUS, MARRIAGE]
 *           description: "Dating intention"
 *           example: "DATING"
 *         age:
 *           type: integer
 *           minimum: 18
 *           maximum: 100
 *           nullable: true
 *           description: "User's age"
 *           example: 28
 *         locationCity:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           description: "City location"
 *           example: "San Francisco"
 *         locationCountry:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           description: "Country location"
 *           example: "United States"
 *         preferences:
 *           type: object
 *           description: "Dating preferences as JSON"
 *           example: {"minAge": 25, "maxAge": 35, "maxDistance": 50}
 *         # Dating-specific attributes
 *         gender:
 *           type: string
 *           enum: [MAN, WOMAN, NONBINARY]
 *           nullable: true
 *           description: "User's gender identity"
 *           example: "MAN"
 *         relationshipIntents:
 *           type: array
 *           items:
 *             type: string
 *             enum: [CASUAL, LONG_TERM, MARRIAGE, FRIENDSHIP, UNSURE]
 *           description: "Relationship intentions"
 *           example: ["LONG_TERM", "MARRIAGE"]
 *         familyPlans:
 *           type: string
 *           enum: [WANTS_KIDS, DOESNT_WANT_KIDS, HAS_KIDS_WANTS_MORE, HAS_KIDS_DOESNT_WANT_MORE, DOESNT_HAVE_KIDS_WANTS_KIDS, NOT_SURE_YET]
 *           nullable: true
 *           description: "Family planning preferences"
 *           example: "WANTS_KIDS"
 *         religion:
 *           type: string
 *           enum: [CHRISTIAN, CATHOLIC, JEWISH, MUSLIM, HINDU, BUDDHIST, SPIRITUAL, AGNOSTIC, ATHEIST, OTHER]
 *           nullable: true
 *           description: "Religious affiliation"
 *           example: "CHRISTIAN"
 *         educationLevel:
 *           type: string
 *           enum: [HIGH_SCHOOL, SOME_COLLEGE, UNDERGRADUATE, POSTGRADUATE, PHD]
 *           nullable: true
 *           description: "Education level"
 *           example: "UNDERGRADUATE"
 *         politicalViews:
 *           type: string
 *           enum: [LIBERAL, MODERATE, CONSERVATIVE, LIBERTARIAN, OTHER, PREFER_NOT_TO_SAY]
 *           nullable: true
 *           description: "Political views"
 *           example: "MODERATE"
 *         exercise:
 *           type: string
 *           enum: [DAILY, FREQUENTLY, OCCASIONALLY, RARELY, NEVER]
 *           nullable: true
 *           description: "Exercise frequency"
 *           example: "FREQUENTLY"
 *         smoking:
 *           type: string
 *           enum: [DAILY, FREQUENTLY, OCCASIONALLY, RARELY, NEVER]
 *           nullable: true
 *           description: "Smoking frequency"
 *           example: "NEVER"
 *         drinking:
 *           type: string
 *           enum: [DAILY, FREQUENTLY, OCCASIONALLY, RARELY, NEVER]
 *           nullable: true
 *           description: "Drinking frequency"
 *           example: "OCCASIONALLY"
 *         isPremium:
 *           type: boolean
 *           description: "Premium subscription status"
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: "Profile creation timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: "Profile last update timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *
 *     UpdateProfileRequest:
 *       type: object
 *       properties:
 *         displayName:
 *           type: string
 *           maxLength: 100
 *         shortBio:
 *           type: string
 *           maxLength: 500
 *         intent:
 *           type: string
 *           enum: [CASUAL, DATING, SERIOUS, MARRIAGE]
 *         age:
 *           type: integer
 *           minimum: 18
 *           maximum: 100
 *         locationCity:
 *           type: string
 *           maxLength: 100
 *         locationCountry:
 *           type: string
 *           maxLength: 100
 *         # Include other updatable fields...
 *
 *     # ============ QUEUE & MATCHING SCHEMAS ============
 *     QueueEntry:
 *       type: object
 *       required: [userId, preferences, joinedAt]
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *           description: "User ID in queue"
 *           example: "clqj5b2q000009m08g3h4e1k2"
 *         preferences:
 *           type: object
 *           description: "User's matching preferences"
 *           example: {"intent": "DATING", "ageRange": [25, 35]}
 *         priority:
 *           type: integer
 *           description: "Queue priority (premium users get higher priority)"
 *           example: 1
 *         joinedAt:
 *           type: string
 *           format: date-time
 *           description: "Queue join timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *         estimatedWaitTime:
 *           type: integer
 *           description: "Estimated wait time in seconds"
 *           example: 120
 *
 *     MatchResult:
 *       type: object
 *       required: [matchId, user1Id, user2Id, compatibilityScore, createdAt]
 *       properties:
 *         matchId:
 *           type: string
 *           format: uuid
 *           description: "Unique match identifier"
 *           example: "match_clqj5b2q000009m08g3h4e1k2"
 *         user1Id:
 *           type: string
 *           format: uuid
 *           description: "First user ID"
 *           example: "user1_id"
 *         user2Id:
 *           type: string
 *           format: uuid
 *           description: "Second user ID"
 *           example: "user2_id"
 *         compatibilityScore:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           description: "Compatibility percentage (0-100)"
 *           example: 87.5
 *         scoreBreakdown:
 *           type: object
 *           description: "Detailed compatibility scores"
 *           properties:
 *             ageScore:
 *               type: number
 *               example: 0.9
 *             locationScore:
 *               type: number
 *               example: 0.8
 *             interestScore:
 *               type: number
 *               example: 0.75
 *             # Add other score dimensions...
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: "Match creation timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *
 *     # ============ INTERACTION SCHEMAS ============
 *     InteractionSession:
 *       type: object
 *       required: [id, user1Id, user2Id, status, startedAt]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: "Session unique identifier"
 *           example: "session_clqj5b2q000009m08g3h4e1k2"
 *         user1Id:
 *           type: string
 *           format: uuid
 *           description: "First participant user ID"
 *           example: "user1_id"
 *         user2Id:
 *           type: string
 *           format: uuid
 *           description: "Second participant user ID"
 *           example: "user2_id"
 *         status:
 *           type: string
 *           enum: [PENDING, ACTIVE, ENDED, INTERRUPTED]
 *           description: "Current session status"
 *           example: "ACTIVE"
 *         callType:
 *           type: string
 *           enum: [AUDIO, VIDEO]
 *           description: "Type of call"
 *           example: "VIDEO"
 *         startedAt:
 *           type: string
 *           format: date-time
 *           description: "Session start timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *         endedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Session end timestamp"
 *           example: "2025-10-01T12:30:00.000Z"
 *         duration:
 *           type: integer
 *           nullable: true
 *           description: "Session duration in seconds"
 *           example: 1800
 *         rating1:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           nullable: true
 *           description: "User 1's rating"
 *           example: 4
 *         rating2:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           nullable: true
 *           description: "User 2's rating"
 *           example: 5
 *
 *     WebRTCSignalData:
 *       type: object
 *       required: [type, data]
 *       properties:
 *         type:
 *           type: string
 *           enum: [offer, answer, ice-candidate]
 *           description: "WebRTC signal type"
 *           example: "offer"
 *         data:
 *           type: object
 *           description: "WebRTC signal data"
 *           example: {"sdp": "v=0...", "type": "offer"}
 *         sessionId:
 *           type: string
 *           format: uuid
 *           description: "Associated session ID"
 *           example: "session_clqj5b2q000009m08g3h4e1k2"
 *
 *     # ============ COMMUNICATION SCHEMAS ============
 *     ChatRoom:
 *       type: object
 *       required: [id, participants, createdAt]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: "Chat room unique identifier"
 *           example: "room_clqj5b2q000009m08g3h4e1k2"
 *         participants:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: "Array of participant user IDs"
 *           example: ["user1_id", "user2_id"]
 *         roomType:
 *           type: string
 *           enum: [PRIVATE, GROUP]
 *           description: "Type of chat room"
 *           example: "PRIVATE"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: "Room creation timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *         lastActivity:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Last message timestamp"
 *           example: "2025-10-01T12:30:00.000Z"
 *
 *     Message:
 *       type: object
 *       required: [id, roomId, senderId, content, messageType, timestamp]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: "Message unique identifier"
 *           example: "msg_clqj5b2q000009m08g3h4e1k2"
 *         roomId:
 *           type: string
 *           format: uuid
 *           description: "Associated room ID"
 *           example: "room_clqj5b2q000009m08g3h4e1k2"
 *         senderId:
 *           type: string
 *           format: uuid
 *           description: "Sender user ID"
 *           example: "user1_id"
 *         content:
 *           type: string
 *           description: "Message content"
 *           example: "Hello! How are you?"
 *         messageType:
 *           type: string
 *           enum: [TEXT, IMAGE, VIDEO, VOICE_NOTE, STICKER]
 *           description: "Type of message"
 *           example: "TEXT"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: "Message timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *         edited:
 *           type: boolean
 *           description: "Whether message was edited"
 *           example: false
 *         editedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Edit timestamp"
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               type:
 *                 type: string
 *                 enum: [image, video, audio, document]
 *               size:
 *                 type: integer
 *               name:
 *                 type: string
 *           description: "Message attachments"
 *
 *     # ============ NOTIFICATION SCHEMAS ============
 *     Notification:
 *       type: object
 *       required: [id, userId, title, body, type, createdAt]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: "Notification unique identifier"
 *           example: "notif_clqj5b2q000009m08g3h4e1k2"
 *         userId:
 *           type: string
 *           format: uuid
 *           description: "Recipient user ID"
 *           example: "user1_id"
 *         title:
 *           type: string
 *           description: "Notification title"
 *           example: "New Match!"
 *         body:
 *           type: string
 *           description: "Notification body text"
 *           example: "You have a new match with 87% compatibility!"
 *         type:
 *           type: string
 *           enum: [MATCH, MESSAGE, SYSTEM, PROMOTION]
 *           description: "Notification type"
 *           example: "MATCH"
 *         data:
 *           type: object
 *           nullable: true
 *           description: "Additional notification data"
 *           example: {"matchId": "match_123", "userId": "user2_id"}
 *         read:
 *           type: boolean
 *           description: "Whether notification was read"
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: "Notification creation timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *         deliveredAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Delivery timestamp"
 *           example: "2025-10-01T12:00:01.000Z"
 *
 *     # ============ ANALYTICS SCHEMAS ============
 *     UserAnalytics:
 *       type: object
 *       required: [userId, totalSessions, createdAt]
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *           description: "User ID"
 *           example: "user1_id"
 *         totalSessions:
 *           type: integer
 *           description: "Total number of sessions"
 *           example: 25
 *         sessionsThisWeek:
 *           type: integer
 *           description: "Sessions in current week"
 *           example: 3
 *         sessionsThisMonth:
 *           type: integer
 *           description: "Sessions in current month"
 *           example: 12
 *         averageSessionDuration:
 *           type: number
 *           description: "Average session duration in seconds"
 *           example: 1200.5
 *         matchSuccessRate:
 *           type: number
 *           description: "Match success rate percentage"
 *           example: 65.2
 *         lastActiveAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Last activity timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: "Analytics record creation timestamp"
 *           example: "2025-09-01T12:00:00.000Z"
 *
 *     SystemMetrics:
 *       type: object
 *       properties:
 *         activeUsers:
 *           type: integer
 *           description: "Currently active users"
 *           example: 1250
 *         totalUsers:
 *           type: integer
 *           description: "Total registered users"
 *           example: 50000
 *         activeInteractions:
 *           type: integer
 *           description: "Currently active interactions"
 *           example: 85
 *         queueLength:
 *           type: integer
 *           description: "Current queue length"
 *           example: 45
 *         averageWaitTime:
 *           type: number
 *           description: "Average wait time in seconds"
 *           example: 120.5
 *         successfulMatches:
 *           type: integer
 *           description: "Successful matches today"
 *           example: 320
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: "Metrics timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *
 *     # ============ MODERATION SCHEMAS ============
 *     ModerationAction:
 *       type: object
 *       required: [id, targetUserId, action, reason, createdAt]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: "Action unique identifier"
 *           example: "mod_clqj5b2q000009m08g3h4e1k2"
 *         targetUserId:
 *           type: string
 *           format: uuid
 *           description: "Target user ID"
 *           example: "user1_id"
 *         moderatorId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: "Moderator user ID (null for automated)"
 *           example: "mod_user_id"
 *         action:
 *           type: string
 *           enum: [WARNING, SUSPEND, BAN, CONTENT_REMOVAL]
 *           description: "Moderation action type"
 *           example: "WARNING"
 *         reason:
 *           type: string
 *           description: "Reason for action"
 *           example: "Inappropriate content detected"
 *         automated:
 *           type: boolean
 *           description: "Whether action was automated"
 *           example: true
 *         severity:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *           description: "Action severity level"
 *           example: "MEDIUM"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Action expiration timestamp"
 *           example: "2025-10-08T12:00:00.000Z"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: "Action creation timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *
 *     UserReport:
 *       type: object
 *       required: [id, reporterId, reportedUserId, reason, status, createdAt]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: "Report unique identifier"
 *           example: "report_clqj5b2q000009m08g3h4e1k2"
 *         reporterId:
 *           type: string
 *           format: uuid
 *           description: "Reporter user ID"
 *           example: "reporter_user_id"
 *         reportedUserId:
 *           type: string
 *           format: uuid
 *           description: "Reported user ID"
 *           example: "reported_user_id"
 *         reason:
 *           type: string
 *           enum: [HARASSMENT, INAPPROPRIATE_CONTENT, SPAM, FAKE_PROFILE, OTHER]
 *           description: "Report reason"
 *           example: "HARASSMENT"
 *         description:
 *           type: string
 *           nullable: true
 *           description: "Detailed description"
 *           example: "User sent inappropriate messages"
 *         status:
 *           type: string
 *           enum: [PENDING, UNDER_REVIEW, RESOLVED, DISMISSED]
 *           description: "Report status"
 *           example: "PENDING"
 *         priority:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *           description: "Report priority"
 *           example: "HIGH"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: "Report creation timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Report resolution timestamp"
 *         reviewedBy:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: "Reviewer user ID"
 *
 *     # ============ ADMIN SCHEMAS ============
 *     AdminUser:
 *       type: object
 *       required: [id, email, username, role, permissions, createdAt]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: "Admin user unique identifier"
 *           example: "admin_clqj5b2q000009m08g3h4e1k2"
 *         email:
 *           type: string
 *           format: email
 *           description: "Admin email address"
 *           example: "admin@example.com"
 *         username:
 *           type: string
 *           description: "Admin username"
 *           example: "admin_user"
 *         role:
 *           type: string
 *           enum: [SUPER_ADMIN, ADMIN, MODERATOR]
 *           description: "Admin role level"
 *           example: "ADMIN"
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           description: "Array of permissions"
 *           example: ["users.read", "users.update", "reports.manage"]
 *         isActive:
 *           type: boolean
 *           description: "Whether admin account is active"
 *           example: true
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Last login timestamp"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: "Account creation timestamp"
 *           example: "2025-10-01T12:00:00.000Z"
 */