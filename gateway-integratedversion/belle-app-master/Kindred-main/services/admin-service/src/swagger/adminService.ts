/**
 * @openapi
 * tags:
 *   - name: Admin Dashboard
 *     description: Administrative dashboard and overview
 *   - name: User Management
 *     description: User account administration
 *   - name: Content Moderation
 *     description: Content moderation and safety enforcement
 *   - name: System Configuration
 *     description: Platform configuration and settings
 *   - name: Support
 *     description: Customer support and ticket management
 *   - name: Reports
 *     description: Administrative reports and data exports
 */

/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     tags:
 *       - Admin Dashboard
 *     summary: Get admin dashboard overview
 *     description: Get comprehensive platform overview for administrators
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Dashboard data retrieved successfully
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
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: integer
 *                         activeUsers:
 *                           type: integer
 *                         dailyActiveUsers:
 *                           type: integer
 *                         onlineUsers:
 *                           type: integer
 *                         newRegistrationsToday:
 *                           type: integer
 *                         totalSessions:
 *                           type: integer
 *                         activeSessions:
 *                           type: integer
 *                     systemHealth:
 *                       type: object
 *                       properties:
 *                         uptime:
 *                           type: number
 *                           description: System uptime percentage
 *                         responseTime:
 *                           type: number
 *                           description: Average response time in ms
 *                         errorRate:
 *                           type: number
 *                           description: Error rate percentage
 *                         serverLoad:
 *                           type: number
 *                           description: Server load percentage
 *                     moderationQueue:
 *                       type: object
 *                       properties:
 *                         pendingReports:
 *                           type: integer
 *                         criticalIssues:
 *                           type: integer
 *                         averageResolutionTime:
 *                           type: number
 *                           description: Average resolution time in hours
 *                     businessMetrics:
 *                       type: object
 *                       properties:
 *                         revenue:
 *                           type: object
 *                           properties:
 *                             today:
 *                               type: number
 *                             thisMonth:
 *                               type: number
 *                             growth:
 *                               type: number
 *                         premiumSubscriptions:
 *                           type: integer
 *                         conversionRate:
 *                           type: number
 *                     alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           level:
 *                             type: string
 *                             enum: [info, warning, error, critical]
 *                           title:
 *                             type: string
 *                           message:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           acknowledged:
 *                             type: boolean
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags:
 *       - User Management
 *     summary: Get user list for administration
 *     description: Get paginated list of users with administrative information
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Number of users per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email, username, or display name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED, BANNED, PENDING_VERIFICATION]
 *         description: Filter by user status
 *       - in: query
 *         name: subscriptionType
 *         schema:
 *           type: string
 *           enum: [FREE, PREMIUM, VIP]
 *         description: Filter by subscription type
 *       - in: query
 *         name: registrationDateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter users registered from this date
 *       - in: query
 *         name: registrationDateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter users registered until this date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [registrationDate, lastActivity, email, status]
 *           default: registrationDate
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       '200':
 *         description: User list retrieved successfully
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
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                       email:
 *                         type: string
 *                         format: email
 *                       displayName:
 *                         type: string
 *                       registrationDate:
 *                         type: string
 *                         format: date-time
 *                       lastActivity:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         enum: [ACTIVE, SUSPENDED, BANNED, PENDING_VERIFICATION]
 *                       subscriptionType:
 *                         type: string
 *                         enum: [FREE, PREMIUM, VIP]
 *                       totalSessions:
 *                         type: integer
 *                       reportCount:
 *                         type: integer
 *                         description: Number of reports against this user
 *                       verificationStatus:
 *                         type: object
 *                         properties:
 *                           email:
 *                             type: boolean
 *                           phone:
 *                             type: boolean
 *                           identity:
 *                             type: boolean
 *                       riskScore:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 100
 *                         description: User safety risk score
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /admin/users/{userId}:
 *   get:
 *     tags:
 *       - User Management
 *     summary: Get detailed user information
 *     description: Get comprehensive user details for administrative purposes
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
 *         description: User details retrieved successfully
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     profile:
 *                       $ref: '#/components/schemas/DatingProfile'
 *                     adminInfo:
 *                       type: object
 *                       properties:
 *                         accountStatus:
 *                           type: string
 *                           enum: [ACTIVE, SUSPENDED, BANNED, PENDING_VERIFICATION]
 *                         suspensionReason:
 *                           type: string
 *                           nullable: true
 *                         suspensionExpiresAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         riskScore:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 100
 *                         riskFactors:
 *                           type: array
 *                           items:
 *                             type: string
 *                         moderationHistory:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               action:
 *                                 type: string
 *                               reason:
 *                                 type: string
 *                               adminId:
 *                                 type: string
 *                                 format: uuid
 *                               timestamp:
 *                                 type: string
 *                                 format: date-time
 *                     activitySummary:
 *                       type: object
 *                       properties:
 *                         totalSessions:
 *                           type: integer
 *                         totalMatches:
 *                           type: integer
 *                         averageSessionDuration:
 *                           type: number
 *                         lastActivity:
 *                           type: string
 *                           format: date-time
 *                         registrationDate:
 *                           type: string
 *                           format: date-time
 *                     reports:
 *                       type: object
 *                       properties:
 *                         reportedBy:
 *                           type: integer
 *                           description: Number of reports against this user
 *                         reported:
 *                           type: integer
 *                           description: Number of reports this user has made
 *                         recentReports:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               reportId:
 *                                 type: string
 *                                 format: uuid
 *                               reason:
 *                                 type: string
 *                               status:
 *                                 type: string
 *                               reportedAt:
 *                                 type: string
 *                                 format: date-time
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
 * /admin/users/{userId}/actions:
 *   post:
 *     tags:
 *       - User Management
 *     summary: Take administrative action on user
 *     description: Suspend, ban, or take other administrative actions on a user account
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
 *             required: [action, reason]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [SUSPEND, BAN, UNBAN, WARNING, FORCE_VERIFICATION, RESET_PASSWORD]
 *                 description: Administrative action to take
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for the action
 *               duration:
 *                 type: integer
 *                 description: Duration in hours (for temporary actions)
 *               notifyUser:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to notify the user
 *               internalNotes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Internal notes for admin team
 *     responses:
 *       '200':
 *         description: Administrative action completed successfully
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
 *                     actionId:
 *                       type: string
 *                       format: uuid
 *                     action:
 *                       type: string
 *                     appliedAt:
 *                       type: string
 *                       format: date-time
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
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

/**
 * @openapi
 * /admin/moderation/reports:
 *   get:
 *     tags:
 *       - Content Moderation
 *     summary: Get moderation queue
 *     description: Get list of pending and resolved moderation reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_REVIEW, RESOLVED, DISMISSED]
 *           default: PENDING
 *         description: Filter by report status
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *         description: Filter by severity level
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [harassment, inappropriate_behavior, fake_profile, spam, violence, other]
 *         description: Filter by report category
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by assigned moderator
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
 *         description: Number of reports per page
 *     responses:
 *       '200':
 *         description: Moderation reports retrieved successfully
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
 *                       reportId:
 *                         type: string
 *                         format: uuid
 *                       reportedUser:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                             format: uuid
 *                           displayName:
 *                             type: string
 *                           email:
 *                             type: string
 *                             format: email
 *                       reporter:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                             format: uuid
 *                           displayName:
 *                             type: string
 *                       category:
 *                         type: string
 *                       reason:
 *                         type: string
 *                       description:
 *                         type: string
 *                       severity:
 *                         type: string
 *                         enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                       status:
 *                         type: string
 *                         enum: [PENDING, IN_REVIEW, RESOLVED, DISMISSED]
 *                       reportedAt:
 *                         type: string
 *                         format: date-time
 *                       assignedTo:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                       assignedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       priorityScore:
 *                         type: number
 *                         description: Auto-calculated priority score
 *                       evidence:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             type:
 *                               type: string
 *                               enum: [screenshot, video, chat_log, session_recording]
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
 */

/**
 * @openapi
 * /admin/moderation/reports/{reportId}:
 *   get:
 *     tags:
 *       - Content Moderation
 *     summary: Get detailed report information
 *     description: Get comprehensive details about a specific moderation report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Report ID
 *     responses:
 *       '200':
 *         description: Report details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/SafetyReport'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   put:
 *     tags:
 *       - Content Moderation
 *     summary: Update report status
 *     description: Update the status and resolution of a moderation report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [IN_REVIEW, RESOLVED, DISMISSED]
 *                 description: New status for the report
 *               resolution:
 *                 type: string
 *                 enum: [NO_ACTION, WARNING_ISSUED, USER_SUSPENDED, USER_BANNED, CONTENT_REMOVED]
 *                 description: Resolution action taken
 *               resolutionNotes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Notes about the resolution
 *               assignTo:
 *                 type: string
 *                 format: uuid
 *                 description: Assign to specific moderator
 *     responses:
 *       '200':
 *         description: Report updated successfully
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
 *                     reportId:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                     resolution:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     resolvedBy:
 *                       type: string
 *                       format: uuid
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

/**
 * @openapi
 * /admin/config:
 *   get:
 *     tags:
 *       - System Configuration
 *     summary: Get system configuration
 *     description: Get current platform configuration settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Configuration retrieved successfully
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
 *                     platform:
 *                       type: object
 *                       properties:
 *                         maintenanceMode:
 *                           type: boolean
 *                         registrationEnabled:
 *                           type: boolean
 *                         maxConcurrentUsers:
 *                           type: integer
 *                         defaultSessionDuration:
 *                           type: integer
 *                           description: Default session duration in minutes
 *                     matching:
 *                       type: object
 *                       properties:
 *                         algorithmVersion:
 *                           type: string
 *                         maxQueueTime:
 *                           type: integer
 *                           description: Maximum queue time in seconds
 *                         compatibilityThreshold:
 *                           type: number
 *                           description: Minimum compatibility score for matches
 *                         enableSuperMatches:
 *                           type: boolean
 *                     safety:
 *                       type: object
 *                       properties:
 *                         autoModerationEnabled:
 *                           type: boolean
 *                         reportThreshold:
 *                           type: integer
 *                           description: Number of reports before auto-action
 *                         verificationRequired:
 *                           type: boolean
 *                         ageVerificationEnabled:
 *                           type: boolean
 *                     premium:
 *                       type: object
 *                       properties:
 *                         pricingTiers:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               tier:
 *                                 type: string
 *                               price:
 *                                 type: number
 *                               features:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                         freeTrialDays:
 *                           type: integer
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   put:
 *     tags:
 *       - System Configuration
 *     summary: Update system configuration
 *     description: Update platform configuration settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: object
 *                 properties:
 *                   maintenanceMode:
 *                     type: boolean
 *                   registrationEnabled:
 *                     type: boolean
 *                   maxConcurrentUsers:
 *                     type: integer
 *                   defaultSessionDuration:
 *                     type: integer
 *               matching:
 *                 type: object
 *                 properties:
 *                   maxQueueTime:
 *                     type: integer
 *                   compatibilityThreshold:
 *                     type: number
 *                   enableSuperMatches:
 *                     type: boolean
 *               safety:
 *                 type: object
 *                 properties:
 *                   autoModerationEnabled:
 *                     type: boolean
 *                   reportThreshold:
 *                     type: integer
 *                   verificationRequired:
 *                     type: boolean
 *                   ageVerificationEnabled:
 *                     type: boolean
 *     responses:
 *       '200':
 *         description: Configuration updated successfully
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
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     updatedBy:
 *                       type: string
 *                       format: uuid
 *                     changes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           field:
 *                             type: string
 *                           oldValue:
 *                             type: string
 *                           newValue:
 *                             type: string
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
 * /admin/support/tickets:
 *   get:
 *     tags:
 *       - Support
 *     summary: Get support tickets
 *     description: Get list of customer support tickets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, WAITING_FOR_CUSTOMER, RESOLVED, CLOSED]
 *         description: Filter by ticket status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *         description: Filter by priority level
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [technical, billing, account, safety, general]
 *         description: Filter by ticket category
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by assigned agent
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
 *         description: Number of tickets per page
 *     responses:
 *       '200':
 *         description: Support tickets retrieved successfully
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
 *                       ticketId:
 *                         type: string
 *                         format: uuid
 *                       subject:
 *                         type: string
 *                       category:
 *                         type: string
 *                       priority:
 *                         type: string
 *                       status:
 *                         type: string
 *                       customer:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                             format: uuid
 *                           email:
 *                             type: string
 *                             format: email
 *                           displayName:
 *                             type: string
 *                       assignedTo:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       responseTime:
 *                         type: number
 *                         description: Average response time in hours
 *                       isEscalated:
 *                         type: boolean
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /admin/reports/export:
 *   post:
 *     tags:
 *       - Reports
 *     summary: Generate administrative report
 *     description: Generate and export administrative reports
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reportType, format, period]
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [user_activity, platform_metrics, financial_summary, safety_report, moderation_stats]
 *                 description: Type of report to generate
 *               format:
 *                 type: string
 *                 enum: [PDF, CSV, XLSX, JSON]
 *                 description: Export format
 *               period:
 *                 type: object
 *                 required: [from, to]
 *                 properties:
 *                   from:
 *                     type: string
 *                     format: date
 *                   to:
 *                     type: string
 *                     format: date
 *               filters:
 *                 type: object
 *                 description: Additional filters for the report
 *               includeCharts:
 *                 type: boolean
 *                 default: true
 *                 description: Include charts and visualizations (PDF only)
 *     responses:
 *       '202':
 *         description: Report generation started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: accepted
 *                 data:
 *                   type: object
 *                   properties:
 *                     reportId:
 *                       type: string
 *                       format: uuid
 *                     estimatedCompletion:
 *                       type: string
 *                       format: date-time
 *                     downloadUrl:
 *                       type: string
 *                       format: uri
 *                       description: Available when report is ready
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */