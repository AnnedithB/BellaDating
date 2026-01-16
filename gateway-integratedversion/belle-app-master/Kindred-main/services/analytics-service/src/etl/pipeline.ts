import { PrismaClient } from '@prisma/client';
// Simple logger for ETL pipeline
class Logger {
  constructor(private context: string) {}
  
  info(message: string, ...args: any[]) {
    console.log(`[${new Date().toISOString()}] [${this.context}] INFO:`, message, ...args);
  }
  
  warn(message: string, ...args: any[]) {
    console.warn(`[${new Date().toISOString()}] [${this.context}] WARN:`, message, ...args);
  }
  
  error(message: string, ...args: any[]) {
    console.error(`[${new Date().toISOString()}] [${this.context}] ERROR:`, message, ...args);
  }
  
  debug(message: string, ...args: any[]) {
    console.debug(`[${new Date().toISOString()}] [${this.context}] DEBUG:`, message, ...args);
  }
}
import cron from 'node-cron';

// Multiple Prisma clients for different services
const analyticsDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

const userDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.USER_SERVICE_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

const interactionDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.INTERACTION_SERVICE_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

const communicationDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.COMMUNICATION_SERVICE_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

const logger = new Logger('ETL-Pipeline');

interface ETLJobContext {
  jobName: string;
  startTime: Date;
  recordsProcessed: number;
  dataQualityChecks: any[];
}

interface DataQualityCheck {
  name: string;
  expectedRange?: { min: number; max: number };
  expectedNotNull?: boolean;
  actualValue: any;
  passed: boolean;
  message: string;
}

/**
 * Main ETL Pipeline Orchestrator
 */
class ETLPipeline {
  private isRunning: boolean = false;
  private scheduledJobs: cron.ScheduledTask[] = [];

  constructor() {
    this.setupSchedules();
    this.setupGracefulShutdown();
  }

  /**
   * Start the ETL pipeline
   */
  public start(): void {
    logger.info('ETL Pipeline started');
  }

  /**
   * Stop the ETL pipeline
   */
  public stop(): void {
    this.scheduledJobs.forEach(job => job.stop());
    this.isRunning = false;
    logger.info('ETL Pipeline stopped');
  }

  /**
   * Public method to trigger daily KPI job manually
   */
  public async runDailyKPIJob(): Promise<void> {
    return this.runDailyKPIJobInternal();
  }

  /**
   * Public method to trigger hourly behavior job manually
   */
  public async runHourlyBehaviorJob(): Promise<void> {
    return this.runHourlyBehaviorJobInternal();
  }

  private setupSchedules(): void {
    // Daily KPI aggregation - runs at 1 AM UTC
    const dailyJob = cron.schedule('0 1 * * *', async () => {
      await this.runDailyKPIJobInternal();
    }, {
      timezone: 'UTC'
    });

    // Hourly user behavior events aggregation - runs every hour at minute 5
    const hourlyJob = cron.schedule('5 * * * *', async () => {
      await this.runHourlyBehaviorJobInternal();
    }, {
      timezone: 'UTC'
    });

    // Weekly retention cohort analysis - runs every Monday at 2 AM UTC
    const weeklyJob = cron.schedule('0 2 * * 1', async () => {
      await this.runWeeklyRetentionJob();
    }, {
      timezone: 'UTC'
    });

    // Real-time session analytics - runs every 15 minutes
    const sessionJob = cron.schedule('*/15 * * * *', async () => {
      await this.runSessionAnalyticsJob();
    }, {
      timezone: 'UTC'
    });

    this.scheduledJobs = [dailyJob, hourlyJob, weeklyJob, sessionJob];
    logger.info('ETL schedules configured successfully');
  }

  private setupGracefulShutdown(): void {
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      this.isRunning = false;
      await analyticsDb.$disconnect();
      await userDb.$disconnect();
      await interactionDb.$disconnect();
      await communicationDb.$disconnect();
      process.exit(0);
    });
  }

  /**
   * Daily KPI Aggregation Job
   */
  private async runDailyKPIJobInternal(): Promise<void> {
    if (this.isRunning) {
      logger.warn('ETL job already running, skipping...');
      return;
    }

    const context = await this.startETLJob('daily_kpi_aggregation');
    
    try {
      this.isRunning = true;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      logger.info(`Starting daily KPI aggregation for ${yesterday.toISOString()}`);

      // Extract data from various services
      const kpiData = await this.extractDailyKPIData(yesterday);
      
      // Perform data quality checks
      const qualityChecks = await this.performKPIDataQualityChecks(kpiData);
      context.dataQualityChecks = qualityChecks;

      // Transform and load data
      await this.loadDailyKPIData(yesterday, kpiData);
      
      context.recordsProcessed = 1; // One record per day
      await this.completeETLJob(context, 'completed');
      
    } catch (error) {
      await this.completeETLJob(context, 'failed', error as Error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Hourly User Behavior Events Job
   */
  private async runHourlyBehaviorJobInternal(): Promise<void> {
    const context = await this.startETLJob('hourly_behavior_events');
    
    try {
      const lastHour = new Date();
      lastHour.setHours(lastHour.getHours() - 1, 0, 0, 0);
      
      const nextHour = new Date(lastHour);
      nextHour.setHours(nextHour.getHours() + 1);

      logger.info(`Processing user behavior events for hour: ${lastHour.toISOString()}`);

      // Extract events from Mixpanel or event store
      const events = await this.extractUserBehaviorEvents(lastHour, nextHour);
      
      // Load events into analytics warehouse
      await this.loadUserBehaviorEvents(events);
      
      context.recordsProcessed = events.length;
      await this.completeETLJob(context, 'completed');
      
    } catch (error) {
      await this.completeETLJob(context, 'failed', error as Error);
      throw error;
    }
  }

  /**
   * Weekly Retention Cohort Analysis Job
   */
  private async runWeeklyRetentionJob(): Promise<void> {
    const context = await this.startETLJob('weekly_retention_analysis');
    
    try {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      lastWeek.setHours(0, 0, 0, 0);

      logger.info(`Starting retention cohort analysis for week: ${lastWeek.toISOString()}`);

      // Analyze retention for multiple cohort periods
      const cohortData = await this.calculateRetentionCohorts(lastWeek);
      
      // Load cohort data
      await this.loadRetentionCohorts(cohortData);
      
      context.recordsProcessed = cohortData.length;
      await this.completeETLJob(context, 'completed');
      
    } catch (error) {
      await this.completeETLJob(context, 'failed', error as Error);
      throw error;
    }
  }

  /**
   * Real-time Session Analytics Job
   */
  private async runSessionAnalyticsJob(): Promise<void> {
    const context = await this.startETLJob('session_analytics');
    
    try {
      const last15Minutes = new Date();
      last15Minutes.setMinutes(last15Minutes.getMinutes() - 15, 0, 0);
      
      const now = new Date();

      // Extract session data from interaction service
      const sessions = await this.extractSessionData(last15Minutes, now);
      
      // Process and load session analytics
      await this.loadSessionAnalytics(sessions);
      
      context.recordsProcessed = sessions.length;
      await this.completeETLJob(context, 'completed');
      
    } catch (error) {
      await this.completeETLJob(context, 'failed', error as Error);
    }
  }

  // ===========================================
  // DATA EXTRACTION METHODS
  // ===========================================

  private async extractDailyKPIData(date: Date): Promise<any> {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Extract from multiple services in parallel
    const [
      userMetrics,
      interactionMetrics,
      messageMetrics,
      revenueMetrics,
      safetyMetrics
    ] = await Promise.all([
      this.extractUserMetrics(date, nextDay),
      this.extractInteractionMetrics(date, nextDay),
      this.extractMessageMetrics(date, nextDay),
      this.extractRevenueMetrics(date, nextDay),
      this.extractSafetyMetrics(date, nextDay)
    ]);

    return {
      date,
      userMetrics,
      interactionMetrics,
      messageMetrics,
      revenueMetrics,
      safetyMetrics
    };
  }

  private async extractUserMetrics(startDate: Date, endDate: Date): Promise<any> {
    // Query the user-service database using actual schema table names
    try {
      const [newRegistrations, activeUsers, deletedAccounts] = await Promise.all([
        // New user registrations from users table
        userDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM users
          WHERE created_at >= ${startDate} AND created_at < ${endDate}
        `,
        // Active users from user_sessions table (users who had sessions)
        userDb.$queryRaw`
          SELECT COUNT(DISTINCT user_id)::int as count
          FROM user_sessions
          WHERE created_at >= ${startDate} AND created_at < ${endDate}
        `,
        // Deleted accounts (users who are no longer active)
        userDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM users
          WHERE is_active = false AND updated_at >= ${startDate} AND updated_at < ${endDate}
        `
      ]);

      return {
        newRegistrations: (newRegistrations as any)[0]?.count || 0,
        activeUsers: (activeUsers as any)[0]?.count || 0,
        deletedAccounts: (deletedAccounts as any)[0]?.count || 0
      };
    } catch (error) {
      logger.warn('Error extracting user metrics, returning defaults:', error);
      return {
        newRegistrations: 0,
        activeUsers: 0,
        deletedAccounts: 0
      };
    }
  }

  private async extractInteractionMetrics(startDate: Date, endDate: Date): Promise<any> {
    // Query interaction-service database using actual schema table names
    // The interaction-service uses 'interactions' table (not 'matches' or 'interaction_sessions')
    try {
      const [totalInteractions, completedInteractions, avgDuration, videoCallCount] = await Promise.all([
        // Total interactions started
        interactionDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM interactions
          WHERE created_at >= ${startDate} AND created_at < ${endDate}
        `,
        // Completed interactions (successful calls)
        interactionDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM interactions
          WHERE created_at >= ${startDate} AND created_at < ${endDate}
          AND status = 'COMPLETED'
        `,
        // Average call duration (in seconds)
        interactionDb.$queryRaw`
          SELECT COALESCE(AVG(duration), 0)::float as avg_duration
          FROM interactions
          WHERE created_at >= ${startDate} AND created_at < ${endDate}
          AND duration IS NOT NULL
        `,
        // Video calls count
        interactionDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM interactions
          WHERE created_at >= ${startDate} AND created_at < ${endDate}
          AND video_enabled = true
        `
      ]);

      return {
        totalMatches: (totalInteractions as any)[0]?.count || 0,
        totalSessions: (completedInteractions as any)[0]?.count || 0,
        avgSessionDuration: (avgDuration as any)[0]?.avg_duration || 0,
        videoCallCount: (videoCallCount as any)[0]?.count || 0
      };
    } catch (error) {
      logger.warn('Error extracting interaction metrics, returning defaults:', error);
      return {
        totalMatches: 0,
        totalSessions: 0,
        avgSessionDuration: 0,
        videoCallCount: 0
      };
    }
  }

  private async extractMessageMetrics(startDate: Date, endDate: Date): Promise<any> {
    // Query communication-service database using actual schema table names
    // Uses 'messages' table with 'room_id' column (not conversation_id)
    try {
      const [totalMessages, totalConversations, voiceMessages, imageMessages] = await Promise.all([
        // Total messages sent
        communicationDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM messages
          WHERE timestamp >= ${startDate} AND timestamp < ${endDate}
        `,
        // Unique rooms (conversations) with activity
        communicationDb.$queryRaw`
          SELECT COUNT(DISTINCT room_id)::int as count
          FROM messages
          WHERE timestamp >= ${startDate} AND timestamp < ${endDate}
        `,
        // Voice messages count
        communicationDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM messages
          WHERE timestamp >= ${startDate} AND timestamp < ${endDate}
          AND message_type = 'VOICE'
        `,
        // Image messages count
        communicationDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM messages
          WHERE timestamp >= ${startDate} AND timestamp < ${endDate}
          AND message_type = 'IMAGE'
        `
      ]);

      return {
        totalMessages: (totalMessages as any)[0]?.count || 0,
        totalConversations: (totalConversations as any)[0]?.count || 0,
        voiceMessages: (voiceMessages as any)[0]?.count || 0,
        imageMessages: (imageMessages as any)[0]?.count || 0
      };
    } catch (error) {
      logger.warn('Error extracting message metrics, returning defaults:', error);
      return {
        totalMessages: 0,
        totalConversations: 0,
        voiceMessages: 0,
        imageMessages: 0
      };
    }
  }

  private async extractRevenueMetrics(startDate: Date, endDate: Date): Promise<any> {
    // Revenue tracking: Currently no subscriptions/payments tables exist in the schema
    // We track premium users from the profiles table (is_premium flag)
    // TODO: Add subscription-service integration when payment system is implemented
    try {
      const [premiumUsers] = await Promise.all([
        // Count users who upgraded to premium
        userDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM profiles
          WHERE is_premium = true
          AND updated_at >= ${startDate} AND updated_at < ${endDate}
        `
      ]);

      // Placeholder revenue calculation (when payment system is added, this will be real)
      const premiumCount = (premiumUsers as any)[0]?.count || 0;

      return {
        subscriptionPurchases: premiumCount,
        totalRevenue: 0, // Will be populated when payment tables exist
        premiumUpgrades: premiumCount
      };
    } catch (error) {
      logger.warn('Error extracting revenue metrics, returning defaults:', error);
      return {
        subscriptionPurchases: 0,
        totalRevenue: 0,
        premiumUpgrades: 0
      };
    }
  }

  private async extractSafetyMetrics(startDate: Date, endDate: Date): Promise<any> {
    // Query user-service for safety data (user_reports, user_blocks tables exist in user-service schema)
    try {
      const [totalReports, userBlocks, resolvedReports] = await Promise.all([
        // Total reports submitted
        userDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM user_reports
          WHERE created_at >= ${startDate} AND created_at < ${endDate}
        `,
        // User blocks created
        userDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM user_blocks
          WHERE created_at >= ${startDate} AND created_at < ${endDate}
        `,
        // Reports resolved by moderation
        userDb.$queryRaw`
          SELECT COUNT(*)::int as count
          FROM user_reports
          WHERE reviewed_at >= ${startDate} AND reviewed_at < ${endDate}
          AND status IN ('resolved', 'rejected')
        `
      ]);

      return {
        totalReports: (totalReports as any)[0]?.count || 0,
        moderationActions: (resolvedReports as any)[0]?.count || 0,
        userBlocks: (userBlocks as any)[0]?.count || 0
      };
    } catch (error) {
      logger.warn('Error extracting safety metrics, returning defaults:', error);
      return {
        totalReports: 0,
        moderationActions: 0,
        userBlocks: 0
      };
    }
  }

  private async extractUserBehaviorEvents(startDate: Date, endDate: Date): Promise<any[]> {
    // This would typically pull from Mixpanel API or event stream
    // For now, simulate with empty array
    return [];
  }

  private async calculateRetentionCohorts(cohortWeek: Date): Promise<any[]> {
    // Complex retention calculation logic
    const cohorts = [];
    
    // Calculate for multiple periods (weeks 0-12)
    for (let periodNumber = 0; periodNumber <= 12; periodNumber++) {
      const retentionData = await this.calculateCohortRetention(cohortWeek, periodNumber);
      cohorts.push(retentionData);
    }
    
    return cohorts;
  }

  private async calculateCohortRetention(cohortWeek: Date, periodNumber: number): Promise<any> {
    const cohortEndWeek = new Date(cohortWeek);
    cohortEndWeek.setDate(cohortEndWeek.getDate() + 7);

    const periodStartWeek = new Date(cohortWeek);
    periodStartWeek.setDate(periodStartWeek.getDate() + (periodNumber * 7));

    const periodEndWeek = new Date(periodStartWeek);
    periodEndWeek.setDate(periodEndWeek.getDate() + 7);

    try {
      // Get cohort size (users who signed up in cohort week)
      const cohortSizeResult = await userDb.$queryRaw`
        SELECT COUNT(*)::int as count
        FROM users
        WHERE created_at >= ${cohortWeek} AND created_at < ${cohortEndWeek}
      `;
      const cohortSize = (cohortSizeResult as any)[0]?.count || 0;

      // Get returning users in the period (users who had a session)
      const returningUsersResult = await userDb.$queryRaw`
        SELECT COUNT(DISTINCT u.id)::int as count
        FROM users u
        INNER JOIN user_sessions s ON u.id = s.user_id
        WHERE u.created_at >= ${cohortWeek} AND u.created_at < ${cohortEndWeek}
        AND s.created_at >= ${periodStartWeek} AND s.created_at < ${periodEndWeek}
      `;
      const usersReturned = (returningUsersResult as any)[0]?.count || 0;

      const retentionRate = cohortSize > 0 ? (usersReturned / cohortSize) * 100 : 0;

      return {
        cohortWeek,
        periodNumber,
        cohortSize,
        usersReturned,
        retentionRate,
        avgSessionsPerUser: 0,
        avgMatchesPerUser: 0,
        avgRevenuePerUser: 0,
        subscriptionConvRate: 0
      };
    } catch (error) {
      logger.warn(`Error calculating cohort retention for period ${periodNumber}:`, error);
      return {
        cohortWeek,
        periodNumber,
        cohortSize: 0,
        usersReturned: 0,
        retentionRate: 0,
        avgSessionsPerUser: 0,
        avgMatchesPerUser: 0,
        avgRevenuePerUser: 0,
        subscriptionConvRate: 0
      };
    }
  }

  private async extractSessionData(startDate: Date, endDate: Date): Promise<any[]> {
    // Extract session data from interaction-service database
    // Uses 'interactions' table (actual schema name)
    try {
      const sessions = await interactionDb.$queryRaw`
        SELECT
          id,
          user1_id as user_id,
          room_id,
          status,
          call_type,
          started_at,
          ended_at,
          duration,
          video_enabled,
          quality_rating,
          connection_issues,
          user_agent,
          ip_address,
          updated_at
        FROM interactions
        WHERE updated_at >= ${startDate} AND updated_at < ${endDate}
      `;

      return sessions as any[];
    } catch (error) {
      logger.warn('Error extracting session data:', error);
      return [];
    }
  }

  // ===========================================
  // DATA LOADING METHODS
  // ===========================================

  private async loadDailyKPIData(date: Date, kpiData: any): Promise<void> {
    await analyticsDb.dailyKPISummary.upsert({
      where: {
        date_userDimensionId: {
          date,
          userDimensionId: null as any
        }
      },
      create: {
        date,
        totalActiveUsers: kpiData.userMetrics.activeUsers,
        newRegistrations: kpiData.userMetrics.newRegistrations,
        totalSessions: kpiData.interactionMetrics.totalSessions,
        avgSessionDuration: kpiData.interactionMetrics.avgSessionDuration,
        totalMatches: kpiData.interactionMetrics.totalMatches,
        totalMessages: kpiData.messageMetrics.totalMessages,
        totalRevenue: kpiData.revenueMetrics.totalRevenue,
        subscriptionPurchases: kpiData.revenueMetrics.subscriptionPurchases,
        avgSubscriptionValue: kpiData.revenueMetrics.subscriptionPurchases > 0 
          ? kpiData.revenueMetrics.totalRevenue / kpiData.revenueMetrics.subscriptionPurchases 
          : 0,
        totalReports: kpiData.safetyMetrics.totalReports,
        moderationActions: kpiData.safetyMetrics.moderationActions,
        userRetentionDay1: 0, // Would calculate from retention logic
        userRetentionDay7: 0,
        userRetentionDay30: 0,
        conversionToSubscription: 0, // Would calculate conversion rate
        avgTimeToFirstMatch: null,
        avgTimeToFirstMessage: null,
        totalVideoCallsInitiated: 0,
        totalVideoCallsCompleted: 0,
        avgVideoCallDuration: 0
      },
      update: {
        totalActiveUsers: kpiData.userMetrics.activeUsers,
        newRegistrations: kpiData.userMetrics.newRegistrations,
        totalSessions: kpiData.interactionMetrics.totalSessions,
        avgSessionDuration: kpiData.interactionMetrics.avgSessionDuration,
        totalMatches: kpiData.interactionMetrics.totalMatches,
        totalMessages: kpiData.messageMetrics.totalMessages,
        totalRevenue: kpiData.revenueMetrics.totalRevenue,
        subscriptionPurchases: kpiData.revenueMetrics.subscriptionPurchases,
        avgSubscriptionValue: kpiData.revenueMetrics.subscriptionPurchases > 0 
          ? kpiData.revenueMetrics.totalRevenue / kpiData.revenueMetrics.subscriptionPurchases 
          : 0,
        totalReports: kpiData.safetyMetrics.totalReports,
        moderationActions: kpiData.safetyMetrics.moderationActions,
        updatedAt: new Date()
      }
    });

    logger.info(`Loaded daily KPI data for ${date.toISOString()}`);
  }

  private async loadUserBehaviorEvents(events: any[]): Promise<void> {
    if (events.length === 0) return;

    // Batch insert user behavior events
    await analyticsDb.userBehaviorEvent.createMany({
      data: events.map(event => ({
        userId: event.user_id,
        sessionId: event.session_id,
        eventName: event.event_name,
        eventProperties: event.properties,
        eventTime: new Date(event.time),
        platform: event.properties.platform || 'unknown',
        appVersion: event.properties.app_version || 'unknown',
        deviceType: event.properties.device_type,
        locationCountry: event.properties.location_country,
        locationCity: event.properties.location_city
      })),
      skipDuplicates: true
    });

    logger.info(`Loaded ${events.length} user behavior events`);
  }

  private async loadRetentionCohorts(cohortData: any[]): Promise<void> {
    for (const cohort of cohortData) {
      await analyticsDb.retentionCohort.upsert({
        where: {
          cohortWeek_periodNumber_userDimensionId: {
            cohortWeek: cohort.cohortWeek,
            periodNumber: cohort.periodNumber,
            userDimensionId: null as any
          }
        },
        create: cohort,
        update: {
          ...cohort,
          updatedAt: new Date()
        }
      });
    }

    logger.info(`Loaded ${cohortData.length} retention cohort records`);
  }

  private async loadSessionAnalytics(sessions: any[]): Promise<void> {
    for (const session of sessions) {
      try {
        await analyticsDb.sessionAnalytics.upsert({
          where: {
            sessionId: session.id
          },
          create: {
            sessionId: session.id,
            userId: session.user_id,
            sessionStart: session.started_at,
            sessionEnd: session.ended_at,
            sessionDuration: session.duration || 0,
            screensViewed: 0,
            actionsTaken: 0,
            matchesInSession: 1, // Each interaction is a match session
            messagesInSession: 0,
            platform: this.extractPlatformFromUserAgent(session.user_agent),
            appVersion: 'unknown',
            deviceType: this.extractDeviceFromUserAgent(session.user_agent),
            connectionType: session.connection_issues ? 'unstable' : 'stable',
            batteryLevel: null,
            exitReason: session.status === 'COMPLETED' ? 'normal' : session.status
          },
          update: {
            sessionEnd: session.ended_at,
            sessionDuration: session.duration || 0,
            exitReason: session.status === 'COMPLETED' ? 'normal' : session.status,
            updatedAt: new Date()
          }
        });
      } catch (error) {
        logger.warn(`Error loading session analytics for ${session.id}:`, error);
      }
    }

    logger.info(`Loaded ${sessions.length} session analytics records`);
  }

  private extractPlatformFromUserAgent(userAgent: string | null): string {
    if (!userAgent) return 'unknown';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'ios';
    if (userAgent.includes('Android')) return 'android';
    if (userAgent.includes('Windows')) return 'windows';
    if (userAgent.includes('Mac')) return 'macos';
    return 'web';
  }

  private extractDeviceFromUserAgent(userAgent: string | null): string | null {
    if (!userAgent) return null;
    if (userAgent.includes('Mobile')) return 'mobile';
    if (userAgent.includes('Tablet')) return 'tablet';
    return 'desktop';
  }

  // ===========================================
  // DATA QUALITY & MONITORING
  // ===========================================

  private async performKPIDataQualityChecks(kpiData: any): Promise<DataQualityCheck[]> {
    const checks: DataQualityCheck[] = [];

    // Check for reasonable active user count
    checks.push({
      name: 'active_users_range',
      expectedRange: { min: 0, max: 1000000 },
      actualValue: kpiData.userMetrics.activeUsers,
      passed: kpiData.userMetrics.activeUsers >= 0 && kpiData.userMetrics.activeUsers <= 1000000,
      message: kpiData.userMetrics.activeUsers >= 0 && kpiData.userMetrics.activeUsers <= 1000000 
        ? 'Active users count within expected range' 
        : 'Active users count outside expected range'
    });

    // Check for non-negative revenue
    checks.push({
      name: 'revenue_non_negative',
      expectedRange: { min: 0, max: Infinity },
      actualValue: kpiData.revenueMetrics.totalRevenue,
      passed: kpiData.revenueMetrics.totalRevenue >= 0,
      message: kpiData.revenueMetrics.totalRevenue >= 0 
        ? 'Revenue is non-negative' 
        : 'Revenue is negative - investigate immediately'
    });

    // Check for reasonable session duration
    checks.push({
      name: 'session_duration_reasonable',
      expectedRange: { min: 0, max: 7200 }, // 0 to 2 hours
      actualValue: kpiData.interactionMetrics.avgSessionDuration,
      passed: kpiData.interactionMetrics.avgSessionDuration >= 0 && kpiData.interactionMetrics.avgSessionDuration <= 7200,
      message: kpiData.interactionMetrics.avgSessionDuration >= 0 && kpiData.interactionMetrics.avgSessionDuration <= 7200
        ? 'Average session duration within reasonable range'
        : 'Average session duration outside reasonable range'
    });

    // Alert on failed checks
    for (const check of checks) {
      if (!check.passed) {
        await this.createDataQualityAlert(
          'data_validation',
          'daily_kpi_summary',
          check.name,
          check.message,
          'medium',
          check.expectedRange?.max,
          check.actualValue
        );
      }
    }

    return checks;
  }

  private async createDataQualityAlert(
    alertType: string,
    tableName: string,
    columnName: string,
    message: string,
    severity: string,
    threshold?: number,
    actualValue?: any
  ): Promise<void> {
    await analyticsDb.dataQualityAlert.create({
      data: {
        alertType,
        tableName,
        columnName,
        alertMessage: message,
        severity,
        threshold,
        actualValue: actualValue !== undefined ? parseFloat(actualValue) : null
      }
    });

    logger.warn(`Data quality alert created: ${message}`);
  }

  // ===========================================
  // ETL JOB MANAGEMENT
  // ===========================================

  private async startETLJob(jobName: string): Promise<ETLJobContext> {
    const startTime = new Date();
    
    const jobRun = await analyticsDb.eTLJobRun.create({
      data: {
        jobName,
        startTime,
        status: 'running'
      }
    });

    logger.info(`Started ETL job: ${jobName} (ID: ${jobRun.id})`);

    return {
      jobName,
      startTime,
      recordsProcessed: 0,
      dataQualityChecks: []
    };
  }

  private async completeETLJob(
    context: ETLJobContext,
    status: 'completed' | 'failed',
    error?: Error
  ): Promise<void> {
    const endTime = new Date();
    const executionTimeMs = endTime.getTime() - context.startTime.getTime();

    await analyticsDb.eTLJobRun.updateMany({
      where: {
        jobName: context.jobName,
        startTime: context.startTime
      },
      data: {
        endTime,
        status,
        recordsProcessed: context.recordsProcessed,
        errorMessage: error?.message,
        executionTimeMs,
        dataQualityChecks: context.dataQualityChecks
      }
    });

    if (status === 'completed') {
      logger.info(`Completed ETL job: ${context.jobName} in ${executionTimeMs}ms. Processed ${context.recordsProcessed} records.`);
    } else {
      logger.error(`Failed ETL job: ${context.jobName} after ${executionTimeMs}ms. Error: ${error?.message}`);
    }
  }

  /**
   * Manual job execution methods for testing/admin
   */
  public async runJobManually(jobType: string): Promise<void> {
    switch (jobType) {
      case 'daily_kpi':
        await this.runDailyKPIJob();
        break;
      case 'hourly_behavior':
        await this.runHourlyBehaviorJob();
        break;
      case 'weekly_retention':
        await this.runWeeklyRetentionJob();
        break;
      case 'session_analytics':
        await this.runSessionAnalyticsJob();
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  }

  /**
   * Get ETL job status and history
   */
  public async getJobHistory(jobName?: string, limit: number = 50): Promise<any[]> {
    return await analyticsDb.eTLJobRun.findMany({
      where: jobName ? { jobName } : undefined,
      orderBy: { startTime: 'desc' },
      take: limit
    });
  }

  /**
   * Get data quality alerts
   */
  public async getDataQualityAlerts(isResolved?: boolean): Promise<any[]> {
    return await analyticsDb.dataQualityAlert.findMany({
      where: isResolved !== undefined ? { isResolved } : undefined,
      orderBy: { createdAt: 'desc' }
    });
  }
}

// Create and export singleton instance
const etlPipeline = new ETLPipeline();

export { etlPipeline, ETLPipeline };

// Start the pipeline if this file is executed directly
if (require.main === module) {
  logger.info('Starting ETL Pipeline service...');
  
  // Keep the process alive
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down ETL pipeline...');
    process.exit(0);
  });
}