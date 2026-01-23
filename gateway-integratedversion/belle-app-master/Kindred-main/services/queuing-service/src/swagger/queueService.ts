/**
 * @openapi
 * tags:
 *   - name: Queue
 *     description: User queue management and matching system
 *   - name: Matching
 *     description: Dating compatibility matching algorithms
 *   - name: Preferences
 *     description: User matching preferences management
 */

/**
 * @openapi
 * /queue/join:
 *   post:
 *     tags:
 *       - Queue
 *     summary: Join the matching queue
 *     description: Add user to the matching queue with their preferences and dating criteria
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferences:
 *                 type: object
 *                 properties:
 *                   intent:
 *                     type: string
 *                     enum: [CASUAL, DATING, SERIOUS, MARRIAGE]
 *                     description: Dating intention
 *                   ageRange:
 *                     type: object
 *                     properties:
 *                       min:
 *                         type: integer
 *                         minimum: 18
 *                         maximum: 100
 *                       max:
 *                         type: integer
 *                         minimum: 18
 *                         maximum: 100
 *                   maxDistance:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 500
 *                     description: Maximum distance in kilometers
 *                   genderPreference:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [MAN, WOMAN, NONBINARY]
 *                   minimumCompatibility:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     description: Minimum compatibility score (0-100)
 *               location:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *               callType:
 *                 type: string
 *                 enum: [AUDIO, VIDEO]
 *                 default: VIDEO
 *                 description: Preferred call type
 *     responses:
 *       '201':
 *         description: Successfully joined queue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/QueueEntry'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '409':
 *         description: User already in queue
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /queue/leave:
 *   post:
 *     tags:
 *       - Queue
 *     summary: Leave the matching queue
 *     description: Remove user from the matching queue
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Successfully left queue
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
 *                   example: "Successfully left queue"
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         description: User not in queue
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /queue/status:
 *   get:
 *     tags:
 *       - Queue
 *     summary: Get queue status
 *     description: Get current user's queue status and position
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Queue status retrieved successfully
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
 *                     inQueue:
 *                       type: boolean
 *                       description: Whether user is currently in queue
 *                     position:
 *                       type: integer
 *                       nullable: true
 *                       description: Current position in queue
 *                     estimatedWaitTime:
 *                       type: integer
 *                       nullable: true
 *                       description: Estimated wait time in seconds
 *                     joinedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Queue join timestamp
 *                     queueLength:
 *                       type: integer
 *                       description: Total queue length
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /queue/skip:
 *   post:
 *     tags:
 *       - Queue
 *     summary: Skip current match
 *     description: Skip the current match and continue looking for others
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [matchId]
 *             properties:
 *               matchId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the match to skip
 *               reason:
 *                 type: string
 *                 enum: [NOT_INTERESTED, POOR_CONNECTION, INAPPROPRIATE_BEHAVIOR, OTHER]
 *                 description: Reason for skipping
 *     responses:
 *       '200':
 *         description: Match skipped successfully
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
 *                   example: "Match skipped successfully"
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /matching/compatibility:
 *   post:
 *     tags:
 *       - Matching
 *     summary: Calculate compatibility score
 *     description: Calculate compatibility score between current user and another user using 12-dimensional algorithm
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetUserId]
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user to calculate compatibility with
 *               includeBreakdown:
 *                 type: boolean
 *                 default: false
 *                 description: Include detailed score breakdown
 *     responses:
 *       '200':
 *         description: Compatibility calculated successfully
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
 *                     compatibilityScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                       description: Overall compatibility percentage
 *                       example: 87.5
 *                     matchQuality:
 *                       type: string
 *                       enum: [POOR, FAIR, GOOD, EXCELLENT, EXCEPTIONAL]
 *                       description: Qualitative match assessment
 *                     breakdown:
 *                       type: object
 *                       description: Detailed score breakdown (if requested)
 *                       properties:
 *                         ageCompatibility:
 *                           type: number
 *                           example: 0.9
 *                         locationCompatibility:
 *                           type: number
 *                           example: 0.8
 *                         interestCompatibility:
 *                           type: number
 *                           example: 0.75
 *                         valueCompatibility:
 *                           type: number
 *                           example: 0.85
 *                         lifestyleCompatibility:
 *                           type: number
 *                           example: 0.88
 *                         # Include all 12 dimensions...
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /matching/discover:
 *   get:
 *     tags:
 *       - Matching
 *     summary: Discover potential matches
 *     description: Get a list of potential matches based on user preferences and compatibility
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of matches to return
 *       - in: query
 *         name: minCompatibility
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           default: 50
 *         description: Minimum compatibility score filter
 *       - in: query
 *         name: premiumOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Show only premium users (premium feature)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [compatibility, distance, recent, random]
 *           default: compatibility
 *         description: Sort order for results
 *     responses:
 *       '200':
 *         description: Potential matches retrieved successfully
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
 *                       user:
 *                         $ref: '#/components/schemas/DatingProfile'
 *                       compatibilityScore:
 *                         type: number
 *                         example: 87.5
 *                       distance:
 *                         type: number
 *                         description: Distance in kilometers
 *                         example: 15.2
 *                       matchReasons:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Reasons for the match
 *                         example: ["Shared interests", "Similar lifestyle", "Compatible age"]
 *                       isPremium:
 *                         type: boolean
 *                         description: Whether the matched user is premium
 *                 meta:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                       example: 150
 *                     averageCompatibility:
 *                       type: number
 *                       example: 72.3
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /matching/super-matches:
 *   get:
 *     tags:
 *       - Matching
 *     summary: Get super matches
 *     description: Get high-compatibility matches with 85%+ compatibility score (premium feature)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         description: Number of super matches to return
 *     responses:
 *       '200':
 *         description: Super matches retrieved successfully
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
 *                     $ref: '#/components/schemas/MatchResult'
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
 * /preferences:
 *   get:
 *     tags:
 *       - Preferences
 *     summary: Get user matching preferences
 *     description: Retrieve current user's matching preferences and filters
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Preferences retrieved successfully
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     ageRange:
 *                       type: object
 *                       properties:
 *                         min:
 *                           type: integer
 *                         max:
 *                           type: integer
 *                     maxDistance:
 *                       type: integer
 *                     genderPreferences:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [MAN, WOMAN, NONBINARY]
 *                     relationshipIntents:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [CASUAL, LONG_TERM, MARRIAGE, FRIENDSHIP]
 *                     dealBreakers:
 *                       type: array
 *                       items:
 *                         type: string
 *                     importanceWeights:
 *                       type: object
 *                       description: Importance weights for matching dimensions
 *                       properties:
 *                         ageImportance:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 1
 *                         locationImportance:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 1
 *                         # Include all dimension weights...
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   put:
 *     tags:
 *       - Preferences
 *     summary: Update matching preferences
 *     description: Update user's matching preferences and criteria
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ageRange:
 *                 type: object
 *                 properties:
 *                   min:
 *                     type: integer
 *                     minimum: 18
 *                     maximum: 100
 *                   max:
 *                     type: integer
 *                     minimum: 18
 *                     maximum: 100
 *               maxDistance:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 500
 *               genderPreferences:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [MAN, WOMAN, NONBINARY]
 *               relationshipIntents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [CASUAL, LONG_TERM, MARRIAGE, FRIENDSHIP]
 *               dealBreakers:
 *                 type: array
 *                 items:
 *                   type: string
 *               importanceWeights:
 *                 type: object
 *                 description: Importance weights for matching dimensions
 *     responses:
 *       '200':
 *         description: Preferences updated successfully
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
 *                   description: Updated preferences object
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /matching/feedback:
 *   post:
 *     tags:
 *       - Matching
 *     summary: Submit matching feedback
 *     description: Provide feedback on match quality to improve algorithm learning
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [matchId, feedback]
 *             properties:
 *               matchId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the match to provide feedback on
 *               feedback:
 *                 type: string
 *                 enum: [EXCELLENT, GOOD, FAIR, POOR, TERRIBLE]
 *                 description: Overall match quality feedback
 *               specificFeedback:
 *                 type: object
 *                 properties:
 *                   accurateAge:
 *                     type: boolean
 *                   accurateLocation:
 *                     type: boolean
 *                   sharedInterests:
 *                     type: boolean
 *                   attractiveness:
 *                     type: boolean
 *                   conversationQuality:
 *                     type: boolean
 *               additionalComments:
 *                 type: string
 *                 maxLength: 500
 *                 description: Additional feedback comments
 *     responses:
 *       '201':
 *         description: Feedback submitted successfully
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
 *                   example: "Feedback submitted successfully"
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */