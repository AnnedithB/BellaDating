
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
      // TODO: Fetch user data from user-service API instead of direct DB access
      // User table is in user_db, not admin_db
      const [
        totalReports,
        pendingReports,
        totalModerationActions,
      ] = await Promise.all([
        prisma.userReport.count(),
        prisma.userReport.count({ where: { status: 'PENDING' } }),
        prisma.moderationAction.count(),
      ]);

      const stats = {
        users: {
          total: 0, // TODO: Fetch from user-service API
          active: 0, // TODO: Fetch from user-service API
          suspended: 0, // TODO: Fetch from user-service API
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
      // TODO: Fetch user growth data from user-service API
      // User table is in user_db, not admin_db
      res.json({
        message: 'User growth analytics - TODO: Integrate with user-service API',
        data: []
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
