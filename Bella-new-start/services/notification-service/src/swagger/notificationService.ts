/**
 * @openapi
 * tags:
 *   - name: Push Notifications
 *     description: Push notification management and delivery
 *   - name: Email Notifications
 *     description: Email notification system
 *   - name: In-App Notifications
 *     description: In-app notification management
 *   - name: Notification Preferences
 *     description: User notification preferences and settings
 *   - name: Notification Analytics
 *     description: Notification delivery and engagement analytics
 *   - name: Templates
 *     description: Notification template management
 */

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags:
 *       - In-App Notifications
 *     summary: Get user notifications
 *     description: Retrieve paginated list of user's in-app notifications
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
 *         description: Number of notifications per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [MATCH, MESSAGE, SYSTEM, SAFETY, PREMIUM, SOCIAL]
 *         description: Filter by notification type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [READ, UNREAD]
 *         description: Filter by read status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *         description: Filter by priority level
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter notifications from this date
 *     responses:
 *       '200':
 *         description: Notifications retrieved successfully
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
 *                     $ref: '#/components/schemas/Notification'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                     unreadCount:
 *                       type: integer
 *                       description: Total number of unread notifications
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /notifications/{notificationId}/read:
 *   post:
 *     tags:
 *       - In-App Notifications
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       '200':
 *         description: Notification marked as read
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
 *                     notificationId:
 *                       type: string
 *                       format: uuid
 *                     readAt:
 *                       type: string
 *                       format: date-time
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /notifications/read-all:
 *   post:
 *     tags:
 *       - In-App Notifications
 *     summary: Mark all notifications as read
 *     description: Mark all user notifications as read
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [MATCH, MESSAGE, SYSTEM, SAFETY, PREMIUM, SOCIAL]
 *                 description: Mark only specific type as read (optional)
 *               beforeDate:
 *                 type: string
 *                 format: date-time
 *                 description: Mark as read only notifications before this date
 *     responses:
 *       '200':
 *         description: All notifications marked as read
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
 *                     markedCount:
 *                       type: integer
 *                       description: Number of notifications marked as read
 *                     readAt:
 *                       type: string
 *                       format: date-time
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /notifications/{notificationId}:
 *   delete:
 *     tags:
 *       - In-App Notifications
 *     summary: Delete notification
 *     description: Delete a specific notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       '200':
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: "Notification deleted successfully"
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /notifications/send:
 *   post:
 *     tags:
 *       - Push Notifications
 *     summary: Send notification
 *     description: Send notification to specific users (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, title, message, recipients]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [PUSH, EMAIL, IN_APP, SMS]
 *                 description: Notification delivery method
 *               title:
 *                 type: string
 *                 maxLength: 100
 *                 description: Notification title
 *               message:
 *                 type: string
 *                 maxLength: 500
 *                 description: Notification content
 *               recipients:
 *                 type: object
 *                 oneOf:
 *                   - type: object
 *                     properties:
 *                       userIds:
 *                         type: array
 *                         items:
 *                           type: string
 *                           format: uuid
 *                         description: Specific user IDs
 *                   - type: object
 *                     properties:
 *                       segment:
 *                         type: string
 *                         enum: [ALL_USERS, PREMIUM_USERS, ACTIVE_USERS, INACTIVE_USERS]
 *                         description: User segment
 *                   - type: object
 *                     properties:
 *                       criteria:
 *                         type: object
 *                         properties:
 *                           subscriptionType:
 *                             type: string
 *                             enum: [FREE, PREMIUM, VIP]
 *                           ageRange:
 *                             type: object
 *                             properties:
 *                               min:
 *                                 type: integer
 *                               max:
 *                                 type: integer
 *                           location:
 *                             type: string
 *                           lastActiveWithin:
 *                             type: integer
 *                             description: Days since last activity
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 default: MEDIUM
 *                 description: Notification priority
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *                 description: Schedule notification for later delivery
 *               actionButton:
 *                 type: object
 *                 properties:
 *                   text:
 *                     type: string
 *                   action:
 *                     type: string
 *                     enum: [OPEN_APP, OPEN_URL, DEEP_LINK]
 *                   url:
 *                     type: string
 *                     format: uri
 *               metadata:
 *                 type: object
 *                 description: Additional notification metadata
 *     responses:
 *       '202':
 *         description: Notification queued for delivery
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
 *                     notificationId:
 *                       type: string
 *                       format: uuid
 *                     estimatedDelivery:
 *                       type: string
 *                       format: date-time
 *                     recipientCount:
 *                       type: integer
 *                       description: Number of recipients
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
 * /notifications/preferences:
 *   get:
 *     tags:
 *       - Notification Preferences
 *     summary: Get notification preferences
 *     description: Get user's notification preferences and settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Notification preferences retrieved successfully
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
 *                     pushNotifications:
 *                       type: object
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                         matches:
 *                           type: boolean
 *                         messages:
 *                           type: boolean
 *                         callRequests:
 *                           type: boolean
 *                         systemUpdates:
 *                           type: boolean
 *                         promotions:
 *                           type: boolean
 *                     emailNotifications:
 *                       type: object
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                         weeklyDigest:
 *                           type: boolean
 *                         matchSummaries:
 *                           type: boolean
 *                         safetyAlerts:
 *                           type: boolean
 *                         accountUpdates:
 *                           type: boolean
 *                         marketing:
 *                           type: boolean
 *                     inAppNotifications:
 *                       type: object
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                         sound:
 *                           type: boolean
 *                         vibration:
 *                           type: boolean
 *                         showPreviews:
 *                           type: boolean
 *                     quietHours:
 *                       type: object
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                         startTime:
 *                           type: string
 *                           format: time
 *                           example: "22:00"
 *                         endTime:
 *                           type: string
 *                           format: time
 *                           example: "08:00"
 *                         timezone:
 *                           type: string
 *                           example: "America/New_York"
 *                     frequency:
 *                       type: object
 *                       properties:
 *                         matches:
 *                           type: string
 *                           enum: [IMMEDIATE, HOURLY, DAILY, WEEKLY]
 *                         messages:
 *                           type: string
 *                           enum: [IMMEDIATE, HOURLY, DAILY, WEEKLY]
 *                         digest:
 *                           type: string
 *                           enum: [DAILY, WEEKLY, MONTHLY]
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   put:
 *     tags:
 *       - Notification Preferences
 *     summary: Update notification preferences
 *     description: Update user's notification preferences
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pushNotifications:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   matches:
 *                     type: boolean
 *                   messages:
 *                     type: boolean
 *                   callRequests:
 *                     type: boolean
 *                   systemUpdates:
 *                     type: boolean
 *                   promotions:
 *                     type: boolean
 *               emailNotifications:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   weeklyDigest:
 *                     type: boolean
 *                   matchSummaries:
 *                     type: boolean
 *                   safetyAlerts:
 *                     type: boolean
 *                   accountUpdates:
 *                     type: boolean
 *                   marketing:
 *                     type: boolean
 *               inAppNotifications:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   sound:
 *                     type: boolean
 *                   vibration:
 *                     type: boolean
 *                   showPreviews:
 *                     type: boolean
 *               quietHours:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   startTime:
 *                     type: string
 *                     format: time
 *                   endTime:
 *                     type: string
 *                     format: time
 *                   timezone:
 *                     type: string
 *               frequency:
 *                 type: object
 *                 properties:
 *                   matches:
 *                     type: string
 *                     enum: [IMMEDIATE, HOURLY, DAILY, WEEKLY]
 *                   messages:
 *                     type: string
 *                     enum: [IMMEDIATE, HOURLY, DAILY, WEEKLY]
 *                   digest:
 *                     type: string
 *                     enum: [DAILY, WEEKLY, MONTHLY]
 *     responses:
 *       '200':
 *         description: Notification preferences updated successfully
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
 *                     preferences:
 *                       type: object
 *                       description: Updated preferences object
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /notifications/devices:
 *   get:
 *     tags:
 *       - Push Notifications
 *     summary: Get registered devices
 *     description: Get list of user's registered devices for push notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Devices retrieved successfully
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
 *                       deviceId:
 *                         type: string
 *                         format: uuid
 *                       deviceToken:
 *                         type: string
 *                         description: Masked device token
 *                       platform:
 *                         type: string
 *                         enum: [IOS, ANDROID, WEB]
 *                       deviceName:
 *                         type: string
 *                         example: "iPhone 15 Pro"
 *                       appVersion:
 *                         type: string
 *                       registeredAt:
 *                         type: string
 *                         format: date-time
 *                       lastUsed:
 *                         type: string
 *                         format: date-time
 *                       isActive:
 *                         type: boolean
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   post:
 *     tags:
 *       - Push Notifications
 *     summary: Register device for push notifications
 *     description: Register a new device for receiving push notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceToken, platform]
 *             properties:
 *               deviceToken:
 *                 type: string
 *                 description: Device push notification token
 *               platform:
 *                 type: string
 *                 enum: [IOS, ANDROID, WEB]
 *                 description: Device platform
 *               deviceName:
 *                 type: string
 *                 maxLength: 100
 *                 description: Human-readable device name
 *               appVersion:
 *                 type: string
 *                 description: Application version
 *               metadata:
 *                 type: object
 *                 properties:
 *                   osVersion:
 *                     type: string
 *                   model:
 *                     type: string
 *                   manufacturer:
 *                     type: string
 *     responses:
 *       '201':
 *         description: Device registered successfully
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
 *                     deviceId:
 *                       type: string
 *                       format: uuid
 *                     registeredAt:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '409':
 *         description: Device already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /notifications/devices/{deviceId}:
 *   delete:
 *     tags:
 *       - Push Notifications
 *     summary: Unregister device
 *     description: Remove device from push notification registry
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Device ID
 *     responses:
 *       '200':
 *         description: Device unregistered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: "Device unregistered successfully"
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /notifications/analytics:
 *   get:
 *     tags:
 *       - Notification Analytics
 *     summary: Get notification analytics
 *     description: Get analytics about notification delivery and engagement (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter]
 *           default: week
 *         description: Analytics period
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PUSH, EMAIL, IN_APP, SMS]
 *         description: Filter by notification type
 *     responses:
 *       '200':
 *         description: Analytics retrieved successfully
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
 *                     deliveryStats:
 *                       type: object
 *                       properties:
 *                         totalSent:
 *                           type: integer
 *                         delivered:
 *                           type: integer
 *                         failed:
 *                           type: integer
 *                         deliveryRate:
 *                           type: number
 *                           description: Percentage of successful deliveries
 *                     engagementStats:
 *                       type: object
 *                       properties:
 *                         opened:
 *                           type: integer
 *                         clicked:
 *                           type: integer
 *                         dismissed:
 *                           type: integer
 *                         openRate:
 *                           type: number
 *                           description: Percentage of notifications opened
 *                         clickThroughRate:
 *                           type: number
 *                           description: Percentage of notifications clicked
 *                     byType:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           sent:
 *                             type: integer
 *                           delivered:
 *                             type: integer
 *                           opened:
 *                             type: integer
 *                           clicked:
 *                             type: integer
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           sent:
 *                             type: integer
 *                           delivered:
 *                             type: integer
 *                           opened:
 *                             type: integer
 *                           clicked:
 *                             type: integer
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /notifications/templates:
 *   get:
 *     tags:
 *       - Templates
 *     summary: Get notification templates
 *     description: Get list of notification templates (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PUSH, EMAIL, IN_APP, SMS]
 *         description: Filter by template type
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [MATCH, MESSAGE, SYSTEM, SAFETY, PREMIUM, MARKETING]
 *         description: Filter by template category
 *     responses:
 *       '200':
 *         description: Templates retrieved successfully
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
 *                       templateId:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [PUSH, EMAIL, IN_APP, SMS]
 *                       category:
 *                         type: string
 *                       subject:
 *                         type: string
 *                         nullable: true
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       variables:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Available template variables
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   post:
 *     tags:
 *       - Templates
 *     summary: Create notification template
 *     description: Create a new notification template (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, category, title, content]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: Template name
 *               type:
 *                 type: string
 *                 enum: [PUSH, EMAIL, IN_APP, SMS]
 *                 description: Template type
 *               category:
 *                 type: string
 *                 enum: [MATCH, MESSAGE, SYSTEM, SAFETY, PREMIUM, MARKETING]
 *                 description: Template category
 *               subject:
 *                 type: string
 *                 maxLength: 200
 *                 description: Template subject (email only)
 *               title:
 *                 type: string
 *                 maxLength: 100
 *                 description: Template title
 *               content:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Template content with variables
 *               variables:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Available template variables
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 description: Whether template is active
 *     responses:
 *       '201':
 *         description: Template created successfully
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
 *                     templateId:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */