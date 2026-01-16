
import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult, query } from 'express-validator';
import prisma from '../prisma/client';
import { authenticateAdmin, requirePermission } from '../middleware/auth';
import { ModerationActionType } from '@prisma/client';

const router = express.Router();

const userPermissions = {
  read: 'users.read',
  moderate: 'users.moderate',
};

const userStatuses = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'BANNED',
  'PENDING_REVIEW',
] as const;
type UserStatus = (typeof userStatuses)[number];

// Middleware for user routes
const userRouteMiddleware = (permission: string) => [
  authenticateAdmin,
  requirePermission(permission),
];

// Get all users with pagination and filters
router.get('/', 
  ...userRouteMiddleware(userPermissions.read),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString(),
    query('status').optional().isIn(userStatuses),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { page = 1, limit = 20, search, status } = req.query as any;
      const offset = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status) {
        where.status = status;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            lastActiveAt: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get user details
router.get('/:id', 
  ...userRouteMiddleware(userPermissions.read),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: {
          reports: true,
          moderationActions: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  }
);

// Update user status
router.patch('/:id/status',
  ...userRouteMiddleware(userPermissions.moderate),
  [
    body('status').isIn(userStatuses),
    body('reason').optional().isString(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { status, reason } = req.body as { status: UserStatus; reason?: string };

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { status },
      });

      // Log moderation action
      await prisma.moderationAction.create({
        data: {
          adminId: (req as any).admin.id,
          targetType: 'USER',
          targetId: user.id,
          action: status === 'ACTIVE' ? ModerationActionType.APPROVE : ModerationActionType.SUSPEND,
          reason: reason || 'Status updated by admin',
        },
      });

      res.json({ message: 'User status updated', user });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
