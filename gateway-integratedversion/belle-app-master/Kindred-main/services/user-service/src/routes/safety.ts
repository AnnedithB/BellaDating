import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import Joi from 'joi';
import axios from 'axios';

const router = express.Router();
const prisma = new PrismaClient();

// Report another user
router.post('/report', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    reportedUserId: Joi.string().required(),
    reportType: Joi.string().valid(
      'inappropriate_behavior', 'harassment', 'spam', 'fake_profile', 
      'underage', 'inappropriate_content', 'violence_threat', 'other'
    ).required(),
    description: Joi.string().required().min(10).max(500),
    evidence: Joi.array().items(Joi.string().uri()).optional(),
    sessionId: Joi.string().optional(),
    messageId: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw createError(error.details?.[0]?.message || 'Validation error', 400);
  }

  const { reportedUserId, reportType, description, evidence, sessionId, messageId } = value;
  const reporterId = req.user!.id;

  // Prevent self-reporting
  if (reporterId === reportedUserId) {
    throw createError('Cannot report yourself', 400);
  }

  // Check if user exists
  const reportedUser = await prisma.user.findUnique({
    where: { id: reportedUserId }
  });

  if (!reportedUser) {
    throw createError('Reported user not found', 404);
  }

  // Check for duplicate reports (same reporter, same reported user, within 24 hours)
  const recentReport = await (prisma as any).userReport.findFirst({
    where: {
      reporterId,
      reportedUserId,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    }
  });

  if (recentReport) {
    throw createError('You have already reported this user recently', 409);
  }

  // Create the report
  const report = await (prisma as any).userReport.create({
    data: {
      reporterId,
      reportedUserId,
      reportType,
      description,
      evidence: evidence || [],
      sessionId,
      messageId,
      status: 'PENDING'
    }
  });

  // Update reporter's safety profile
  await updateUserSafetyProfile(reporterId, { reportsMade: { increment: 1 } });

  // Update reported user's safety profile
  await updateUserSafetyProfile(reportedUserId, { 
    reportsReceived: { increment: 1 },
    recentReports: { increment: 1 }
  });

  // Auto-escalate for serious reports
  const seriousReportTypes = ['underage', 'violence_threat', 'harassment'];
  const shouldEscalate = seriousReportTypes.includes(reportType);

  if (shouldEscalate) {
    await (prisma as any).userReport.update({
      where: { id: report.id },
      data: { 
        priority: 'HIGH',
        status: 'ESCALATED'
      }
    });

    // Send alert to moderation service
    await sendModerationAlert({
      type: 'urgent_user_report',
      reportId: report.id,
      reportType,
      reportedUserId,
      description
    });
  }

  // Check if user should be temporarily restricted
  const userSafety = await (prisma as any).userSafetyProfile.findUnique({
    where: { userId: reportedUserId }
  });

  if (userSafety && userSafety.recentReports >= 3) {
    await applyAutoRestriction(reportedUserId, 'multiple_reports');
  }

  logger.info('User report created', {
    reportId: report.id,
    reporterId,
    reportedUserId,
    reportType,
    escalated: shouldEscalate
  });

  res.status(201).json({
    success: true,
    data: {
      reportId: report.id,
      status: report.status,
      message: 'Report submitted successfully. Thank you for helping keep our community safe.'
    }
  });
}));

// Block/unblock a user
router.post('/block', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    blockedUserId: Joi.string().required(),
    reason: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw createError(error.details?.[0]?.message || 'Validation error', 400);
  }

  const { blockedUserId, reason } = value;
  const blockerId = req.user!.id;

  if (blockerId === blockedUserId) {
    throw createError('Cannot block yourself', 400);
  }

  // Check if already blocked
  const existingBlock = await (prisma as any).userBlock.findUnique({
    where: {
      blockerId_blockedUserId: {
        blockerId,
        blockedUserId
      }
    }
  });

  if (existingBlock) {
    throw createError('User is already blocked', 409);
  }

  // Create block record
  await (prisma as any).userBlock.create({
    data: {
      blockerId,
      blockedUserId,
      reason
    }
  });

  logger.info('User blocked', {
    blockerId,
    blockedUserId,
    reason
  });

  res.json({
    success: true,
    message: 'User blocked successfully'
  });
}));

router.delete('/block/:blockedUserId', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { blockedUserId } = req.params;
  const blockerId = req.user!.id;

  const block = await (prisma as any).userBlock.findUnique({
    where: {
      blockerId_blockedUserId: {
        blockerId,
        blockedUserId
      }
    }
  });

  if (!block) {
    throw createError('User is not blocked', 404);
  }

  await (prisma as any).userBlock.delete({
    where: {
      blockerId_blockedUserId: {
        blockerId,
        blockedUserId
      }
    }
  });

  logger.info('User unblocked', { blockerId, blockedUserId });

  res.json({
    success: true,
    message: 'User unblocked successfully'
  });
}));

// Get user's blocked list
router.get('/blocked', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const userId = req.user!.id;

  const blockedUsers = await (prisma as any).userBlock.findMany({
    where: { blockerId: userId },
    include: {
      blockedUser: {
        select: {
          id: true,
          username: true,
          avatar: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({
    success: true,
    data: blockedUsers.map((block: any) => ({
      id: block.id,
      user: block.blockedUser,
      reason: block.reason,
      blockedAt: block.createdAt
    }))
  });
}));

// Get user's safety status
router.get('/safety-status', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const userId = req.user!.id;

  const safetyProfile = await (prisma as any).userSafetyProfile.findUnique({
    where: { userId }
  });

  if (!safetyProfile) {
    // Create default safety profile
    const newProfile = await (prisma as any).userSafetyProfile.create({
      data: {
        userId,
        trustScore: 100.0,
        status: 'GOOD_STANDING'
      }
    });

    return res.json({
      success: true,
      data: newProfile
    });
  }

  return res.json({
    success: true,
    data: safetyProfile
  });
}));

// Appeal a restriction
router.post('/appeal', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    appealReason: Joi.string().required().min(20).max(1000),
    evidence: Joi.array().items(Joi.string().uri()).optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw createError(error.details?.[0]?.message || 'Validation error', 400);
  }

  const { appealReason, evidence } = value;
  const userId = req.user!.id;

  // Check if user has any active restrictions to appeal
  const safetyProfile = await (prisma as any).userSafetyProfile.findUnique({
    where: { userId }
  });

  if (!safetyProfile || safetyProfile.status === 'GOOD_STANDING') {
    throw createError('No active restrictions to appeal', 400);
  }

  // Check if there's already a pending appeal
  const existingAppeal = await (prisma as any).userAppeal.findFirst({
    where: {
      userId,
      status: 'PENDING'
    }
  });

  if (existingAppeal) {
    throw createError('You already have a pending appeal', 409);
  }

  // Create appeal
  const appeal = await (prisma as any).userAppeal.create({
    data: {
      userId,
      appealReason,
      evidence: evidence || [],
      status: 'PENDING'
    }
  });

  // Notify admin team
  await sendModerationAlert({
    type: 'user_appeal',
    appealId: appeal.id,
    userId,
    description: appealReason
  });

  logger.info('User appeal submitted', {
    appealId: appeal.id,
    userId
  });

  res.status(201).json({
    success: true,
    data: {
      appealId: appeal.id,
      message: 'Appeal submitted successfully. Our team will review it within 24-48 hours.'
    }
  });
}));

// Get user's reports (that they made)
router.get('/my-reports', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const userId = req.user!.id;

  const reports = await (prisma as any).userReport.findMany({
    where: { reporterId: userId },
    select: {
      id: true,
      reportType: true,
      description: true,
      status: true,
      createdAt: true,
      adminResponse: true
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({
    success: true,
    data: reports
  });
}));

// Check if users can interact (not blocked by each other)
router.post('/can-interact', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    otherUserId: Joi.string().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw createError(error.details?.[0]?.message || 'Validation error', 400);
  }

  const { otherUserId } = value;
  const userId = req.user!.id;

  // Check if either user has blocked the other
  const blocks = await (prisma as any).userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedUserId: otherUserId },
        { blockerId: otherUserId, blockedUserId: userId }
      ]
    }
  });

  // Check if either user is restricted
  const [userSafety, otherUserSafety] = await Promise.all([
    (prisma as any).userSafetyProfile.findUnique({ where: { userId } }),
    (prisma as any).userSafetyProfile.findUnique({ where: { userId: otherUserId } })
  ]);

  const canInteract = !blocks && 
    (!userSafety || userSafety.status !== 'BANNED') &&
    (!otherUserSafety || otherUserSafety.status !== 'BANNED');

  res.json({
    success: true,
    data: {
      canInteract,
      reason: !canInteract ? (blocks ? 'blocked' : 'RESTRICTED') : null
    }
  });
}));

// Helper functions
async function updateUserSafetyProfile(userId: string, updates: any) {
  try {
    await (prisma as any).userSafetyProfile.upsert({
      where: { userId },
      update: updates,
      create: {
        userId,
        trustScore: 100.0,
        status: 'GOOD_STANDING',
        ...updates
      }
    });
  } catch (error) {
    logger.error('Failed to update user safety profile:', error);
  }
}

async function applyAutoRestriction(userId: string, reason: string) {
  try {
    await (prisma as any).userSafetyProfile.upsert({
      where: { userId },
      update: {
        status: 'RESTRICTED',
        restrictionReason: reason,
        restrictedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        trustScore: { decrement: 20 }
      },
      create: {
        userId,
        status: 'RESTRICTED',
        restrictionReason: reason,
        restrictedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        trustScore: 80.0
      }
    });

    logger.info('Auto-restriction applied', { userId, reason });
  } catch (error) {
    logger.error('Failed to apply auto-restriction:', error);
  }
}

async function sendModerationAlert(alertData: any) {
  try {
    // Send to moderation service
    await axios.post('http://moderation-service:3007/api/admin/alerts', alertData, {
      timeout: 5000
    });
  } catch (error) {
    logger.error('Failed to send moderation alert:', error);
  }
}

export default router;