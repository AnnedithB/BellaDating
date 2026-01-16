/**
 * @openapi
 * tags:
 *   - name: Platform Analytics
 *     description: Platform-wide analytics and insights
 *   - name: User Analytics
 *     description: Individual user behavior analytics
 *   - name: Match Analytics
 *     description: Matching algorithm performance and insights
 *   - name: Safety Analytics
 *     description: Safety and moderation analytics
 *   - name: Business Intelligence
 *     description: Business metrics and KPIs
 *   - name: Real-time Metrics
 *     description: Live platform metrics and monitoring
 */

/**
 * @openapi
 * /analytics/platform/overview:
 *   get:
 *     tags:
 *       - Platform Analytics
 *     summary: Get platform overview analytics
 *     description: Get high-level platform metrics and KPIs (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *         description: Time period for analytics
 *       - in: query
 *         name: compareWith
 *         schema:
 *           type: string
 *           enum: [previous_period, last_year, baseline]
 *         description: Comparison baseline
 *     responses:
 *       '200':
 *         description: Platform analytics retrieved successfully
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
 *                     userMetrics:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: integer
 *                         activeUsers:
 *                           type: integer
 *                         newRegistrations:
 *                           type: integer
 *                         userRetention:
 *                           type: number
 *                           description: 30-day retention rate
 *                         averageSessionDuration:
 *                           type: number
 *                           description: Average session duration in minutes
 *                     matchingMetrics:
 *                       type: object
 *                       properties:
 *                         totalMatches:
 *                           type: integer
 *                         successfulConnections:
 *                           type: integer
 *                         averageMatchTime:
 *                           type: number
 *                           description: Average time to find match in seconds
 *                         matchSuccessRate:
 *                           type: number
 *                           description: Percentage of successful matches
 *                         algorithmPerformance:
 *                           type: number
 *                           description: Algorithm efficiency score
 *                     engagementMetrics:
 *                       type: object
 *                       properties:
 *                         totalSessions:
 *                           type: integer
 *                         averageSessionsPerUser:
 *                           type: number
 *                         messagesSent:
 *                           type: integer
 *                         videoCallMinutes:
 *                           type: integer
 *                         userSatisfactionScore:
 *                           type: number
 *                           minimum: 1
 *                           maximum: 5
 *                     revenueMetrics:
 *                       type: object
 *                       properties:
 *                         totalRevenue:
 *                           type: number
 *                         premiumSubscriptions:
 *                           type: integer
 *                         averageRevenuePerUser:
 *                           type: number
 *                         conversionRate:
 *                           type: number
 *                           description: Free to premium conversion rate
 *                     comparison:
 *                       type: object
 *                       nullable: true
 *                       description: Comparison data if compareWith parameter provided
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /analytics/users/behavior:
 *   get:
 *     tags:
 *       - User Analytics
 *     summary: Get user behavior analytics
 *     description: Analyze user behavior patterns across the platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: segmentBy
 *         schema:
 *           type: string
 *           enum: [age_group, location, subscription_type, activity_level]
 *         description: Segment users by specific criteria
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter]
 *           default: month
 *         description: Analysis period
 *     responses:
 *       '200':
 *         description: User behavior analytics retrieved successfully
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
 *                     segments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           segmentName:
 *                             type: string
 *                           userCount:
 *                             type: integer
 *                           averageSessionsPerWeek:
 *                             type: number
 *                           averageMatchTime:
 *                             type: number
 *                           preferredFeatures:
 *                             type: array
 *                             items:
 *                               type: string
 *                           churnRate:
 *                             type: number
 *                           satisfactionScore:
 *                             type: number
 *                     behaviorPatterns:
 *                       type: object
 *                       properties:
 *                         peakUsageHours:
 *                           type: array
 *                           items:
 *                             type: integer
 *                         popularDays:
 *                           type: array
 *                           items:
 *                             type: string
 *                         sessionTypePreferences:
 *                           type: object
 *                           properties:
 *                             video:
 *                               type: number
 *                             voice:
 *                               type: number
 *                             chat:
 *                               type: number
 *                         featureUsage:
 *                           type: object
 *                           additionalProperties:
 *                             type: number
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /analytics/matching/performance:
 *   get:
 *     tags:
 *       - Match Analytics
 *     summary: Get matching algorithm performance
 *     description: Analyze the performance of the 12-dimensional matching algorithm
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dimension
 *         schema:
 *           type: string
 *           enum: [age, location, interests, lifestyle, values, goals, personality, education, career, family_plans, physical_preferences, communication_style]
 *         description: Focus on specific compatibility dimension
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter]
 *           default: month
 *         description: Analysis period
 *     responses:
 *       '200':
 *         description: Matching performance analytics retrieved successfully
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
 *                     algorithmPerformance:
 *                       type: object
 *                       properties:
 *                         overallSuccessRate:
 *                           type: number
 *                           description: Percentage of successful matches
 *                         averageCompatibilityScore:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 100
 *                         matchingAccuracy:
 *                           type: number
 *                           description: Algorithm prediction accuracy
 *                         improvementTrend:
 *                           type: string
 *                           enum: [improving, stable, declining]
 *                     dimensionAnalysis:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dimension:
 *                             type: string
 *                           importance:
 *                             type: number
 *                             description: Relative importance in successful matches
 *                           predictivePower:
 *                             type: number
 *                             description: How well this dimension predicts success
 *                           averageScore:
 *                             type: number
 *                           distributionStats:
 *                             type: object
 *                             properties:
 *                               min:
 *                                 type: number
 *                               max:
 *                                 type: number
 *                               median:
 *                                 type: number
 *                               standardDeviation:
 *                                 type: number
 *                     optimizationSuggestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dimension:
 *                             type: string
 *                           suggestion:
 *                             type: string
 *                           potentialImprovement:
 *                             type: number
 *                           implementationComplexity:
 *                             type: string
 *                             enum: [low, medium, high]
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /analytics/safety/reports:
 *   get:
 *     tags:
 *       - Safety Analytics
 *     summary: Get safety and moderation analytics
 *     description: Analyze safety reports and moderation effectiveness
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: reportType
 *         schema:
 *           type: string
 *           enum: [harassment, inappropriate_behavior, fake_profile, spam, other]
 *         description: Filter by report type
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter]
 *           default: month
 *         description: Analysis period
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity level
 *     responses:
 *       '200':
 *         description: Safety analytics retrieved successfully
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
 *                     reportStatistics:
 *                       type: object
 *                       properties:
 *                         totalReports:
 *                           type: integer
 *                         reportsByType:
 *                           type: object
 *                           additionalProperties:
 *                             type: integer
 *                         reportsBySeverity:
 *                           type: object
 *                           additionalProperties:
 *                             type: integer
 *                         averageResolutionTime:
 *                           type: number
 *                           description: Average time to resolve reports in hours
 *                         falsePositiveRate:
 *                           type: number
 *                           description: Percentage of reports that were false positives
 *                     moderationEffectiveness:
 *                       type: object
 *                       properties:
 *                         actionsTaken:
 *                           type: object
 *                           properties:
 *                             warnings:
 *                               type: integer
 *                             temporaryBans:
 *                               type: integer
 *                             permanentBans:
 *                               type: integer
 *                             profileRemovals:
 *                               type: integer
 *                         repeatOffenderRate:
 *                           type: number
 *                         userSafetyScore:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 100
 *                           description: Overall platform safety score
 *                     trends:
 *                       type: object
 *                       properties:
 *                         reportTrend:
 *                           type: string
 *                           enum: [increasing, stable, decreasing]
 *                         mostCommonIssues:
 *                           type: array
 *                           items:
 *                             type: string
 *                         riskFactors:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               factor:
 *                                 type: string
 *                               riskLevel:
 *                                 type: string
 *                                 enum: [low, medium, high]
 *                               description:
 *                                 type: string
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /analytics/business/kpis:
 *   get:
 *     tags:
 *       - Business Intelligence
 *     summary: Get key business performance indicators
 *     description: Retrieve critical business metrics and KPIs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Time period for KPIs
 *       - in: query
 *         name: breakdown
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *         description: Breakdown granularity
 *     responses:
 *       '200':
 *         description: Business KPIs retrieved successfully
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
 *                     financialKPIs:
 *                       type: object
 *                       properties:
 *                         revenue:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: number
 *                             subscription:
 *                               type: number
 *                             premium:
 *                               type: number
 *                             growth:
 *                               type: number
 *                               description: Percentage growth
 *                         costs:
 *                           type: object
 *                           properties:
 *                             operational:
 *                               type: number
 *                             marketing:
 *                               type: number
 *                             infrastructure:
 *                               type: number
 *                         profitability:
 *                           type: object
 *                           properties:
 *                             grossMargin:
 *                               type: number
 *                             netMargin:
 *                               type: number
 *                             ltv:
 *                               type: number
 *                               description: Customer lifetime value
 *                             cac:
 *                               type: number
 *                               description: Customer acquisition cost
 *                     userKPIs:
 *                       type: object
 *                       properties:
 *                         acquisition:
 *                           type: object
 *                           properties:
 *                             newUsers:
 *                               type: integer
 *                             growthRate:
 *                               type: number
 *                             acquisitionChannels:
 *                               type: object
 *                               additionalProperties:
 *                                 type: integer
 *                         retention:
 *                           type: object
 *                           properties:
 *                             day1:
 *                               type: number
 *                             day7:
 *                               type: number
 *                             day30:
 *                               type: number
 *                             churnRate:
 *                               type: number
 *                         engagement:
 *                           type: object
 *                           properties:
 *                             dau:
 *                               type: integer
 *                               description: Daily active users
 *                             mau:
 *                               type: integer
 *                               description: Monthly active users
 *                             sessionFrequency:
 *                               type: number
 *                             stickiness:
 *                               type: number
 *                               description: DAU/MAU ratio
 *                     operationalKPIs:
 *                       type: object
 *                       properties:
 *                         systemPerformance:
 *                           type: object
 *                           properties:
 *                             uptime:
 *                               type: number
 *                             responseTime:
 *                               type: number
 *                             errorRate:
 *                               type: number
 *                         supportMetrics:
 *                           type: object
 *                           properties:
 *                             ticketVolume:
 *                               type: integer
 *                             resolutionTime:
 *                               type: number
 *                             satisfactionScore:
 *                               type: number
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /analytics/realtime:
 *   get:
 *     tags:
 *       - Real-time Metrics
 *     summary: Get real-time platform metrics
 *     description: Get live metrics for monitoring platform health and activity
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Real-time metrics retrieved successfully
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
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     activeUsers:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         inQueue:
 *                           type: integer
 *                         inSession:
 *                           type: integer
 *                         browsing:
 *                           type: integer
 *                     systemHealth:
 *                       type: object
 *                       properties:
 *                         cpu:
 *                           type: number
 *                           description: CPU usage percentage
 *                         memory:
 *                           type: number
 *                           description: Memory usage percentage
 *                         responseTime:
 *                           type: number
 *                           description: Average response time in ms
 *                         errorRate:
 *                           type: number
 *                           description: Error rate percentage
 *                     activityMetrics:
 *                       type: object
 *                       properties:
 *                         sessionsStarted:
 *                           type: integer
 *                           description: Sessions started in last hour
 *                         messagesPerMinute:
 *                           type: number
 *                         newRegistrations:
 *                           type: integer
 *                           description: New registrations in last hour
 *                         successfulMatches:
 *                           type: integer
 *                           description: Successful matches in last hour
 *                     alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           level:
 *                             type: string
 *                             enum: [info, warning, error, critical]
 *                           message:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           service:
 *                             type: string
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @openapi
 * /analytics/export:
 *   post:
 *     tags:
 *       - Business Intelligence
 *     summary: Export analytics data
 *     description: Export analytics data in various formats for external analysis
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dataType, format, period]
 *             properties:
 *               dataType:
 *                 type: string
 *                 enum: [user_behavior, platform_metrics, matching_performance, safety_reports, financial_data]
 *                 description: Type of analytics data to export
 *               format:
 *                 type: string
 *                 enum: [CSV, JSON, XLSX, PDF]
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
 *                 description: Optional filters to apply to the data
 *               aggregation:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *                 description: Data aggregation level
 *     responses:
 *       '202':
 *         description: Export request accepted
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
 *                     exportId:
 *                       type: string
 *                       format: uuid
 *                     estimatedCompletion:
 *                       type: string
 *                       format: date-time
 *                     downloadUrl:
 *                       type: string
 *                       format: uri
 *                       description: Available when export is complete
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */