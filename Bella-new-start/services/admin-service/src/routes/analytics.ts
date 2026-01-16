
import express, { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { authenticateAdmin, requirePermission } from '../middleware/auth';
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

const analyticsPermissions = {
  read: 'analytics.read',
};

// Middleware for analytics routes
const analyticsRouteMiddleware = (permission: string) => [
  authenticateAdmin,
  requirePermission(permission),
];

// Get admin dashboard analytics
router.get('/dashboard',
  ...analyticsRouteMiddleware(analyticsPermissions.read),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Fetch report stats from admin_db
      const [
        totalReports,
        pendingReports,
        totalModerationActions,
      ] = await Promise.all([
        prisma.userReport.count(),
        prisma.userReport.count({ where: { status: 'PENDING' } }),
        prisma.moderationAction.count(),
      ]);

      // Fetch user stats from user_db
      let userStats = { total: 0, active: 0, suspended: 0 };
      try {
        const userCounts = await userPrisma.$queryRaw`
          SELECT 
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE is_active = true)::int as active,
            COUNT(*) FILTER (WHERE is_active = false)::int as suspended
          FROM users
        ` as any[];
        
        if (userCounts && userCounts[0]) {
          userStats = {
            total: userCounts[0].total || 0,
            active: userCounts[0].active || 0,
            suspended: userCounts[0].suspended || 0,
          };
        }
      } catch (userDbError) {
        console.error('Could not fetch user stats from user_db:', userDbError);
        // Continue with zero values if user_db is unavailable
      }

      const stats = {
        users: userStats,
        reports: {
          total: totalReports,
          pending: pendingReports,
          resolved: totalReports - pendingReports,
        },
        moderation: {
          totalActions: totalModerationActions,
        },
      };

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// Get user growth analytics
router.get('/users/growth',
  ...analyticsRouteMiddleware(analyticsPermissions.read),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Fetch from user-service API
      res.json({ message: 'User growth data - integrate with user-service API' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
