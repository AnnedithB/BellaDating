/**
 * @openapi
 * tags:
 *   - name: History
 *     description: User interaction history and session management
 *   - name: Sessions
 *     description: Dating session history and analytics
 *   - name: Matches
 *     description: Match history and relationship tracking
 *   - name: History Analytics
 *     description: Personal dating insights and statistics
 *   - name: Export
 *     description: Data export and privacy compliance
 */

/**
 * @openapi
 * /history/sessions:
 *   get:
 *     tags:
 *       - Sessions
 *     summary: Get user's dating session history
 *     description: Retrieve paginated list of user's past dating sessions
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
 *         description: Number of sessions per page
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions until this date
 *       - in: query
 *         name: sessionType
 *         schema:
 *           type: string
 *           enum: [VIDEO, VOICE, CHAT]
 *         description: Filter by session type
 *       - in: query
 *         name: outcome
 *         schema:
 *           type: string
 *           enum: [COMPLETED, REJECTED, TERMINATED, REPORTED]
 *         description: Filter by session outcome
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         description: Filter by user rating given
 *     responses:
 *       '200':
 *         description: Session history retrieved successfully
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
 *                       sessionId:
 *                         type: string
 *                         format: uuid
 *                       partnerProfile:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                             format: uuid
 *                           displayName:
 *                             type: string
 *                           age:
 *                             type: integer
 *                           location:
 *                             type: string
 *                           profilePicture:
 *                             type: string
 *                             format: uri
 *                       sessionType:
 *                         type: string
 *                         enum: [VIDEO, VOICE, CHAT]
 *                       startTime:
 *                         type: string
 *                         format: date-time
 *                       endTime:
 *                         type: string
 *                         format: date-time
 *                       duration:
 *                         type: integer
 *                         description: Session duration in seconds
 *                       outcome:
 *                         type: string
 *                         enum: [COMPLETED, REJECTED, TERMINATED, REPORTED]
 *                       userRating:
 *                         type: integer
 *                         minimum: 1
 *                         maximum: 5
 *                         nullable: true
 *                       partnerRating:
 *                         type: integer
 *                         minimum: 1
 *                         maximum: 5
 *                         nullable: true
 *                       mutualMatch:
 *                         type: boolean
 *                         description: Whether both users matched
 *                       followUpAction:
 *                         type: string
 *                         enum: [NONE, CHAT_REQUESTED, SECOND_DATE, BLOCKED]
 *                         nullable: true
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /history/sessions/{sessionId}:
 *   get:
 *     tags:
 *       - Sessions
 *     summary: Get detailed session information
 *     description: Get comprehensive details about a specific dating session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     responses:
 *       '200':
 *         description: Session details retrieved successfully
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
 *                     session:
 *                       $ref: '#/components/schemas/InteractionSession'
 *                     partnerProfile:
 *                       $ref: '#/components/schemas/DatingProfile'
 *                     compatibilityScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                     sessionNotes:
 *                       type: string
 *                       description: User's private notes about the session
 *                     commonInterests:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Shared interests between users
 *                     conversationTopics:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Topics discussed during session
 *                     reportDetails:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         reason:
 *                           type: string
 *                         description:
 *                           type: string
 *                         reportedAt:
 *                           type: string
 *                           format: date-time
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
 * /history/sessions/{sessionId}/notes:
 *   put:
 *     tags:
 *       - Sessions
 *     summary: Update session notes
 *     description: Add or update private notes for a session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [notes]
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Private notes about the session
 *     responses:
 *       '200':
 *         description: Session notes updated successfully
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
 *                     sessionId:
 *                       type: string
 *                       format: uuid
 *                     notes:
 *                       type: string
 *                     updatedAt:
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
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /history/matches:
 *   get:
 *     tags:
 *       - Matches
 *     summary: Get match history
 *     description: Retrieve user's match history and relationship progression
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
 *           maximum: 50
 *           default: 20
 *         description: Number of matches per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, CHATTING, DATING, ENDED, BLOCKED]
 *         description: Filter by match status
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter matches from this date
 *       - in: query
 *         name: compatibilityMin
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         description: Minimum compatibility score
 *     responses:
 *       '200':
 *         description: Match history retrieved successfully
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
 *                       matchId:
 *                         type: string
 *                         format: uuid
 *                       partnerProfile:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                             format: uuid
 *                           displayName:
 *                             type: string
 *                           age:
 *                             type: integer
 *                           location:
 *                             type: string
 *                           profilePicture:
 *                             type: string
 *                             format: uri
 *                       matchedAt:
 *                         type: string
 *                         format: date-time
 *                       compatibilityScore:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 100
 *                       sessionCount:
 *                         type: integer
 *                         description: Number of sessions with this person
 *                       totalInteractionTime:
 *                         type: integer
 *                         description: Total time spent in sessions (seconds)
 *                       relationshipStatus:
 *                         type: string
 *                         enum: [ACTIVE, CHATTING, DATING, ENDED, BLOCKED]
 *                       lastInteraction:
 *                         type: string
 *                         format: date-time
 *                       averageRating:
 *                         type: number
 *                         minimum: 1
 *                         maximum: 5
 *                         nullable: true
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /analytics/personal:
 *   get:
 *     tags:
 *       - History Analytics
 *     summary: Get personal dating analytics
 *     description: Get comprehensive analytics about user's dating activity (premium feature)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year, all]
 *           default: month
 *         description: Time period for analytics
 *     responses:
 *       '200':
 *         description: Personal analytics retrieved successfully
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
 *                         totalSessions:
 *                           type: integer
 *                         totalMatches:
 *                           type: integer
 *                         averageSessionDuration:
 *                           type: number
 *                           description: Average session duration in minutes
 *                         matchRate:
 *                           type: number
 *                           description: Percentage of successful matches
 *                         averageRating:
 *                           type: number
 *                           minimum: 1
 *                           maximum: 5
 *                     activityPatterns:
 *                       type: object
 *                       properties:
 *                         preferredDays:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Days of week most active
 *                         preferredHours:
 *                           type: array
 *                           items:
 *                             type: integer
 *                           description: Hours of day most active
 *                         sessionFrequency:
 *                           type: number
 *                           description: Average sessions per week
 *                     preferences:
 *                       type: object
 *                       properties:
 *                         mostCompatibleAgeRange:
 *                           type: object
 *                           properties:
 *                             min:
 *                               type: integer
 *                             max:
 *                               type: integer
 *                         topCommonInterests:
 *                           type: array
 *                           items:
 *                             type: string
 *                         preferredSessionTypes:
 *                           type: object
 *                           properties:
 *                             video:
 *                               type: number
 *                             voice:
 *                               type: number
 *                             chat:
 *                               type: number
 *                     insights:
 *                       type: object
 *                       properties:
 *                         improvementSuggestions:
 *                           type: array
 *                           items:
 *                             type: string
 *                         personalityInsights:
 *                           type: array
 *                           items:
 *                             type: string
 *                         compatibilityFactors:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               factor:
 *                                 type: string
 *                               importance:
 *                                 type: number
 *                               userScore:
 *                                 type: number
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         description: Premium feature - subscription required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /analytics/trends:
 *   get:
 *     tags:
 *       - History Analytics
 *     summary: Get dating trends
 *     description: Get insights into user's dating patterns and trends over time
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Dating trends retrieved successfully
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
 *                     monthlyActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                             format: date
 *                           sessionCount:
 *                             type: integer
 *                           matchCount:
 *                             type: integer
 *                           averageRating:
 *                             type: number
 *                     compatibilityTrends:
 *                       type: object
 *                       properties:
 *                         improvingFactors:
 *                           type: array
 *                           items:
 *                             type: string
 *                         decliningFactors:
 *                           type: array
 *                           items:
 *                             type: string
 *                     behaviorChanges:
 *                       type: object
 *                       properties:
 *                         sessionTypePreferences:
 *                           type: object
 *                           description: How session type preferences changed
 *                         activityLevelChange:
 *                           type: number
 *                           description: Percentage change in activity
 *                         satisfactionTrend:
 *                           type: string
 *                           enum: [improving, stable, declining]
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /export/data:
 *   post:
 *     tags:
 *       - Export
 *     summary: Request data export
 *     description: Request export of user's personal data for GDPR compliance
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dataTypes, format]
 *             properties:
 *               dataTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [profile, sessions, matches, messages, analytics, safety_reports]
 *                 description: Types of data to export
 *               format:
 *                 type: string
 *                 enum: [JSON, CSV]
 *                 description: Export format
 *               dateRange:
 *                 type: object
 *                 properties:
 *                   from:
 *                     type: string
 *                     format: date
 *                   to:
 *                     type: string
 *                     format: date
 *                 description: Date range for data export
 *     responses:
 *       '202':
 *         description: Data export request accepted
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
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *                     estimatedCompletion:
 *                       type: string
 *                       format: date-time
 *                     message:
 *                       type: string
 *                       example: "Data export request submitted. You will receive an email when ready."
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '429':
 *         description: Too many export requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /export/status/{requestId}:
 *   get:
 *     tags:
 *       - Export
 *     summary: Check export status
 *     description: Check the status of a data export request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Export request ID
 *     responses:
 *       '200':
 *         description: Export status retrieved successfully
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
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       enum: [PENDING, PROCESSING, COMPLETED, FAILED, EXPIRED]
 *                     progress:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 100
 *                     downloadUrl:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                       description: Available when status is COMPLETED
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: When download link expires
 *                     error:
 *                       type: string
 *                       nullable: true
 *                       description: Error message if status is FAILED
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /history/delete:
 *   delete:
 *     tags:
 *       - History
 *     summary: Delete user history
 *     description: Delete specific types of user history data
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dataTypes]
 *             properties:
 *               dataTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [sessions, matches, notes, analytics]
 *                 description: Types of data to delete
 *               dateRange:
 *                 type: object
 *                 properties:
 *                   from:
 *                     type: string
 *                     format: date
 *                   to:
 *                     type: string
 *                     format: date
 *                 description: Date range for data deletion
 *               confirmationCode:
 *                 type: string
 *                 description: Confirmation code sent to user's email
 *     responses:
 *       '200':
 *         description: History data deleted successfully
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
 *                     deletedItems:
 *                       type: object
 *                       properties:
 *                         sessions:
 *                           type: integer
 *                         matches:
 *                           type: integer
 *                         notes:
 *                           type: integer
 *                     deletedAt:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         description: Invalid confirmation code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */