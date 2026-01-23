/**
 * @openapi
 * tags:
 *   - name: Authentication
 *     description: User authentication and session management
 *   - name: Profile
 *     description: User profile management and dating preferences
 *   - name: Safety
 *     description: User safety features and reporting
 *   - name: Premium
 *     description: Premium subscription management
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     description: Creates a new user account with dating profile and returns authentication tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       '201':
 *         description: User registered successfully
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
 *                     tokens:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '409':
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Log in a user
 *     description: Authenticates a user and returns authentication tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: User logged in successfully
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
 *                     tokens:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh access token
 *     description: Generate new access token using refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *     responses:
 *       '200':
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/AuthTokens'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Log out user
 *     description: Invalidates user session and tokens
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: User logged out successfully
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
 *                   example: "Successfully logged out"
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify email address
 *     description: Verify user's email address using verification token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Email verification token
 *     responses:
 *       '200':
 *         description: Email verified successfully
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
 *                   example: "Email verified successfully"
 *       '400':
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /profile:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Get current user's profile
 *     description: Retrieves the complete dating profile for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/DatingProfile'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   put:
 *     tags:
 *       - Profile
 *     summary: Update user profile
 *     description: Updates the dating profile for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       '200':
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/DatingProfile'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /profile/{userId}:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Get another user's profile
 *     description: Retrieves public profile information for another user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Target user ID
 *     responses:
 *       '200':
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/DatingProfile'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /profile/photos:
 *   post:
 *     tags:
 *       - Profile
 *     summary: Upload profile photo
 *     description: Upload a new profile photo
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Photo file (JPEG, PNG, max 5MB)
 *               primary:
 *                 type: boolean
 *                 description: Set as primary photo
 *                 default: false
 *     responses:
 *       '201':
 *         description: Photo uploaded successfully
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
 *                     photoUrl:
 *                       type: string
 *                       format: uri
 *                       example: "https://example.com/photos/user123_photo1.jpg"
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
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /profile/photos/{photoId}:
 *   delete:
 *     tags:
 *       - Profile
 *     summary: Delete profile photo
 *     description: Remove a profile photo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Photo identifier
 *     responses:
 *       '200':
 *         description: Photo deleted successfully
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
 *                   example: "Photo deleted successfully"
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /safety/report:
 *   post:
 *     tags:
 *       - Safety
 *     summary: Report a user
 *     description: Submit a report against another user for inappropriate behavior
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reportedUserId, reason]
 *             properties:
 *               reportedUserId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user being reported
 *               reason:
 *                 type: string
 *                 enum: [HARASSMENT, INAPPROPRIATE_CONTENT, SPAM, FAKE_PROFILE, OTHER]
 *                 description: Reason for the report
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Detailed description of the issue
 *               evidence:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 description: URLs to evidence (screenshots, etc.)
 *     responses:
 *       '201':
 *         description: Report submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/UserReport'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /safety/block:
 *   post:
 *     tags:
 *       - Safety
 *     summary: Block a user
 *     description: Block another user to prevent future interactions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [blockedUserId]
 *             properties:
 *               blockedUserId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user to block
 *               reason:
 *                 type: string
 *                 enum: [HARASSMENT, INAPPROPRIATE_BEHAVIOR, SPAM, OTHER]
 *                 description: Reason for blocking
 *     responses:
 *       '201':
 *         description: User blocked successfully
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
 *                   example: "User blocked successfully"
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '409':
 *         description: User already blocked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /safety/blocked:
 *   get:
 *     tags:
 *       - Safety
 *     summary: Get blocked users list
 *     description: Retrieve list of users blocked by the current user
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
 *     responses:
 *       '200':
 *         description: Blocked users retrieved successfully
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
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       blockedUser:
 *                         $ref: '#/components/schemas/User'
 *                       reason:
 *                         type: string
 *                       blockedAt:
 *                         type: string
 *                         format: date-time
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /premium/subscribe:
 *   post:
 *     tags:
 *       - Premium
 *     summary: Subscribe to premium
 *     description: Subscribe to premium features with payment processing
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planType, paymentToken]
 *             properties:
 *               planType:
 *                 type: string
 *                 enum: [MONTHLY, QUARTERLY, YEARLY]
 *                 description: Subscription plan type
 *               paymentToken:
 *                 type: string
 *                 description: Stripe payment token
 *               promoCode:
 *                 type: string
 *                 description: Optional promotional code
 *     responses:
 *       '201':
 *         description: Subscription created successfully
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
 *                     subscriptionId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: active
 *                     planType:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '402':
 *         description: Payment failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */