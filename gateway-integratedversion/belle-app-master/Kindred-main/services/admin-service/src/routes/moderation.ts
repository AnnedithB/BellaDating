
import express, { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { authenticateAdmin, requirePermission } from '../middleware/auth';
import { body, param, validationResult } from 'express-validator';

const router = express.Router();

const moderationPermissions = {
  read: 'moderation.read',
  write: 'moderation.write',
  assign: 'moderation.assign',
};

// Middleware for moderation routes
const moderationRouteMiddleware = (permission: string) => [
  authenticateAdmin,
  requirePermission(permission),
];

// Get all reports
router.get('/reports',
  ...moderationRouteMiddleware(moderationPermissions.read),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reports = await prisma.userReport.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          assignedAdmin: {
            select: { firstName: true, lastName: true, email: true }
          }
        }
      });

      res.json(reports);
    } catch (error) {
      next(error);
    }
  }
);

// Assign report to admin
router.patch('/reports/:id/assign',
  ...moderationRouteMiddleware(moderationPermissions.assign),
  param('id').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const report = await prisma.userReport.update({
        where: { id: req.params.id },
        data: {
          assignedAdminId: (req as any).admin.id,
          status: 'IN_REVIEW'
        }
      });

      res.json(report);
    } catch (error) {
      next(error);
    }
  }
);

// Get all moderation actions
router.get('/actions',
  ...moderationRouteMiddleware(moderationPermissions.read),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actions = await prisma.moderationAction.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      });

      res.json(actions);
    } catch (error) {
      next(error);
    }
  }
);

// Create moderation action
router.post('/actions',
  ...moderationRouteMiddleware(moderationPermissions.write),
  body('actionType').isIn(['BAN', 'WARN', 'SUSPEND']),
  body('reason').notEmpty(),
  body('userId').isUUID(),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const action = await prisma.moderationAction.create({
        data: {
          ...req.body,
          adminId: (req as any).admin.id,
        },
      });

      res.status(201).json(action);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
