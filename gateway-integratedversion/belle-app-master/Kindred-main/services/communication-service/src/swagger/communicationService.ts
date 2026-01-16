/**
 * @openapi
 * tags:
 *   - name: Chat
 *     description: Real-time messaging and chat functionality
 *   - name: Rooms
 *     description: Chat room management
 *   - name: Messages
 *     description: Message operations and history
 *   - name: Media
 *     description: Media sharing and voice notes
 *   - name: Communication Analytics
 *     description: Communication analytics and insights
 */

/**
 * @openapi
 * /chat/rooms:
 *   get:
 *     tags:
 *       - Rooms
 *     summary: Get user's chat rooms
 *     description: Retrieve all chat rooms the user is a participant in
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
 *         description: Number of rooms per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PRIVATE, GROUP]
 *         description: Filter by room type
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Show only rooms with unread messages
 *     responses:
 *       '200':
 *         description: Chat rooms retrieved successfully
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
 *                       room:
 *                         $ref: '#/components/schemas/ChatRoom'
 *                       lastMessage:
 *                         $ref: '#/components/schemas/Message'
 *                       unreadCount:
 *                         type: integer
 *                         description: Number of unread messages
 *                       otherParticipant:
 *                         $ref: '#/components/schemas/User'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   post:
 *     tags:
 *       - Rooms
 *     summary: Create a new chat room
 *     description: Create a new chat room with specified participants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participantIds, roomType]
 *             properties:
 *               participantIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of participant user IDs
 *                 minItems: 1
 *                 maxItems: 10
 *               roomType:
 *                 type: string
 *                 enum: [PRIVATE, GROUP]
 *                 description: Type of room to create
 *               roomName:
 *                 type: string
 *                 maxLength: 100
 *                 description: Room name (required for group rooms)
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Room description
 *     responses:
 *       '201':
 *         description: Chat room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ChatRoom'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '409':
 *         description: Room already exists between these participants
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /chat/rooms/{roomId}:
 *   get:
 *     tags:
 *       - Rooms
 *     summary: Get chat room details
 *     description: Get detailed information about a specific chat room
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat room ID
 *     responses:
 *       '200':
 *         description: Chat room details retrieved successfully
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
 *                     room:
 *                       $ref: '#/components/schemas/ChatRoom'
 *                     participants:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     messageCount:
 *                       type: integer
 *                     userRole:
 *                       type: string
 *                       enum: [PARTICIPANT, ADMIN, CREATOR]
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
 * /chat/rooms/{roomId}/messages:
 *   get:
 *     tags:
 *       - Messages
 *     summary: Get room messages
 *     description: Retrieve messages from a chat room with pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat room ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number (newest first)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of messages per page
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Get messages before this timestamp
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Get messages after this timestamp
 *       - in: query
 *         name: messageType
 *         schema:
 *           type: string
 *           enum: [TEXT, IMAGE, VIDEO, VOICE_NOTE, STICKER]
 *         description: Filter by message type
 *     responses:
 *       '200':
 *         description: Messages retrieved successfully
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
 *                     $ref: '#/components/schemas/Message'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   post:
 *     tags:
 *       - Messages
 *     summary: Send a message
 *     description: Send a new message to a chat room
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content, messageType]
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 4000
 *                 description: Message content
 *               messageType:
 *                 type: string
 *                 enum: [TEXT, IMAGE, VIDEO, VOICE_NOTE, STICKER]
 *                 description: Type of message
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                     type:
 *                       type: string
 *                       enum: [image, video, audio, document]
 *                     size:
 *                       type: integer
 *                     name:
 *                       type: string
 *                 description: Message attachments
 *               replyToId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of message being replied to
 *               metadata:
 *                 type: object
 *                 description: Additional message metadata
 *     responses:
 *       '201':
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '413':
 *         description: Message too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /chat/messages/{messageId}:
 *   put:
 *     tags:
 *       - Messages
 *     summary: Edit a message
 *     description: Edit an existing message (only by sender, within time limit)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 4000
 *                 description: New message content
 *     responses:
 *       '200':
 *         description: Message edited successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         description: Cannot edit this message (time limit exceeded or not sender)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   delete:
 *     tags:
 *       - Messages
 *     summary: Delete a message
 *     description: Delete an existing message (only by sender or room admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     responses:
 *       '200':
 *         description: Message deleted successfully
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
 *                   example: "Message deleted successfully"
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
 * /chat/messages/{messageId}/read:
 *   post:
 *     tags:
 *       - Messages
 *     summary: Mark message as read
 *     description: Mark a message as read by the current user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     responses:
 *       '200':
 *         description: Message marked as read
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
 *                     messageId:
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
 * /chat/rooms/{roomId}/read-all:
 *   post:
 *     tags:
 *       - Messages
 *     summary: Mark all messages as read
 *     description: Mark all messages in a room as read by the current user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat room ID
 *     responses:
 *       '200':
 *         description: All messages marked as read
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
 *                     roomId:
 *                       type: string
 *                       format: uuid
 *                     readCount:
 *                       type: integer
 *                       description: Number of messages marked as read
 *                     readAt:
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
 * /upload/media:
 *   post:
 *     tags:
 *       - Media
 *     summary: Upload media file
 *     description: Upload image, video, or document for sharing in chat
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, mediaType]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Media file to upload
 *               mediaType:
 *                 type: string
 *                 enum: [image, video, document]
 *                 description: Type of media being uploaded
 *               roomId:
 *                 type: string
 *                 format: uuid
 *                 description: Target room ID (for validation)
 *     responses:
 *       '201':
 *         description: Media uploaded successfully
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
 *                     fileId:
 *                       type: string
 *                       format: uuid
 *                     url:
 *                       type: string
 *                       format: uri
 *                     type:
 *                       type: string
 *                       enum: [image, video, document]
 *                     size:
 *                       type: integer
 *                       description: File size in bytes
 *                     filename:
 *                       type: string
 *                     uploadedAt:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '413':
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '415':
 *         description: Unsupported media type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /upload/voice-note:
 *   post:
 *     tags:
 *       - Media
 *     summary: Upload voice note
 *     description: Upload audio recording for voice note message
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [audio, duration]
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: Audio file (MP3, WAV, OGG, max 5MB)
 *               duration:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 300
 *                 description: Audio duration in seconds
 *               roomId:
 *                 type: string
 *                 format: uuid
 *                 description: Target room ID
 *     responses:
 *       '201':
 *         description: Voice note uploaded successfully
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
 *                     voiceNoteId:
 *                       type: string
 *                       format: uuid
 *                     url:
 *                       type: string
 *                       format: uri
 *                     duration:
 *                       type: integer
 *                       description: Duration in seconds
 *                     size:
 *                       type: integer
 *                       description: File size in bytes
 *                     waveform:
 *                       type: array
 *                       items:
 *                         type: number
 *                       description: Audio waveform data for visualization
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '413':
 *         description: Audio file too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /analytics/conversations/{roomId}:
 *   get:
 *     tags:
 *       - Communication Analytics
 *     summary: Get conversation analytics
 *     description: Get analytics data for a specific conversation (premium feature)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chat room ID
 *     responses:
 *       '200':
 *         description: Conversation analytics retrieved successfully
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
 *                     roomId:
 *                       type: string
 *                       format: uuid
 *                     messageCount:
 *                       type: integer
 *                     participantCount:
 *                       type: integer
 *                     averageResponseTime:
 *                       type: number
 *                       description: Average response time in minutes
 *                     conversationScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                       description: Conversation engagement score
 *                     messageTypes:
 *                       type: object
 *                       properties:
 *                         text:
 *                           type: integer
 *                         image:
 *                           type: integer
 *                         voiceNote:
 *                           type: integer
 *                         video:
 *                           type: integer
 *                     activityPattern:
 *                       type: object
 *                       properties:
 *                         mostActiveHour:
 *                           type: integer
 *                         averageSessionLength:
 *                           type: number
 *                         dailyMessageCount:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 format: date
 *                               count:
 *                                 type: integer
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         description: Premium feature - subscription required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */