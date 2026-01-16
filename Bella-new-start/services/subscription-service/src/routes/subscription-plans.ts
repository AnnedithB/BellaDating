import express, { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { StripeService, stripe } from '../services/stripe';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Get all active subscription plans (public)
router.get('/',
  asyncHandler(async (req: Request, res: Response) => {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        monthlyPrice: true,
        yearlyPrice: true,
        yearlyDiscount: true,
        features: true,
        limits: true,
        sortOrder: true
      }
    });

    // Calculate savings for yearly plans
    const plansWithSavings = plans.map(plan => ({
      ...plan,
      monthlyPrice: Number(plan.monthlyPrice),
      yearlyPrice: Number(plan.yearlyPrice),
      yearlySavings: Number(plan.monthlyPrice) * 12 - Number(plan.yearlyPrice)
    }));

    res.json({
      status: 'success',
      data: plansWithSavings
    });
  })
);

// Get single subscription plan
router.get('/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscriptions: true }
        }
      }
    });

    if (!plan) {
      throw createError('Subscription plan not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        ...plan,
        monthlyPrice: Number(plan.monthlyPrice),
        yearlyPrice: Number(plan.yearlyPrice),
        yearlySavings: Number(plan.monthlyPrice) * 12 - Number(plan.yearlyPrice),
        subscriberCount: plan._count.subscriptions
      }
    });
  })
);

// Create new subscription plan (admin only)
router.post('/',
  authenticateUser,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  [
    body('name').notEmpty().trim().isLength({ min: 2, max: 50 }),
    body('displayName').notEmpty().trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('monthlyPrice').isDecimal({ decimal_digits: '0,2' }).toFloat(),
    body('yearlyPrice').isDecimal({ decimal_digits: '0,2' }).toFloat(),
    body('yearlyDiscount').optional().isInt({ min: 0, max: 100 }).toInt(),
    body('features').isArray(),
    body('limits').optional().isObject(),
    body('sortOrder').optional().isInt({ min: 0 }).toInt(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const {
      name,
      displayName,
      description,
      monthlyPrice,
      yearlyPrice,
      yearlyDiscount = 0,
      features,
      limits = {},
      sortOrder = 0
    } = req.body;

    // Check if plan name already exists
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { name }
    });

    if (existingPlan) {
      throw createError('Plan with this name already exists', 409);
    }

    // Create Stripe prices
    const stripePriceMonthly = await stripe.prices.create({
      unit_amount: Math.round(monthlyPrice * 100), // Convert to cents
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: {
        name: `${displayName} - Monthly`
      }
    });

    const stripePriceYearly = await stripe.prices.create({
      unit_amount: Math.round(yearlyPrice * 100), // Convert to cents
      currency: 'usd',
      recurring: { interval: 'year' },
      product_data: {
        name: `${displayName} - Yearly`
      }
    });

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        displayName,
        description,
        monthlyPrice,
        yearlyPrice,
        yearlyDiscount,
        features,
        limits,
        sortOrder,
        stripePriceIdMonthly: stripePriceMonthly.id,
        stripePriceIdYearly: stripePriceYearly.id
      }
    });

    logger.info(`Created subscription plan: ${plan.id}`, { plan: plan.name });

    res.status(201).json({
      status: 'success',
      data: {
        ...plan,
        monthlyPrice: Number(plan.monthlyPrice),
        yearlyPrice: Number(plan.yearlyPrice)
      },
      message: 'Subscription plan created successfully'
    });
  })
);

// Update subscription plan (admin only)
router.put('/:id',
  authenticateUser,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  [
    body('displayName').optional().trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('monthlyPrice').optional().isDecimal({ decimal_digits: '0,2' }).toFloat(),
    body('yearlyPrice').optional().isDecimal({ decimal_digits: '0,2' }).toFloat(),
    body('yearlyDiscount').optional().isInt({ min: 0, max: 100 }).toInt(),
    body('features').optional().isArray(),
    body('limits').optional().isObject(),
    body('sortOrder').optional().isInt({ min: 0 }).toInt(),
    body('isActive').optional().isBoolean(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const { id } = req.params;
    const updates = req.body;

    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { id }
    });

    if (!existingPlan) {
      throw createError('Subscription plan not found', 404);
    }

    // Update Stripe prices if pricing changed
    if (updates.monthlyPrice && updates.monthlyPrice !== Number(existingPlan.monthlyPrice)) {
      const stripePriceMonthly = await stripe.prices.create({
        unit_amount: Math.round(updates.monthlyPrice * 100),
        currency: 'usd',
        recurring: { interval: 'month' },
        product_data: {
          name: `${updates.displayName || existingPlan.displayName} - Monthly`
        }
      });
      updates.stripePriceIdMonthly = stripePriceMonthly.id;
    }

    if (updates.yearlyPrice && updates.yearlyPrice !== Number(existingPlan.yearlyPrice)) {
      const stripePriceYearly = await stripe.prices.create({
        unit_amount: Math.round(updates.yearlyPrice * 100),
        currency: 'usd',
        recurring: { interval: 'year' },
        product_data: {
          name: `${updates.displayName || existingPlan.displayName} - Yearly`
        }
      });
      updates.stripePriceIdYearly = stripePriceYearly.id;
    }

    const updatedPlan = await prisma.subscriptionPlan.update({
      where: { id },
      data: updates
    });

    logger.info(`Updated subscription plan: ${id}`, { updates });

    res.json({
      status: 'success',
      data: {
        ...updatedPlan,
        monthlyPrice: Number(updatedPlan.monthlyPrice),
        yearlyPrice: Number(updatedPlan.yearlyPrice)
      },
      message: 'Subscription plan updated successfully'
    });
  })
);

// Delete subscription plan (admin only)
router.delete('/:id',
  authenticateUser,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscriptions: true }
        }
      }
    });

    if (!plan) {
      throw createError('Subscription plan not found', 404);
    }

    // Check if plan has active subscriptions
    if (plan._count.subscriptions > 0) {
      throw createError('Cannot delete plan with active subscriptions. Deactivate it instead.', 400);
    }

    await prisma.subscriptionPlan.delete({
      where: { id }
    });

    logger.info(`Deleted subscription plan: ${id}`);

    res.json({
      status: 'success',
      message: 'Subscription plan deleted successfully'
    });
  })
);

// Get plan analytics (admin only)
router.get('/:id/analytics',
  authenticateUser,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { period = '30d' } = req.query;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id }
    });

    if (!plan) {
      throw createError('Subscription plan not found', 404);
    }

    const days = period === '90d' ? 90 : period === '365d' ? 365 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalSubscriptions,
      activeSubscriptions,
      analytics,
      recentSubscriptions
    ] = await Promise.all([
      prisma.userSubscription.count({
        where: { planId: id }
      }),
      prisma.userSubscription.count({
        where: { 
          planId: id,
          status: 'ACTIVE'
        }
      }),
      prisma.subscriptionAnalytics.findMany({
        where: {
          planId: id,
          date: { gte: startDate }
        },
        orderBy: { date: 'asc' }
      }),
      prisma.userSubscription.findMany({
        where: { 
          planId: id,
          createdAt: { gte: startDate }
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          status: true,
          createdAt: true,
          currentPrice: true
        }
      })
    ]);

    const totalRevenue = analytics.reduce((sum, day) => sum + Number(day.totalRevenue), 0);
    const avgChurnRate = analytics.length > 0 
      ? analytics.reduce((sum, day) => sum + Number(day.churnRate), 0) / analytics.length 
      : 0;

    res.json({
      status: 'success',
      data: {
        plan: {
          id: plan.id,
          name: plan.name,
          displayName: plan.displayName
        },
        metrics: {
          totalSubscriptions,
          activeSubscriptions,
          totalRevenue,
          avgChurnRate,
          conversionRate: analytics.length > 0 
            ? analytics[analytics.length - 1].trialConversionRate 
            : 0
        },
        trends: analytics.map(day => ({
          date: day.date,
          newSubscriptions: day.newSubscriptions,
          canceledSubscriptions: day.canceledSubscriptions,
          activeSubscriptions: day.activeSubscriptions,
          revenue: Number(day.totalRevenue),
          churnRate: Number(day.churnRate)
        })),
        recentSubscriptions
      }
    });
  })
);

export default router;