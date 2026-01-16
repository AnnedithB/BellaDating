/**
 * @openapi
 * tags:
 *   - name: Interaction
 *     description: Real-time voice and video call interactions
 *   - name: WebRTC
 *     description: WebRTC signaling and connection management
 *   - name: Call Control
 *     description: Call control features including female-centric controls
 *   - name: Session
 *     description: Interaction session management and analytics
 */

/**
 * @openapi
 * /interactions/initiate:
 *   post:
 *     tags:
 *       - Interaction
 *     summary: Initiate a new interaction
 *     description: Start a new voice or video call interaction between matched users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetUserId, callType]
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user to call
 *               callType:
 *                 type: string
 *                 enum: [AUDIO, VIDEO]
 *                 description: Type of call to initiate
 *               sessionData:
 *                 type: object
 *                 properties:
 *                   matchId:
 *                     type: string
 *                     format: uuid
 *                     description: Associated match ID
 *                   priority:
 *                     type: string
 *                     enum: [NORMAL, HIGH, PREMIUM]
 *                     description: Call priority level
 *     responses:
 *       '201':
 *         description: Interaction initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/InteractionSession'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         description: Target user not found or not available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: User already in an active call
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /interactions/{sessionId}/accept:
 *   post:
 *     tags:
 *       - Interaction
 *     summary: Accept incoming call
 *     description: Accept an incoming voice or video call
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID of the incoming call
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               callType:
 *                 type: string
 *                 enum: [AUDIO, VIDEO]
 *                 description: Accepted call type (can downgrade from video to audio)
 *               videoEnabled:
 *                 type: boolean
 *                 default: true
 *                 description: Enable video (female-centric control)
 *               audioEnabled:
 *                 type: boolean
 *                 default: true
 *                 description: Enable audio
 *     responses:
 *       '200':
 *         description: Call accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/InteractionSession'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '409':
 *         description: Call no longer available or already answered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /interactions/{sessionId}/reject:
 *   post:
 *     tags:
 *       - Interaction
 *     summary: Reject incoming call
 *     description: Reject an incoming voice or video call
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID of the incoming call
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [BUSY, NOT_INTERESTED, BAD_TIMING, OTHER]
 *                 description: Reason for rejecting the call
 *     responses:
 *       '200':
 *         description: Call rejected successfully
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
 *                   example: "Call rejected successfully"
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /interactions/{sessionId}/end:
 *   post:
 *     tags:
 *       - Interaction
 *     summary: End active call
 *     description: End an active voice or video call session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID of the active call
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [COMPLETED, CONNECTION_ISSUE, INAPPROPRIATE_BEHAVIOR, OTHER]
 *                 description: Reason for ending the call
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Call quality rating (1-5 stars)
 *               feedback:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional feedback about the call
 *     responses:
 *       '200':
 *         description: Call ended successfully
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
 *                     duration:
 *                       type: integer
 *                       description: Call duration in seconds
 *                     endedAt:
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
 * /interactions/{sessionId}/status:
 *   get:
 *     tags:
 *       - Interaction
 *     summary: Get interaction status
 *     description: Get current status of an interaction session
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
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/InteractionSession'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /webrtc/{sessionId}/signal:
 *   post:
 *     tags:
 *       - WebRTC
 *     summary: Send WebRTC signaling data
 *     description: Send WebRTC offer, answer, or ICE candidate data for call establishment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID for the WebRTC connection
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebRTCSignalData'
 *     responses:
 *       '200':
 *         description: Signal sent successfully
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
 *                   example: "Signal sent successfully"
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /call-control/{sessionId}/video:
 *   post:
 *     tags:
 *       - Call Control
 *     summary: Toggle video stream
 *     description: Enable or disable video stream during call (female-centric control)
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
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Enable or disable video stream
 *               reason:
 *                 type: string
 *                 enum: [PRIVACY, CONNECTION_ISSUE, PREFERENCE, OTHER]
 *                 description: Reason for toggling video
 *     responses:
 *       '200':
 *         description: Video stream toggled successfully
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
 *                     videoEnabled:
 *                       type: boolean
 *                     changedAt:
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
 * /call-control/{sessionId}/audio:
 *   post:
 *     tags:
 *       - Call Control
 *     summary: Toggle audio stream
 *     description: Mute or unmute audio stream during call
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
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Enable or disable audio stream
 *     responses:
 *       '200':
 *         description: Audio stream toggled successfully
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
 *                     audioEnabled:
 *                       type: boolean
 *                     changedAt:
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
 * /call-control/{sessionId}/report:
 *   post:
 *     tags:
 *       - Call Control
 *     summary: Report inappropriate behavior during call
 *     description: Report inappropriate behavior and immediately end the call
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
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [HARASSMENT, INAPPROPRIATE_CONTENT, ABUSIVE_LANGUAGE, NUDITY, OTHER]
 *                 description: Reason for the report
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Detailed description of the incident
 *               severity:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                 description: Severity level of the incident
 *     responses:
 *       '201':
 *         description: Report submitted successfully and call ended
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
 *                     callEnded:
 *                       type: boolean
 *                       example: true
 *                     moderationTriggered:
 *                       type: boolean
 *                       example: true
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /sessions/active:
 *   get:
 *     tags:
 *       - Session
 *     summary: Get active sessions
 *     description: Get all active interaction sessions for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Active sessions retrieved successfully
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
 *                     $ref: '#/components/schemas/InteractionSession'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /sessions/history:
 *   get:
 *     tags:
 *       - Session
 *     summary: Get session history
 *     description: Get interaction session history for the current user
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
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACTIVE, ENDED, INTERRUPTED]
 *         description: Filter by session status
 *       - in: query
 *         name: callType
 *         schema:
 *           type: string
 *           enum: [AUDIO, VIDEO]
 *         description: Filter by call type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions until this date
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
 *                     $ref: '#/components/schemas/InteractionSession'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /sessions/{sessionId}/analytics:
 *   get:
 *     tags:
 *       - Session
 *     summary: Get session analytics
 *     description: Get detailed analytics for a specific session
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
 *         description: Session analytics retrieved successfully
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
 *                     duration:
 *                       type: integer
 *                       description: Session duration in seconds
 *                     connectionQuality:
 *                       type: object
 *                       properties:
 *                         averageLatency:
 *                           type: number
 *                           description: Average latency in milliseconds
 *                         packetLoss:
 *                           type: number
 *                           description: Packet loss percentage
 *                         videoQuality:
 *                           type: string
 *                           enum: [LOW, MEDIUM, HIGH, HD]
 *                     userEngagement:
 *                       type: object
 *                       properties:
 *                         videoToggleCount:
 *                           type: integer
 *                         audioToggleCount:
 *                           type: integer
 *                         averageVideoOnTime:
 *                           type: number
 *                           description: Percentage of time video was on
 *                     compatibility:
 *                       type: object
 *                       properties:
 *                         initialScore:
 *                           type: number
 *                         postCallScore:
 *                           type: number
 *                         scoreDelta:
 *                           type: number
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */