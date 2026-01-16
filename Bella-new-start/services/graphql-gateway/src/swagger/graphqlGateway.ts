/**
 * @openapi
 * tags:
 *   - name: GraphQL Gateway
 *     description: Unified GraphQL API gateway for all microservices
 *   - name: Schema Management
 *     description: GraphQL schema federation and management
 *   - name: Query Operations
 *     description: GraphQL query operations across services
 *   - name: Mutation Operations
 *     description: GraphQL mutation operations across services
 *   - name: Subscription Operations
 *     description: Real-time GraphQL subscriptions
 *   - name: Gateway Analytics
 *     description: GraphQL gateway performance and usage analytics
 */

/**
 * @openapi
 * /graphql:
 *   post:
 *     tags:
 *       - GraphQL Gateway
 *     summary: Execute GraphQL operation
 *     description: Execute GraphQL queries, mutations, and subscriptions through the unified gateway
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 description: GraphQL query, mutation, or subscription
 *                 example: |
 *                   query GetUserProfile($userId: ID!) {
 *                     user(id: $userId) {
 *                       id
 *                       displayName
 *                       profile {
 *                         bio
 *                         interests
 *                         photos {
 *                           url
 *                           isMain
 *                         }
 *                       }
 *                       matches {
 *                         id
 *                         compatibilityScore
 *                         matchedAt
 *                         partner {
 *                           displayName
 *                           profile {
 *                             photos {
 *                               url
 *                             }
 *                           }
 *                         }
 *                       }
 *                     }
 *                   }
 *               variables:
 *                 type: object
 *                 description: GraphQL variables
 *                 example:
 *                   userId: "123e4567-e89b-12d3-a456-426614174000"
 *               operationName:
 *                 type: string
 *                 description: Operation name (for named operations)
 *                 example: "GetUserProfile"
 *     responses:
 *       '200':
 *         description: GraphQL operation executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   description: GraphQL response data
 *                   example:
 *                     user:
 *                       id: "123e4567-e89b-12d3-a456-426614174000"
 *                       displayName: "Sarah M."
 *                       profile:
 *                         bio: "Adventure seeker and coffee enthusiast"
 *                         interests: ["hiking", "photography", "travel"]
 *                         photos:
 *                           - url: "https://cdn.example.com/photo1.jpg"
 *                             isMain: true
 *                       matches:
 *                         - id: "match123"
 *                           compatibilityScore: 89.5
 *                           matchedAt: "2025-10-01T10:30:00Z"
 *                           partner:
 *                             displayName: "Alex K."
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       message:
 *                         type: string
 *                       locations:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             line:
 *                               type: integer
 *                             column:
 *                               type: integer
 *                       path:
 *                         type: array
 *                         items:
 *                           oneOf:
 *                             - type: string
 *                             - type: integer
 *                       extensions:
 *                         type: object
 *                 extensions:
 *                   type: object
 *                   properties:
 *                     tracing:
 *                       type: object
 *                     cacheControl:
 *                       type: object
 *       '400':
 *         description: GraphQL syntax error or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       message:
 *                         type: string
 *                         example: "Syntax Error: Expected Name, found }"
 *                       locations:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             line:
 *                               type: integer
 *                             column:
 *                               type: integer
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *   get:
 *     tags:
 *       - GraphQL Gateway
 *     summary: Execute GraphQL operation via GET
 *     description: Execute simple GraphQL queries via GET request (useful for caching)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: GraphQL query string
 *         example: "query { me { id displayName } }"
 *       - in: query
 *         name: variables
 *         schema:
 *           type: string
 *         description: JSON-encoded variables
 *       - in: query
 *         name: operationName
 *         schema:
 *           type: string
 *         description: Operation name
 *     responses:
 *       '200':
 *         description: GraphQL query executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       '400':
 *         description: Invalid query or parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       '405':
 *         description: GET not allowed for mutations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       message:
 *                         type: string
 *                         example: "Can only perform a mutation operation using a POST request"
 */

/**
 * @openapi
 * /graphql/schema:
 *   get:
 *     tags:
 *       - Schema Management
 *     summary: Get GraphQL schema
 *     description: Retrieve the complete federated GraphQL schema definition
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: GraphQL schema retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     __schema:
 *                       type: object
 *                       properties:
 *                         types:
 *                           type: array
 *                           items:
 *                             type: object
 *                         queryType:
 *                           type: object
 *                         mutationType:
 *                           type: object
 *                         subscriptionType:
 *                           type: object
 *                         directives:
 *                           type: array
 *                           items:
 *                             type: object
 *           text/plain:
 *             schema:
 *               type: string
 *               description: SDL (Schema Definition Language) format
 *               example: |
 *                 type User {
 *                   id: ID!
 *                   email: String!
 *                   displayName: String!
 *                   profile: DatingProfile
 *                   matches: [Match!]!
 *                   sessions: [InteractionSession!]!
 *                   createdAt: DateTime!
 *                   updatedAt: DateTime!
 *                 }
 *                 
 *                 type DatingProfile {
 *                   userId: ID!
 *                   bio: String
 *                   age: Int!
 *                   location: Location!
 *                   interests: [String!]!
 *                   photos: [Photo!]!
 *                   preferences: MatchingPreferences!
 *                   verification: VerificationStatus!
 *                 }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /graphql/playground:
 *   get:
 *     tags:
 *       - Schema Management
 *     summary: GraphQL Playground IDE
 *     description: Access GraphQL Playground IDE for interactive query development (development only)
 *     responses:
 *       '200':
 *         description: GraphQL Playground HTML interface
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       '404':
 *         description: Playground not available in production
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /graphql/subscriptions:
 *   get:
 *     tags:
 *       - Subscription Operations
 *     summary: WebSocket endpoint for GraphQL subscriptions
 *     description: WebSocket endpoint for real-time GraphQL subscriptions using graphql-ws protocol
 *     parameters:
 *       - in: header
 *         name: Sec-WebSocket-Protocol
 *         schema:
 *           type: string
 *           enum: [graphql-ws, graphql-transport-ws]
 *         description: WebSocket subprotocol for GraphQL subscriptions
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *         description: Bearer token for authentication
 *     responses:
 *       '101':
 *         description: WebSocket connection established
 *         headers:
 *           Upgrade:
 *             schema:
 *               type: string
 *               example: websocket
 *           Connection:
 *             schema:
 *               type: string
 *               example: Upgrade
 *           Sec-WebSocket-Accept:
 *             schema:
 *               type: string
 *           Sec-WebSocket-Protocol:
 *             schema:
 *               type: string
 *               example: graphql-ws
 *       '400':
 *         description: Invalid WebSocket request
 *       '401':
 *         description: Authentication required for subscriptions
 *       '426':
 *         description: Upgrade required
 */

/**
 * @openapi
 * /graphql/health:
 *   get:
 *     tags:
 *       - GraphQL Gateway
 *     summary: Gateway health check
 *     description: Check health status of GraphQL gateway and connected services
 *     responses:
 *       '200':
 *         description: Gateway is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 gateway:
 *                   type: object
 *                   properties:
 *                     version:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                       description: Uptime in seconds
 *                     schemaHash:
 *                       type: string
 *                       description: Current schema hash
 *                 services:
 *                   type: object
 *                   properties:
 *                     userService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                           description: Average response time in ms
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *                     queueService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *                     interactionService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *                     communicationService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *                     historyService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *                     analyticsService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *                     adminService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *                     notificationService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *                     moderationService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                         lastCheck:
 *                           type: string
 *                           format: date-time
 *       '503':
 *         description: One or more services are unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: degraded
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                 services:
 *                   type: object
 *                   description: Service health details
 */

