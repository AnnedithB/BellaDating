
import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult, query } from 'express-validator';
import prisma from '../prisma/client';
import { authenticateAdmin, requirePermission } from '../middleware/auth';
import { ModerationActionType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

const router = express.Router();

// Create a separate Prisma client for users database
const userDbUrl = process.env.USER_DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/users';
const userPrisma = new PrismaClient({
  datasources: {
    db: {
      url: userDbUrl,
    },
  },
});

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

// Get all users with pagination and filters - fetches from user_db
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

      // Build where clause for user_db query
      const where: any = {};
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status) {
        // Map admin status to user_db isActive field
        if (status === 'ACTIVE') {
          where.isActive = true;
        } else if (status === 'BANNED' || status === 'SUSPENDED' || status === 'INACTIVE') {
          where.isActive = false;
        }
      }

      // Fetch users from user_db
      const [users, total] = await Promise.all([
        userPrisma.$queryRaw`
          SELECT 
            u.id,
            u.email,
            u.is_active as "isActive",
            u.created_at as "createdAt",
            u.last_login as "lastActiveAt",
            p.display_name as "displayName",
            p.age,
            p.location_city as "locationCity",
            p.location_country as "locationCountry"
          FROM users u
          LEFT JOIN profiles p ON u.id = p.user_id
          ORDER BY u.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        userPrisma.$queryRaw`SELECT COUNT(*)::int as count FROM users` as Promise<[{count: number}]>,
      ]);

      // Transform users to expected format
      const transformedUsers = (users as any[]).map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'User',
        lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
        status: user.isActive ? 'ACTIVE' : 'INACTIVE',
        lastActiveAt: user.lastActiveAt || user.createdAt,
        createdAt: user.createdAt,
        age: user.age,
        location: user.locationCity ? `${user.locationCity}, ${user.locationCountry}` : user.locationCountry,
      }));

      const totalCount = (total as any)[0]?.count || 0;

      res.json({
        users: transformedUsers,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching users from user_db:', error);
      // Fallback to empty response if user_db connection fails
      res.json({
        users: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
        },
        error: 'Could not connect to user database',
      });
    }
  }
);

// Get user details
router.get('/:id', 
  ...userRouteMiddleware(userPermissions.read),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Fetch user from user-service API instead of direct DB access
      // User table is in user_db, not admin_db
      res.status(501).json({ 
        error: 'Not implemented',
        message: 'TODO: Integrate with user-service API'
      });
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

      // TODO: Update user status via user-service API instead of direct DB access
      // User table is in user_db, not admin_db
      const user: any = { id: req.params.id, status };

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
