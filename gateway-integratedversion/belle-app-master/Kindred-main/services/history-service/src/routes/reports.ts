import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { requireAdmin } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// Create safety report
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    reportedUserId: Joi.string().optional(),
    sessionId: Joi.string().optional(),
    reportType: Joi.string().valid(
      'INAPPROPRIATE_CONTENT', 'HARASSMENT', 'SPAM', 'NUDITY', 'VIOLENCE',
      'HATE_SPEECH', 'UNDERAGE_USER', 'FAKE_PROFILE', 'TECHNICAL_ISSUE', 'OTHER'
    ).required(),
    reason: Joi.string().required(),
    description: Joi.string().optional(),
    severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').default('MEDIUM'),
    evidenceUrls: Joi.array().items(Joi.string().uri()).optional(),
    chatSnapshot: Joi.object().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const reportData = {
    ...value,
    reporterId: req.user!.userId
  };

  // Validate session exists if provided
  if (value.sessionId) {
    const session = await prisma.interactionSession.findUnique({
      where: { sessionId: value.sessionId }
    });
    
    if (!session) {
      throw createError('Session not found', 404);
    }

    // Verify reporter was part of the session
    if (session.userId1 !== req.user!.userId && session.userId2 !== req.user!.userId) {
      throw createError('You can only report sessions you participated in', 403);
    }
  }

  // Auto-escalate certain report types
  const highPriorityTypes = ['NUDITY', 'VIOLENCE', 'HATE_SPEECH', 'UNDERAGE_USER'];
  if (highPriorityTypes.includes(value.reportType)) {
    reportData.severity = 'HIGH';
  }

  const report = await prisma.reportIncident.create({
    data: reportData
  });

  // Log user action
  await prisma.userAction.create({
    data: {
      userId: req.user!.userId,
      sessionId: value.sessionId,
      actionType: 'REPORT_USER',
      metadata: {
        reportId: report.id,
        reportType: value.reportType,
        reportedUserId: value.reportedUserId
      }
    }
  });

  logger.info('Safety report created', {
    reportId: report.id,
    reporterId: req.user!.userId,
    reportType: value.reportType,
    severity: report.severity
  });

  res.status(201).json({
    success: true,
    data: {
      reportId: report.id,
      status: report.status,
      message: 'Report submitted successfully. Our team will review it promptly.'
    }
  });
}));

// Get user's reports
router.get('/my-reports', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    status: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED').optional(),
    limit: Joi.number().min(1).max(50).default(20),
    offset: Joi.number().min(0).default(0)
  });

  const { error, value } = schema.validate(req.query);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { status, limit, offset } = value;
  const whereClause: any = { reporterId: req.user!.userId };
  
  if (status) whereClause.status = status;

  const [reports, total] = await Promise.all([
    prisma.reportIncident.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        reportType: true,
        reason: true,
        status: true,
        severity: true,
        createdAt: true,
        reviewedAt: true,
        resolution: true
      }
    }),
    prisma.reportIncident.count({ where: whereClause })
  ]);

  res.json({
    success: true,
    data: {
      reports,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }
  });
}));

// Get all reports (admin only)
router.get('/all', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    status: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED').optional(),
    reportType: Joi.string().valid(
      'INAPPROPRIATE_CONTENT', 'HARASSMENT', 'SPAM', 'NUDITY', 'VIOLENCE',
      'HATE_SPEECH', 'UNDERAGE_USER', 'FAKE_PROFILE', 'TECHNICAL_ISSUE', 'OTHER'
    ).optional(),
    severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    limit: Joi.number().min(1).max(100).default(50),
    offset: Joi.number().min(0).default(0)
  });

  const { error, value } = schema.validate(req.query);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { status, reportType, severity, startDate, endDate, limit, offset } = value;
  const whereClause: any = {};

  if (status) whereClause.status = status;
  if (reportType) whereClause.reportType = reportType;
  if (severity) whereClause.severity = severity;

  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt.gte = startOfDay(new Date(startDate));
    if (endDate) whereClause.createdAt.lte = endOfDay(new Date(endDate));
  }

  const [reports, total] = await Promise.all([
    prisma.reportIncident.findMany({
      where: whereClause,
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset,
      include: {
        session: {
          select: {
            sessionId: true,
            type: true,
            startedAt: true,
            endedAt: true
          }
        }
      }
    }),
    prisma.reportIncident.count({ where: whereClause })
  ]);

  res.json({
    success: true,
    data: {
      reports,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }
  });
}));

// Update report status (admin only)
router.patch('/:reportId', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { reportId } = req.params;
  
  const schema = Joi.object({
    status: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED').required(),
    resolution: Joi.string().optional(),
    actionTaken: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const updateData: any = {
    ...value,
    reviewedBy: req.user!.userId,
    reviewedAt: new Date()
  };

  const report = await prisma.reportIncident.update({
    where: { id: reportId },
    data: updateData,
    include: {
      session: {
        select: {
          sessionId: true,
          userId1: true,
          userId2: true
        }
      }
    }
  });

  // If resolved with action, potentially update user analytics
  if (value.status === 'RESOLVED' && value.actionTaken && report.reportedUserId) {
    await updateUserSafetyRecord(report.reportedUserId, report.reportType, value.actionTaken);
  }

  logger.info('Report reviewed', {
    reportId,
    reviewerId: req.user!.userId,
    status: value.status,
    actionTaken: value.actionTaken
  });

  res.json({
    success: true,
    data: report
  });
}));

// Get report details (admin only)
router.get('/:reportId', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { reportId } = req.params;

  const report = await prisma.reportIncident.findUnique({
    where: { id: reportId },
    include: {
      session: {
        include: {
          messages: {
            where: {
              timestamp: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours of messages
              }
            },
            orderBy: { timestamp: 'asc' }
          }
        }
      }
    }
  });

  if (!report) {
    throw createError('Report not found', 404);
  }

  res.json({
    success: true,
    data: report
  });
}));

// Get safety statistics (admin only)
router.get('/stats/overview', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
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

  const [
    reportsByType,
    reportsByStatus,
    reportsBySeverity,
    recentTrends,
    topReportedUsers
  ] = await Promise.all([
    // Reports by type
    prisma.reportIncident.groupBy({
      by: ['reportType'],
      where: {
        createdAt: { gte: start, lte: end }
      },
      _count: true
    }),
    
    // Reports by status
    prisma.reportIncident.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: start, lte: end }
      },
      _count: true
    }),
    
    // Reports by severity
    prisma.reportIncident.groupBy({
      by: ['severity'],
      where: {
        createdAt: { gte: start, lte: end }
      },
      _count: true
    }),
    
    // Daily report trends
    prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM report_incidents
      WHERE created_at >= ${start} AND created_at <= ${end}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `,
    
    // Top reported users
    prisma.reportIncident.groupBy({
      by: ['reportedUserId'],
      where: {
        createdAt: { gte: start, lte: end },
        reportedUserId: { not: null }
      },
      _count: true,
      orderBy: {
        _count: {
          reportedUserId: 'desc'
        }
      },
      take: 10
    })
  ]);

  const totalReports = reportsByType.reduce((sum: number, item: any) => sum + item._count, 0);
  const resolvedReports = reportsByStatus.find((item: any) => item.status === 'RESOLVED')?._count || 0;
  const resolutionRate = totalReports > 0 ? (resolvedReports / totalReports) * 100 : 0;

  res.json({
    success: true,
    data: {
      dateRange: { start, end },
      overview: {
        totalReports,
        resolvedReports,
        resolutionRate: Math.round(resolutionRate * 100) / 100,
        pendingReports: reportsByStatus.find((item: any) => item.status === 'PENDING')?._count || 0
      },
      breakdown: {
        byType: reportsByType,
        byStatus: reportsByStatus,
        bySeverity: reportsBySeverity
      },
      trends: recentTrends,
      topReportedUsers
    }
  });
}));

// Helper function to update user safety record
async function updateUserSafetyRecord(userId: string, reportType: string, actionTaken: string) {
  try {
    const analytics = await prisma.userAnalytics.findUnique({
      where: { userId }
    });

    if (analytics) {
      const increaseReports = analytics.reportsReceived + 1;
      
      // Determine if user should be banned based on reports
      const shouldBan = increaseReports >= 5 && ['HARASSMENT', 'HATE_SPEECH', 'NUDITY'].includes(reportType);
      
      await prisma.userAnalytics.update({
        where: { userId },
        data: {
          reportsReceived: increaseReports,
          ...(shouldBan && {
            isBanned: true,
            banReason: `Multiple reports for ${reportType.toLowerCase()}`,
            banExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          })
        }
      });
    }
  } catch (error) {
    logger.error('Failed to update user safety record', { userId, error });
  }
}

export default router;