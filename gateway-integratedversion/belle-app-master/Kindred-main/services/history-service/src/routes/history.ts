import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { startOfDay, endOfDay, subDays, parse } from 'date-fns';
import Joi from 'joi';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const sessionQuerySchema = Joi.object({
  userId: Joi.string().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  type: Joi.string().valid('VIDEO_CALL', 'VOICE_CALL', 'TEXT_CHAT', 'RANDOM_MATCH', 'INTEREST_MATCH').optional(),
  status: Joi.string().valid('WAITING', 'CONNECTED', 'ENDED', 'INTERRUPTED', 'REPORTED').optional(),
  limit: Joi.number().min(1).max(100).default(20),
  offset: Joi.number().min(0).default(0)
});

const messageQuerySchema = Joi.object({
  sessionId: Joi.string().required(),
  limit: Joi.number().min(1).max(100).default(50),
  offset: Joi.number().min(0).default(0),
  messageType: Joi.string().valid('TEXT', 'VOICE', 'IMAGE', 'EMOJI', 'SYSTEM').optional()
});

// Log interaction session
router.post('/sessions', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    sessionId: Joi.string().required(),
    type: Joi.string().valid('VIDEO_CALL', 'VOICE_CALL', 'TEXT_CHAT', 'RANDOM_MATCH', 'INTEREST_MATCH').required(),
    userId1: Joi.string().required(),
    userId2: Joi.string().optional(),
    status: Joi.string().valid('WAITING', 'CONNECTED', 'ENDED', 'INTERRUPTED', 'REPORTED').default('WAITING'),
    videoEnabled: Joi.boolean().default(true),
    audioEnabled: Joi.boolean().default(true),
    userCountry1: Joi.string().optional(),
    userCountry2: Joi.string().optional(),
    timezone1: Joi.string().optional(),
    timezone2: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  try {
    const session = await prisma.interactionSession.create({
      data: value
    });

    logger.info('Session logged', {
      sessionId: session.sessionId,
      type: session.type,
      userId: req.user?.userId
    });

    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw createError('Session already exists', 409);
    }
    throw error;
  }
}));

// Update session status/metrics
router.patch('/sessions/:sessionId', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { sessionId } = req.params;
  
  const schema = Joi.object({
    status: Joi.string().valid('WAITING', 'CONNECTED', 'ENDED', 'INTERRUPTED', 'REPORTED').optional(),
    endedAt: Joi.date().optional(),
    duration: Joi.number().min(0).optional(),
    avgLatency: Joi.number().min(0).optional(),
    connectionIssues: Joi.boolean().optional(),
    bandwidthUsage: Joi.number().min(0).optional(),
    textChatUsed: Joi.boolean().optional(),
    screenShareUsed: Joi.boolean().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const session = await prisma.interactionSession.update({
    where: { sessionId },
    data: value
  });

  logger.info('Session updated', {
    sessionId,
    updates: Object.keys(value),
    userId: req.user?.userId
  });

  res.json({
    success: true,
    data: session
  });
}));

// Get user session history
router.get('/sessions', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { error, value } = sessionQuerySchema.validate(req.query);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { userId, startDate, endDate, type, status, limit, offset } = value;
  const targetUserId = userId || req.user?.userId;

  const whereClause: any = {
    OR: [
      { userId1: targetUserId },
      { userId2: targetUserId }
    ]
  };

  if (startDate || endDate) {
    whereClause.startedAt = {};
    if (startDate) whereClause.startedAt.gte = startOfDay(new Date(startDate));
    if (endDate) whereClause.startedAt.lte = endOfDay(new Date(endDate));
  }

  if (type) whereClause.type = type;
  if (status) whereClause.status = status;

  const [sessions, total] = await Promise.all([
    prisma.interactionSession.findMany({
      where: whereClause,
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: {
            messages: true,
            actions: true
          }
        }
      }
    }),
    prisma.interactionSession.count({ where: whereClause })
  ]);

  res.json({
    success: true,
    data: {
      sessions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }
  });
}));

// Log chat message
router.post('/messages', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    sessionId: Joi.string().required(),
    senderId: Joi.string().required(),
    recipientId: Joi.string().optional(),
    content: Joi.string().required(),
    messageType: Joi.string().valid('TEXT', 'VOICE', 'IMAGE', 'EMOJI', 'SYSTEM').default('TEXT'),
    voiceUrl: Joi.string().optional(),
    voiceDuration: Joi.number().min(0).optional(),
    toxicityScore: Joi.number().min(0).max(1).optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  // Check if session exists
  const session = await prisma.interactionSession.findUnique({
    where: { sessionId: value.sessionId }
  });

  if (!session) {
    throw createError('Session not found', 404);
  }

  const message = await prisma.chatMessage.create({
    data: value
  });

  // Update session to mark text chat as used
  if (value.messageType === 'TEXT') {
    await prisma.interactionSession.update({
      where: { sessionId: value.sessionId },
      data: { textChatUsed: true }
    });
  }

  logger.info('Message logged', {
    sessionId: value.sessionId,
    messageType: value.messageType,
    senderId: value.senderId
  });

  res.status(201).json({
    success: true,
    data: message
  });
}));

// Get session messages
router.get('/messages/:sessionId', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { sessionId } = req.params;
  const { error, value } = messageQuerySchema.validate(req.query);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { limit, offset, messageType } = value;

  // Verify user has access to this session
  const session = await prisma.interactionSession.findUnique({
    where: { sessionId }
  });

  if (!session) {
    throw createError('Session not found', 404);
  }

  const userId = req.user?.userId;
  if (session.userId1 !== userId && session.userId2 !== userId) {
    throw createError('Access denied to this session', 403);
  }

  const whereClause: any = { sessionId };
  if (messageType) whereClause.messageType = messageType;

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: whereClause,
      orderBy: { timestamp: 'asc' },
      take: limit,
      skip: offset
    }),
    prisma.chatMessage.count({ where: whereClause })
  ]);

  res.json({
    success: true,
    data: {
      messages,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }
  });
}));

// Log user action
router.post('/actions', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const schema = Joi.object({
    userId: Joi.string().required(),
    sessionId: Joi.string().optional(),
    actionType: Joi.string().valid(
      'LOGIN', 'LOGOUT', 'START_SESSION', 'END_SESSION', 'SKIP_USER', 'REPORT_USER',
      'RATE_SESSION', 'UPDATE_PROFILE', 'CHANGE_SETTINGS', 'PURCHASE_PREMIUM',
      'USE_FILTER', 'SEND_MESSAGE', 'MAKE_CALL', 'SCREEN_SHARE'
    ).required(),
    metadata: Joi.object().optional(),
    userAgent: Joi.string().optional(),
    ipAddress: Joi.string().optional(),
    country: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const action = await prisma.userAction.create({
    data: value
  });

  logger.info('User action logged', {
    userId: value.userId,
    actionType: value.actionType,
    sessionId: value.sessionId
  });

  res.status(201).json({
    success: true,
    data: action
  });
}));

// Get user actions
router.get('/actions/:userId', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { userId } = req.params;
  
  const schema = Joi.object({
    actionType: Joi.string().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    limit: Joi.number().min(1).max(100).default(50),
    offset: Joi.number().min(0).default(0)
  });

  const { error, value } = schema.validate(req.query);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { actionType, startDate, endDate, limit, offset } = value;

  // Users can only access their own actions unless they're admin
  if (userId !== req.user?.userId && req.user?.role !== 'admin' && req.user?.role !== 'moderator') {
    throw createError('Access denied', 403);
  }

  const whereClause: any = { userId };

  if (actionType) whereClause.actionType = actionType;

  if (startDate || endDate) {
    whereClause.timestamp = {};
    if (startDate) whereClause.timestamp.gte = startOfDay(new Date(startDate));
    if (endDate) whereClause.timestamp.lte = endOfDay(new Date(endDate));
  }

  const [actions, total] = await Promise.all([
    prisma.userAction.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.userAction.count({ where: whereClause })
  ]);

  res.json({
    success: true,
    data: {
      actions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }
  });
}));

export default router;