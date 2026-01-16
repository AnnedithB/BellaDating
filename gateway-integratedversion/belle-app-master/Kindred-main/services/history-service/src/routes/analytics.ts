import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { requireAdmin } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { startOfDay, endOfDay, subDays, parse } from 'date-fns';
import Joi from 'joi';
import _ from 'lodash';

const router = express.Router();
const prisma = new PrismaClient();

const analyticsEventSchema = Joi.object({
  eventName: Joi.string().max(100).required(),
  payload: Joi.object().unknown(true).optional(),
  timestamp: Joi.date().optional(),
  sessionId: Joi.string().optional(),
  userId: Joi.string().optional()
});

const activeUserQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(30).default(7),
  endDate: Joi.date().optional()
});

// Track arbitrary analytics events
router.post('/events', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { error, value } = analyticsEventSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const eventTimestamp = value.timestamp ? new Date(value.timestamp) : new Date();
  const resolvedUserId = value.userId || req.user?.userId || null;

  const event = await prisma.analyticsEvent.create({
    data: {
      userId: resolvedUserId,
      sessionId: value.sessionId || null,
      eventName: value.eventName,
      payload: value.payload || undefined,
      eventTimestamp,
      ipAddress: extractClientIp(req),
      userAgent: req.get('user-agent') || null
    }
  });

  res.status(201).json({
    success: true,
    data: {
      id: event.id,
      recordedAt: event.createdAt
    }
  });
}));

// Get system-wide daily active users derived from recorded events
router.get('/events/active-users', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { error, value } = activeUserQuerySchema.validate(req.query);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const days = value.days;
  const end = value.endDate ? endOfDay(new Date(value.endDate)) : endOfDay(new Date());
  const start = startOfDay(subDays(new Date(end), days - 1));

  const events = await prisma.analyticsEvent.findMany({
    where: {
      userId: { not: null },
      eventTimestamp: {
        gte: start,
        lte: end
      }
    },
    select: {
      userId: true,
      eventTimestamp: true
    }
  });

  const totalUniqueUsers = new Set(events.map((event) => event.userId as string)).size;
  const dailyMap = new Map<string, Set<string>>();

  events.forEach(({ userId, eventTimestamp }) => {
    if (!userId) {
      return;
    }
    const dayKey = eventTimestamp.toISOString().split('T')[0];
    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, new Set());
    }
    dailyMap.get(dayKey)!.add(userId);
  });

  const breakdown: Array<{ date: string; activeUsers: number }> = [];
  for (let i = 0; i < days; i += 1) {
    const bucket = new Date(start);
    bucket.setDate(start.getDate() + i);
    const key = bucket.toISOString().split('T')[0];
    breakdown.push({
      date: key,
      activeUsers: dailyMap.get(key)?.size || 0
    });
  }

  const latestDay = breakdown[breakdown.length - 1];
  const averageDailyActiveUsers =
    breakdown.reduce((sum, entry) => sum + entry.activeUsers, 0) / (breakdown.length || 1);

  res.json({
    success: true,
    data: {
      summary: {
        range: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          days
        },
        latestDayActiveUsers: latestDay?.activeUsers || 0,
        averageDailyActiveUsers: Number(averageDailyActiveUsers.toFixed(2)),
        totalUniqueUsers
      },
      breakdown
    }
  });
}));

// Get user analytics summary
router.get('/users/:userId', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { userId } = req.params;
  
  // Users can only access their own analytics unless they're admin
  if (userId !== req.user?.userId && req.user?.role !== 'admin' && req.user?.role !== 'moderator') {
    throw createError('Access denied', 403);
  }

  let analytics = await prisma.userAnalytics.findUnique({
    where: { userId }
  });

  // If analytics don't exist, create them
  if (!analytics) {
    analytics = await createUserAnalytics(userId);
  }

  res.json({
    success: true,
    data: analytics
  });
}));

// Get system-wide analytics (admin only)
router.get('/system', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    granularity: Joi.string().valid('hour', 'day', 'week', 'month').default('day')
  });

  const { error, value } = schema.validate(req.query);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { startDate, endDate, granularity } = value;
  const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
  const end = endDate ? new Date(endDate) : new Date();

  // Get system metrics
  const systemMetrics = await prisma.systemMetrics.findMany({
    where: {
      timestamp: {
        gte: start,
        lte: end
      }
    },
    orderBy: { timestamp: 'desc' }
  });

  // Get session statistics
  const sessionStats = await prisma.interactionSession.groupBy({
    by: ['type', 'status'],
    where: {
      startedAt: {
        gte: start,
        lte: end
      }
    },
    _count: true,
    _avg: {
      duration: true
    }
  });

  // Get user activity
  const userActivity = await prisma.userAction.groupBy({
    by: ['actionType'],
    where: {
      timestamp: {
        gte: start,
        lte: end
      }
    },
    _count: true
  });

  // Get geographic distribution
  const geoDistribution = await prisma.interactionSession.groupBy({
    by: ['userCountry1'],
    where: {
      startedAt: {
        gte: start,
        lte: end
      },
      userCountry1: {
        not: null
      }
    },
    _count: true,
    orderBy: {
      _count: {
        userCountry1: 'desc'
      }
    },
    take: 10
  });

  res.json({
    success: true,
    data: {
      dateRange: { start, end },
      systemMetrics,
      sessionStats,
      userActivity,
      geoDistribution,
      summary: {
        totalSessions: sessionStats.reduce((sum: number, stat: any) => sum + stat._count, 0),
        avgSessionDuration: sessionStats.reduce((sum: number, stat: any) => sum + (stat._avg.duration || 0), 0) / sessionStats.length,
        totalActions: userActivity.reduce((sum: number, activity: any) => sum + activity._count, 0)
      }
    }
  });
}));

// Get content moderation analytics (admin only)
router.get('/moderation', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional()
  });

  const { error, value } = schema.validate(req.query);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { startDate, endDate } = value;
  const start = startDate ? new Date(startDate) : subDays(new Date(), 30);
  const end = endDate ? new Date(endDate) : new Date();

  // Moderated messages
  const moderatedMessages = await prisma.chatMessage.groupBy({
    by: ['moderationReason'],
    where: {
      timestamp: {
        gte: start,
        lte: end
      },
      isModerated: true,
      moderationReason: {
        not: null
      }
    },
    _count: true,
    _avg: {
      toxicityScore: true
    }
  });

  // Reports by type
  const reportsByType = await prisma.reportIncident.groupBy({
    by: ['reportType', 'status'],
    where: {
      createdAt: {
        gte: start,
        lte: end
      }
    },
    _count: true
  });

  // Top reported users
  const topReportedUsers = await prisma.reportIncident.groupBy({
    by: ['reportedUserId'],
    where: {
      createdAt: {
        gte: start,
        lte: end
      },
      reportedUserId: {
        not: null
      }
    },
    _count: true,
    orderBy: {
      _count: {
        reportedUserId: 'desc'
      }
    },
    take: 10
  });

  res.json({
    success: true,
    data: {
      dateRange: { start, end },
      moderatedMessages,
      reportsByType,
      topReportedUsers,
      summary: {
        totalModeratedMessages: moderatedMessages.reduce((sum: number, msg: any) => sum + msg._count, 0),
        totalReports: reportsByType.reduce((sum: number, report: any) => sum + report._count, 0),
        avgToxicityScore: moderatedMessages.reduce((sum: number, msg: any) => sum + (msg._avg.toxicityScore || 0), 0) / moderatedMessages.length
      }
    }
  });
}));

// Generate user behavior insights
router.get('/insights/:userId', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { userId } = req.params;
  
  // Users can only access their own insights unless they're admin
  if (userId !== req.user?.userId && req.user?.role !== 'admin' && req.user?.role !== 'moderator') {
    throw createError('Access denied', 403);
  }

  const thirtyDaysAgo = subDays(new Date(), 30);

  // User's session patterns
  const sessionPatterns = await prisma.interactionSession.findMany({
    where: {
      OR: [
        { userId1: userId },
        { userId2: userId }
      ],
      startedAt: {
        gte: thirtyDaysAgo
      }
    },
    select: {
      type: true,
      duration: true,
      startedAt: true,
      status: true,
      textChatUsed: true,
      videoEnabled: true,
      audioEnabled: true
    }
  });

  // Communication preferences
  const messageStats = await prisma.chatMessage.groupBy({
    by: ['messageType'],
    where: {
      senderId: userId,
      timestamp: {
        gte: thirtyDaysAgo
      }
    },
    _count: true,
    _avg: {
      voiceDuration: true
    }
  });

  // Activity patterns by hour of day
  const hourlyActivity = _.groupBy(sessionPatterns, (session: any) => 
    new Date(session.startedAt).getHours()
  );

  const activityByHour = Object.entries(hourlyActivity).map(([hour, sessions]) => ({
    hour: parseInt(hour),
    sessionCount: (sessions as any[]).length,
    avgDuration: (sessions as any[]).reduce((sum: number, s: any) => sum + (s.duration || 0), 0) / (sessions as any[]).length
  }));

  // Insights generation
  const insights = {
    preferredSessionType: _.maxBy(_.toPairs(_.countBy(sessionPatterns, 'type')), 1),
    avgSessionDuration: sessionPatterns.reduce((sum: number, s: any) => sum + (s.duration || 0), 0) / sessionPatterns.length,
    completionRate: sessionPatterns.filter((s: any) => s.status === 'ENDED').length / sessionPatterns.length,
    mostActiveHour: _.maxBy(activityByHour, 'sessionCount')?.hour,
    communicationStyle: {
      prefersVideo: sessionPatterns.filter((s: any) => s.videoEnabled).length / sessionPatterns.length,
      prefersAudio: sessionPatterns.filter((s: any) => s.audioEnabled).length / sessionPatterns.length,
      usesTextChat: sessionPatterns.filter((s: any) => s.textChatUsed).length / sessionPatterns.length
    },
    messagePreferences: messageStats
  };

  res.json({
    success: true,
    data: {
      userId,
      period: { start: thirtyDaysAgo, end: new Date() },
      sessionPatterns: sessionPatterns.length,
      insights,
      activityByHour
    }
  });
}));

// Update user analytics (internal endpoint)
router.post('/users/:userId/update', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { userId } = req.params;
  
  // This endpoint is typically called by other services
  const analytics = await updateUserAnalytics(userId);
  
  res.json({
    success: true,
    data: analytics
  });
}));

// Helper function to create user analytics
async function createUserAnalytics(userId: string) {
  const existingSessions = await prisma.interactionSession.findMany({
    where: {
      OR: [
        { userId1: userId },
        { userId2: userId }
      ]
    }
  });

  const analytics = {
    userId,
    totalSessions: existingSessions.length,
    totalDuration: existingSessions.reduce((sum: number, session: any) => sum + (session.duration || 0), 0),
    avgSessionLength: existingSessions.length > 0 
      ? existingSessions.reduce((sum: number, session: any) => sum + (session.duration || 0), 0) / existingSessions.length 
      : 0,
    completedSessions: existingSessions.filter((s: any) => s.status === 'ENDED').length,
    skippedSessions: existingSessions.filter((s: any) => s.status === 'INTERRUPTED').length,
    lastActiveAt: existingSessions.length > 0 
      ? existingSessions.reduce((latest: any, session: any) => 
          session.startedAt > latest ? session.startedAt : latest, existingSessions[0].startedAt)
      : null
  };

  return await prisma.userAnalytics.create({
    data: analytics
  });
}

// Helper function to update user analytics
async function updateUserAnalytics(userId: string) {
  const oneWeekAgo = subDays(new Date(), 7);
  const oneMonthAgo = subDays(new Date(), 30);

  const [totalSessions, weekSessions, monthSessions, recentActivity] = await Promise.all([
    prisma.interactionSession.count({
      where: {
        OR: [
          { userId1: userId },
          { userId2: userId }
        ]
      }
    }),
    prisma.interactionSession.count({
      where: {
        OR: [
          { userId1: userId },
          { userId2: userId }
        ],
        startedAt: { gte: oneWeekAgo }
      }
    }),
    prisma.interactionSession.count({
      where: {
        OR: [
          { userId1: userId },
          { userId2: userId }
        ],
        startedAt: { gte: oneMonthAgo }
      }
    }),
    prisma.interactionSession.findFirst({
      where: {
        OR: [
          { userId1: userId },
          { userId2: userId }
        ]
      },
      orderBy: { startedAt: 'desc' }
    })
  ]);

  const analyticsData = {
    totalSessions,
    sessionsThisWeek: weekSessions,
    sessionsThisMonth: monthSessions,
    lastActiveAt: recentActivity?.startedAt || null
  };

  return await prisma.userAnalytics.upsert({
    where: { userId },
    update: analyticsData,
    create: {
      userId,
      ...analyticsData
    }
  });
}

export default router;

function extractClientIp(req: express.Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.ip || null;
}
