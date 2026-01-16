import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateAdmin, requirePermission } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get system settings
router.get('/',
  authenticateAdmin,
  requirePermission('settings.read'),
  async (req: any, res: any, next: any) => {
    try {
      const settings = await prisma.systemSettings.findMany({
        orderBy: { category: 'asc' }
      });

      res.json(settings);
    } catch (error) {
      next(error);
    }
  }
);

// Update system setting
router.put('/:key',
  authenticateAdmin,
  requirePermission('settings.write'),
  async (req: any, res: any, next: any) => {
    try {
      const setting = await prisma.systemSettings.upsert({
        where: { key: req.params.key },
        update: {
          value: req.body.value,
          updatedBy: req.admin.id
        },
        create: {
          key: req.params.key,
          value: req.body.value,
          description: req.body.description,
          category: req.body.category || 'general',
          updatedBy: req.admin.id
        }
      });

      res.json(setting);
    } catch (error) {
      next(error);
    }
  }
);

export default router;