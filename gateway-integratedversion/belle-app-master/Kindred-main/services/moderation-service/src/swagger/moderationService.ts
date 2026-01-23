/**
 * @openapi
 * tags:
 *   - name: Content Filtering
 *     description: Automated content moderation and filtering
 *   - name: User Monitoring
 *     description: User behavior monitoring and risk assessment
 *   - name: Safety Enforcement
 *     description: Safety policy enforcement and violations
 *   - name: AI Moderation
 *     description: AI-powered content and behavior analysis
 *   - name: Moderation Queue
 *     description: Human moderation queue management
 *   - name: Appeals
 *     description: User appeals and review process
 */

/**
 * @openapi
 * /moderation/content/analyze:
 *   post:
 *     tags:
 *       - Content Filtering
 *     summary: Analyze content for violations
 *     description: Analyze text, image, or video content for policy violations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentType, content]
 *             properties:
 *               contentType:
 *                 type: string
 *                 enum: [TEXT, IMAGE, VIDEO, AUDIO, PROFILE]
 *                 description: Type of content to analyze
 *               content:
 *                 type: string
 *                 description: Content to analyze (text or URL for media)
 *               context:
 *                 type: object
 *                 properties:
 *                   userId:
 *                     type: string
 *                     format: uuid
 *                   sessionId:
 *                     type: string
 *                     format: uuid
 *                   messageId:
 *                     type: string
 *                     format: uuid
 *                   location:
 *                     type: string
 *                     enum: [PROFILE, CHAT, VOICE_CALL, VIDEO_CALL]
 *               urgency:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                 default: MEDIUM
 *                 description: Analysis urgency level
 *     responses:
 *       '200':
 *         description: Content analysis completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     analysisId:
 *                       type: string
 *                       format: uuid
 *                     result:
 *                       type: string
 *                       enum: [APPROVED, FLAGGED, BLOCKED, REVIEW_REQUIRED]
 *                       description: Analysis result
 *                     confidence:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 1
 *                       description: AI confidence score
 *                     violations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [HATE_SPEECH, HARASSMENT, EXPLICIT_CONTENT, SPAM, FAKE_PROFILE, VIOLENCE, DISCRIMINATION]
 *                           severity:
 *                             type: string
 *                             enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                           confidence:
 *                             type: number
 *                           description:
 *                             type: string
 *                           evidence:
 *                             type: array
 *                             items:
 *                               type: string
 *                     recommendations:
 *                       type: object
 *                       properties:
 *                         action:
 *                           type: string
 *                           enum: [ALLOW, WARNING, REMOVE_CONTENT, SUSPEND_USER, BAN_USER, HUMAN_REVIEW]
 *                         reason:
 *                           type: string
 *                         automatedResponse:
 *                           type: boolean
 *                           description: Whether action can be automated
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         processingTime:
 *                           type: number
 *                           description: Analysis time in milliseconds
 *                         aiModel:
 *                           type: string
 *                         languageDetected:
 *                           type: string
 *                         analysisTimestamp:
 *                           type: string
 *                           format: date-time
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /moderation/users/{userId}/risk-assessment:
 *   get:
 *     tags:
 *       - User Monitoring
 *     summary: Get user risk assessment
 *     description: Get comprehensive risk assessment for a user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       '200':
 *         description: Risk assessment retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     overallRiskScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                       description: Overall risk score
 *                     riskLevel:
 *                       type: string
 *                       enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                     riskFactors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           factor:
 *                             type: string
 *                             enum: [MULTIPLE_REPORTS, SUSPICIOUS_BEHAVIOR, FAKE_PROFILE_INDICATORS, HARASSMENT_HISTORY, RAPID_ACCOUNT_CREATION, UNUSUAL_ACTIVITY_PATTERNS]
 *                           score:
 *                             type: number
 *                             minimum: 0
 *                             maximum: 100
 *                           weight:
 *                             type: number
 *                             description: Factor weight in overall score
 *                           description:
 *                             type: string
 *                           evidence:
 *                             type: array
 *                             items:
 *                               type: string
 *                     behaviorAnalysis:
 *                       type: object
 *                       properties:
 *                         accountAge:
 *                           type: integer
 *                           description: Account age in days
 *                         sessionCount:
 *                           type: integer
 *                         averageSessionDuration:
 *                           type: number
 *                         reportCount:
 *                           type: integer
 *                           description: Number of reports against user
 *                         reportRate:
 *                           type: number
 *                           description: Reports per session
 *                         complianceHistory:
 *                           type: object
 *                           properties:
 *                             warnings:
 *                               type: integer
 *                             suspensions:
 *                               type: integer
 *                             violations:
 *                               type: integer
 *                         recentActivity:
 *                           type: object
 *                           properties:
 *                             lastActive:
 *                               type: string
 *                               format: date-time
 *                             recentSessions:
 *                               type: integer
 *                             recentReports:
 *                               type: integer
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action:
 *                             type: string
 *                             enum: [MONITOR, RESTRICT, VERIFY_IDENTITY, MANUAL_REVIEW, SUSPEND, BAN]
 *                           priority:
 *                             type: string
 *                             enum: [LOW, MEDIUM, HIGH, URGENT]
 *                           reason:
 *                             type: string
 *                           timeline:
 *                             type: string
 *                             enum: [IMMEDIATE, WITHIN_24H, WITHIN_WEEK]
 *                     lastAssessment:
 *                       type: string
 *                       format: date-time
 *                     nextAssessment:
 *                       type: string
 *                       format: date-time
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /moderation/users/{userId}/monitor:
 *   post:
 *     tags:
 *       - User Monitoring
 *     summary: Add user to monitoring list
 *     description: Add user to enhanced monitoring for safety concerns
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason, monitoringLevel]
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for monitoring
 *               monitoringLevel:
 *                 type: string
 *                 enum: [BASIC, ENHANCED, INTENSIVE]
 *                 description: Level of monitoring
 *               duration:
 *                 type: integer
 *                 description: Monitoring duration in days (null for indefinite)
 *               flags:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [CONTENT_REVIEW, BEHAVIOR_TRACKING, SESSION_RECORDING, AUTOMATED_REPORTING]
 *                 description: Specific monitoring flags
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Additional notes
 *     responses:
 *       '201':
 *         description: User added to monitoring successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     monitoringId:
 *                       type: string
 *                       format: uuid
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     level:
 *                       type: string
 *                     flags:
 *                       type: array
 *                       items:
 *                         type: string
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '409':
 *         description: User already being monitored
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /moderation/violations:
 *   post:
 *     tags:
 *       - Safety Enforcement
 *     summary: Record safety violation
 *     description: Record a safety policy violation and trigger enforcement action
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, violationType, severity, evidence]
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User who violated policy
 *               violationType:
 *                 type: string
 *                 enum: [HARASSMENT, HATE_SPEECH, EXPLICIT_CONTENT, FAKE_PROFILE, SPAM, VIOLENCE, DISCRIMINATION, UNDERAGE, IMPERSONATION]
 *                 description: Type of violation
 *               severity:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                 description: Violation severity
 *               evidence:
 *                 type: object
 *                 required: [type, data]
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [TEXT_MESSAGE, IMAGE, VIDEO, AUDIO, PROFILE_DATA, BEHAVIOR_PATTERN]
 *                   data:
 *                     type: string
 *                     description: Evidence data (content or URL)
 *                   context:
 *                     type: object
 *                     properties:
 *                       sessionId:
 *                         type: string
 *                         format: uuid
 *                       messageId:
 *                         type: string
 *                         format: uuid
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       reportedBy:
 *                         type: string
 *                         format: uuid
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Detailed description of violation
 *               autoDetected:
 *                 type: boolean
 *                 default: false
 *                 description: Whether violation was automatically detected
 *               aiConfidence:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 description: AI detection confidence (for auto-detected violations)
 *               recommendedAction:
 *                 type: string
 *                 enum: [WARNING, CONTENT_REMOVAL, TEMPORARY_SUSPENSION, PERMANENT_BAN, MANUAL_REVIEW]
 *                 description: Recommended enforcement action
 *     responses:
 *       '201':
 *         description: Violation recorded and action initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     violationId:
 *                       type: string
 *                       format: uuid
 *                     actionTaken:
 *                       type: string
 *                       enum: [WARNING_SENT, CONTENT_REMOVED, USER_SUSPENDED, USER_BANNED, QUEUED_FOR_REVIEW, NO_ACTION]
 *                     severity:
 *                       type: string
 *                     recordedAt:
 *                       type: string
 *                       format: date-time
 *                     reviewRequired:
 *                       type: boolean
 *                       description: Whether human review is required
 *                     escalated:
 *                       type: boolean
 *                       description: Whether violation was escalated
 *                     userNotified:
 *                       type: boolean
 *                       description: Whether user was notified of action
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /moderation/ai/models:
 *   get:
 *     tags:
 *       - AI Moderation
 *     summary: Get AI moderation models
 *     description: Get information about available AI moderation models and their performance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: AI models information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       modelId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [TEXT_ANALYSIS, IMAGE_ANALYSIS, VIDEO_ANALYSIS, BEHAVIOR_ANALYSIS]
 *                       version:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 *                       accuracy:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 1
 *                         description: Model accuracy score
 *                       lastTrained:
 *                         type: string
 *                         format: date-time
 *                       supportedLanguages:
 *                         type: array
 *                         items:
 *                           type: string
 *                       capabilities:
 *                         type: array
 *                         items:
 *                           type: string
 *                           enum: [HATE_SPEECH_DETECTION, HARASSMENT_DETECTION, EXPLICIT_CONTENT, SPAM_DETECTION, FAKE_PROFILE_DETECTION]
 *                       performance:
 *                         type: object
 *                         properties:
 *                           precision:
 *                             type: number
 *                           recall:
 *                             type: number
 *                           f1Score:
 *                             type: number
 *                           falsePositiveRate:
 *                             type: number
 *                           averageProcessingTime:
 *                             type: number
 *                             description: Average processing time in milliseconds
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /moderation/queue:
 *   get:
 *     tags:
 *       - Moderation Queue
 *     summary: Get moderation queue
 *     description: Get items in the human moderation queue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *         description: Filter by priority level
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CONTENT_REVIEW, USER_APPEAL, VIOLATION_REVIEW, RISK_ASSESSMENT]
 *         description: Filter by queue item type
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by assigned moderator
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_REVIEW, COMPLETED, ESCALATED]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       '200':
 *         description: Moderation queue retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       queueId:
 *                         type: string
 *                         format: uuid
 *                       type:
 *                         type: string
 *                         enum: [CONTENT_REVIEW, USER_APPEAL, VIOLATION_REVIEW, RISK_ASSESSMENT]
 *                       priority:
 *                         type: string
 *                         enum: [LOW, MEDIUM, HIGH, URGENT]
 *                       status:
 *                         type: string
 *                         enum: [PENDING, IN_REVIEW, COMPLETED, ESCALATED]
 *                       subject:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                             format: uuid
 *                           contentId:
 *                             type: string
 *                             format: uuid
 *                           reportId:
 *                             type: string
 *                             format: uuid
 *                       description:
 *                         type: string
 *                       aiAnalysis:
 *                         type: object
 *                         properties:
 *                           result:
 *                             type: string
 *                           confidence:
 *                             type: number
 *                           violations:
 *                             type: array
 *                             items:
 *                               type: string
 *                       assignedTo:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                       assignedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       deadline:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       estimatedTime:
 *                         type: integer
 *                         description: Estimated review time in minutes
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                     queueStats:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                         inReview:
 *                           type: integer
 *                         averageWaitTime:
 *                           type: number
 *                           description: Average wait time in hours
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /moderation/queue/{queueId}/assign:
 *   post:
 *     tags:
 *       - Moderation Queue
 *     summary: Assign queue item to moderator
 *     description: Assign a moderation queue item to a specific moderator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Queue item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               moderatorId:
 *                 type: string
 *                 format: uuid
 *                 description: Moderator to assign (null for self-assignment)
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 description: Update priority level
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Assignment notes
 *     responses:
 *       '200':
 *         description: Queue item assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     queueId:
 *                       type: string
 *                       format: uuid
 *                     assignedTo:
 *                       type: string
 *                       format: uuid
 *                     assignedAt:
 *                       type: string
 *                       format: date-time
 *                     priority:
 *                       type: string
 *                     estimatedCompletion:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '409':
 *         description: Queue item already assigned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /moderation/appeals:
 *   get:
 *     tags:
 *       - Appeals
 *     summary: Get moderation appeals
 *     description: Get list of user appeals for moderation decisions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, UNDER_REVIEW, APPROVED, DENIED, WITHDRAWN]
 *         description: Filter by appeal status
 *       - in: query
 *         name: violationType
 *         schema:
 *           type: string
 *           enum: [HARASSMENT, HATE_SPEECH, EXPLICIT_CONTENT, FAKE_PROFILE, SPAM, VIOLENCE, DISCRIMINATION]
 *         description: Filter by violation type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of appeals per page
 *     responses:
 *       '200':
 *         description: Appeals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       appealId:
 *                         type: string
 *                         format: uuid
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                       violationId:
 *                         type: string
 *                         format: uuid
 *                       violationType:
 *                         type: string
 *                       originalAction:
 *                         type: string
 *                         enum: [WARNING, CONTENT_REMOVAL, TEMPORARY_SUSPENSION, PERMANENT_BAN]
 *                       appealReason:
 *                         type: string
 *                       userStatement:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [PENDING, UNDER_REVIEW, APPROVED, DENIED, WITHDRAWN]
 *                       submittedAt:
 *                         type: string
 *                         format: date-time
 *                       reviewedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       reviewedBy:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                       priority:
 *                         type: string
 *                         enum: [LOW, MEDIUM, HIGH, URGENT]
 *                       additionalEvidence:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             type:
 *                               type: string
 *                             url:
 *                               type: string
 *                               format: uri
 *                             description:
 *                               type: string
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   post:
 *     tags:
 *       - Appeals
 *     summary: Submit moderation appeal
 *     description: Submit an appeal for a moderation decision
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [violationId, reason, statement]
 *             properties:
 *               violationId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the violation being appealed
 *               reason:
 *                 type: string
 *                 enum: [FALSE_POSITIVE, CONTEXT_MISUNDERSTOOD, POLICY_DISAGREEMENT, TECHNICAL_ERROR, OTHER]
 *                 description: Reason for appeal
 *               statement:
 *                 type: string
 *                 maxLength: 2000
 *                 description: User's appeal statement
 *               additionalEvidence:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [SCREENSHOT, VIDEO, DOCUMENT, WITNESS_STATEMENT]
 *                     url:
 *                       type: string
 *                       format: uri
 *                     description:
 *                       type: string
 *                 description: Additional evidence to support appeal
 *     responses:
 *       '201':
 *         description: Appeal submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     appealId:
 *                       type: string
 *                       format: uuid
 *                     submittedAt:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                       example: PENDING
 *                     estimatedReviewTime:
 *                       type: integer
 *                       description: Estimated review time in hours
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '409':
 *         description: Appeal already exists for this violation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /moderation/appeals/{appealId}/review:
 *   put:
 *     tags:
 *       - Appeals
 *     summary: Review moderation appeal
 *     description: Review and decide on a moderation appeal
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appealId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Appeal ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision, reasoning]
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [APPROVED, DENIED, PARTIAL_APPROVAL, ESCALATED]
 *                 description: Appeal review decision
 *               reasoning:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Detailed reasoning for the decision
 *               newAction:
 *                 type: string
 *                 enum: [NO_ACTION, WARNING, CONTENT_REMOVAL, REDUCED_SUSPENSION, TEMPORARY_SUSPENSION, PERMANENT_BAN]
 *                 description: New action to take (if decision is approved/partial)
 *               compensationOffered:
 *                 type: boolean
 *                 default: false
 *                 description: Whether compensation is offered for wrongful action
 *               publicApology:
 *                 type: boolean
 *                 default: false
 *                 description: Whether a public apology is warranted
 *               internalNotes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Internal notes for moderator team
 *     responses:
 *       '200':
 *         description: Appeal reviewed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     appealId:
 *                       type: string
 *                       format: uuid
 *                     decision:
 *                       type: string
 *                     reviewedAt:
 *                       type: string
 *                       format: date-time
 *                     reviewedBy:
 *                       type: string
 *                       format: uuid
 *                     actionTaken:
 *                       type: string
 *                     userNotified:
 *                       type: boolean
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */