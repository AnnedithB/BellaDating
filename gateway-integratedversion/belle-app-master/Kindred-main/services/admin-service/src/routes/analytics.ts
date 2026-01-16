
import express, { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { authenticateAdmin, requirePermission } from '../middleware/auth';

const router = express.Router();

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
      const [
        totalUsers,
        activeUsers,
        totalReports,
        pendingReports,
        totalModerationActions,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.userReport.count(),
        prisma.userReport.count({ where: { status: 'PENDING' } }),
        prisma.moderationAction.count(),
      ]);

      const stats = {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: totalUsers - activeUsers,
        },
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
      const growth = await prisma.user.groupBy({
        by: ['createdAt'],
        _count: true,
        orderBy: { createdAt: 'asc' },
      });

      res.json(growth);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