/**
 * @openapi
 * /graphql/metrics:
 *   get:
 *     tags:
 *       - Gateway Analytics
 *     summary: Get gateway metrics
 *     description: Get performance and usage metrics for the GraphQL gateway (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *         description: Metrics time period
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [minute, hour, day]
 *           default: hour
 *         description: Metrics granularity
 *     responses:
 *       '200':
 *         description: Gateway metrics retrieved successfully
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
 *                     requestMetrics:
 *                       type: object
 *                       properties:
 *                         totalRequests:
 *                           type: integer
 *                         successfulRequests:
 *                           type: integer
 *                         failedRequests:
 *                           type: integer
 *                         averageResponseTime:
 *                           type: number
 *                           description: Average response time in milliseconds
 *                         p95ResponseTime:
 *                           type: number
 *                           description: 95th percentile response time
 *                         p99ResponseTime:
 *                           type: number
 *                           description: 99th percentile response time
 *                         requestsPerSecond:
 *                           type: number
 *                           description: Average requests per second
 *                     operationMetrics:
 *                       type: object
 *                       properties:
 *                         queries:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: integer
 *                             averageResponseTime:
 *                               type: number
 *                             errorRate:
 *                               type: number
 *                         mutations:
 *                           type: object
 *                           properties:
 *                             count:
 *                               type: integer
 *                             averageResponseTime:
 *                               type: number
 *                             errorRate:
 *                               type: number
 *                         subscriptions:
 *                           type: object
 *                           properties:
 *                             activeConnections:
 *                               type: integer
 *                             totalSubscriptions:
 *                               type: integer
 *                             averageConnectionDuration:
 *                               type: number
 *                     serviceMetrics:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           requestCount:
 *                             type: integer
 *                           averageResponseTime:
 *                             type: number
 *                           errorRate:
 *                             type: number
 *                           availability:
 *                             type: number
 *                             description: Service availability percentage
 *                     popularOperations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           operationName:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           averageResponseTime:
 *                             type: number
 *                           complexity:
 *                             type: number
 *                             description: Query complexity score
 *                     errorBreakdown:
 *                       type: object
 *                       properties:
 *                         syntaxErrors:
 *                           type: integer
 *                         validationErrors:
 *                           type: integer
 *                         authenticationErrors:
 *                           type: integer
 *                         authorizationErrors:
 *                           type: integer
 *                         serviceErrors:
 *                           type: integer
 *                         timeoutErrors:
 *                           type: integer
 *                     cacheMetrics:
 *                       type: object
 *                       properties:
 *                         hitRate:
 *                           type: number
 *                           description: Cache hit rate percentage
 *                         missRate:
 *                           type: number
 *                           description: Cache miss rate percentage
 *                         averageResponseTime:
 *                           type: number
 *                           description: Average response time for cached queries
 *                         cacheSize:
 *                           type: integer
 *                           description: Current cache size in bytes
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           requestCount:
 *                             type: integer
 *                           averageResponseTime:
 *                             type: number
 *                           errorRate:
 *                             type: number
 *                           activeUsers:
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
 * /graphql/introspection:
 *   post:
 *     tags:
 *       - Schema Management
 *     summary: GraphQL introspection query
 *     description: Execute introspection queries to explore the schema
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 description: GraphQL introspection query
 *                 example: |
 *                   query IntrospectionQuery {
 *                     __schema {
 *                       queryType { name }
 *                       mutationType { name }
 *                       subscriptionType { name }
 *                       types {
 *                         ...FullType
 *                       }
 *                       directives {
 *                         name
 *                         description
 *                         locations
 *                         args {
 *                           ...InputValue
 *                         }
 *                       }
 *                     }
 *                   }
 *     responses:
 *       '200':
 *         description: Introspection query executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     __schema:
 *                       type: object
 *                       description: Complete schema introspection result
 *       '400':
 *         description: Invalid introspection query
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         description: Introspection disabled in production
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       message:
 *                         type: string
 *                         example: "GraphQL introspection is not allowed"
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /graphql/cache/clear:
 *   post:
 *     tags:
 *       - Gateway Analytics
 *     summary: Clear GraphQL cache
 *     description: Clear the GraphQL query cache (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cacheKeys:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specific cache keys to clear (optional, clears all if not provided)
 *               patterns:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Cache key patterns to match and clear
 *     responses:
 *       '200':
 *         description: Cache cleared successfully
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
 *                     clearedKeys:
 *                       type: integer
 *                       description: Number of cache keys cleared
 *                     remainingKeys:
 *                       type: integer
 *                       description: Number of cache keys remaining
 *                     clearedAt:
 *                       type: string
 *                       format: date-time
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */