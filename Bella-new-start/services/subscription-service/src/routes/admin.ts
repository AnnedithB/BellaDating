import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateAdmin, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { StripeService } from '../services/stripe';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Get all users with subscription details
router.get('/users',
  authenticateAdmin,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['ACTIVE', 'TRIALING', 'CANCELED', 'PAST_DUE', 'UNPAID']),
    query('plan').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const planId = req.query.plan as string;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (planId) {
      where.planId = planId;
    }

    const [subscriptions, total] = await Promise.all([
      prisma.userSubscription.findMany({
        where,
        include: {
          plan: {
            select: {
              name: true,
              displayName: true,
              monthlyPrice: true,
              yearlyPrice: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.userSubscription.count({ where })
    ]);

    // Get user details and payment summary for each subscription
    const enrichedSubscriptions = await Promise.all(
      subscriptions.map(async (subscription) => {
        // Get total payments for this subscription
        const paymentSummary = await prisma.payment.aggregate({
          where: {
            subscriptionId: subscription.id,
            status: 'SUCCEEDED'
          },
          _sum: { amount: true },
          _count: true
        });

        // Get latest payment
        const latestPayment = await prisma.payment.findFirst({
          where: { subscriptionId: subscription.id },
          orderBy: { createdAt: 'desc' }
        });

        return {
          id: subscription.id,
          userId: subscription.userId,
          status: subscription.status,
          currentPrice: Number(subscription.currentPrice),
          currency: subscription.currency,
          billingCycle: subscription.billingCycle,
          trialStart: subscription.trialStart,
          trialEnd: subscription.trialEnd,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          canceledAt: subscription.canceledAt,
          createdAt: subscription.createdAt,
          plan: subscription.plan,
          paymentSummary: {
            totalPaid: paymentSummary._sum.amount ? Number(paymentSummary._sum.amount) / 100 : 0,
            paymentCount: paymentSummary._count
          },
          latestPayment: latestPayment ? {
            status: latestPayment.status,
            amount: Number(latestPayment.amount) / 100,
            processedAt: latestPayment.processedAt,
            failureMessage: latestPayment.failureMessage || undefined
          } : null
        };
      })
    );

    res.json({
      status: 'success',
      data: {
        subscriptions: enrichedSubscriptions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

// Get specific user subscription details
router.get('/users/:userId/subscription',
  authenticateAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;

    const subscription = await prisma.userSubscription.findFirst({
      where: { userId },
      include: {
        plan: true
      }
    });

    if (!subscription) {
      throw createError('Subscription not found', 404);
    }

    // Get payment history
    const payments = await prisma.payment.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get invoices
    const invoices = await prisma.invoice.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get payment methods
    const paymentMethods = await prisma.paymentMethodInfo.findMany({
      where: {
        userId,
        isActive: true
      },
      orderBy: { isDefault: 'desc' }
    });

    res.json({
      status: 'success',
      data: {
        subscription: {
          ...subscription,
          currentPrice: Number(subscription.currentPrice),
          plan: {
            ...subscription.plan,
            monthlyPrice: Number(subscription.plan.monthlyPrice),
            yearlyPrice: Number(subscription.plan.yearlyPrice)
          }
        },
        payments: payments.map(payment => ({
          ...payment,
          amount: Number(payment.amount)
        })),
        invoices: invoices.map(invoice => ({
          ...invoice,
          subtotal: Number(invoice.subtotal),
          discountAmount: Number(invoice.discountAmount),
          taxAmount: Number(invoice.taxAmount),
          totalAmount: Number(invoice.totalAmount)
        })),
        paymentMethods: paymentMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          cardBrand: pm.cardBrand,
          cardLast4: pm.cardLast4,
          isDefault: pm.isDefault,
          createdAt: pm.createdAt
        }))
      }
    });
  })
);

// Update user subscription
router.put('/users/:userId/subscription',
  authenticateAdmin,
  [
    body('planId').optional().isString(),
    body('status').optional().isIn(['ACTIVE', 'TRIALING', 'CANCELED', 'PAST_DUE', 'UNPAID']),
    body('cancelAtPeriodEnd').optional().isBoolean(),
    body('notes').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const { userId } = req.params;
    const { planId, status, cancelAtPeriodEnd, notes } = req.body;
    const adminId = req.user!.id;

    const subscription = await prisma.userSubscription.findFirst({
      where: { userId },
      include: { plan: true }
    });

    if (!subscription) {
      throw createError('Subscription not found', 404);
    }

    const updateData: any = {};
    
    // Handle plan change
    if (planId && planId !== subscription.planId) {
      const newPlan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId }
      });

      if (!newPlan) {
        throw createError('Plan not found', 404);
      }

      updateData.planId = planId;
      updateData.currentPrice = subscription.billingCycle === 'MONTHLY' 
        ? newPlan.monthlyPrice 
        : newPlan.yearlyPrice;

      // Update in Stripe if subscription has Stripe ID
      if (subscription.stripeSubscriptionId) {
        try {
          const stripePriceId = subscription.billingCycle === 'MONTHLY'
            ? newPlan.stripePriceIdMonthly
            : newPlan.stripePriceIdYearly;
          await StripeService.updateSubscription(subscription.stripeSubscriptionId, {
            items: [{ price: stripePriceId }]
          });
        } catch (error) {
          logger.error('Error updating Stripe subscription:', error);
          throw createError('Error updating subscription in Stripe', 500);
        }
      }
    }

    // Handle status change
    if (status && status !== subscription.status) {
      updateData.status = status;

      if (status === 'CANCELED') {
        updateData.canceledAt = new Date();
      }
    }

    // Handle cancel at period end
    if (typeof cancelAtPeriodEnd === 'boolean' && subscription.stripeSubscriptionId) {
      try {
        await StripeService.updateSubscription(subscription.stripeSubscriptionId, {
          cancel_at_period_end: cancelAtPeriodEnd
        });
        if (cancelAtPeriodEnd) {
          updateData.cancelAt = subscription.currentPeriodEnd;
        } else {
          updateData.cancelAt = null;
        }
      } catch (error) {
        logger.error('Error updating Stripe subscription:', error);
      }
    }

    // Update subscription
    const updatedSubscription = await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: updateData,
      include: { plan: true }
    });

    // Log admin action
    logger.info(`Admin ${adminId} updated subscription ${subscription.id} for user ${userId}`, {
      changes: updateData,
      notes
    });

    res.json({
      status: 'success',
      data: {
        ...updatedSubscription,
        currentPrice: Number(updatedSubscription.currentPrice),
        plan: {
          ...updatedSubscription.plan,
          monthlyPrice: Number(updatedSubscription.plan.monthlyPrice),
          yearlyPrice: Number(updatedSubscription.plan.yearlyPrice)
        }
      },
      message: 'Subscription updated successfully'
    });
  })
);

// Cancel user subscription
router.post('/users/:userId/subscription/cancel',
  authenticateAdmin,
  [
    body('immediate').optional().isBoolean(),
    body('reason').optional().isString(),
    body('notes').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const { userId } = req.params;
    const { immediate = false, reason, notes } = req.body;
    const adminId = req.user!.id;

    const subscription = await prisma.userSubscription.findFirst({
      where: { userId },
      include: { plan: true }
    });

    if (!subscription) {
      throw createError('Subscription not found', 404);
    }

    if (subscription.status === 'CANCELED') {
      throw createError('Subscription is already canceled', 400);
    }

    try {
      // Cancel in Stripe
      if (subscription.stripeSubscriptionId) {
        if (immediate) {
          await StripeService.cancelSubscription(subscription.stripeSubscriptionId);
        } else {
          await StripeService.updateSubscription(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true
          });
        }
      }

      // Update in database
      const updateData: any = {};

      if (immediate) {
        updateData.status = 'CANCELED';
        updateData.canceledAt = new Date();
        updateData.endedAt = new Date();
      } else {
        updateData.cancelAt = subscription.currentPeriodEnd;
      }

      const updatedSubscription = await prisma.userSubscription.update({
        where: { id: subscription.id },
        data: updateData,
        include: { plan: true }
      });

      // Log admin action
      logger.info(`Admin ${adminId} canceled subscription ${subscription.id} for user ${userId}`, {
        immediate,
        reason,
        notes
      });

      res.json({
        status: 'success',
        data: {
          ...updatedSubscription,
          currentPrice: Number(updatedSubscription.currentPrice)
        },
        message: immediate 
          ? 'Subscription canceled immediately' 
          : 'Subscription will be canceled at the end of the current period'
      });
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw createError('Error canceling subscription', 500);
    }
  })
);

// Reactivate user subscription
router.post('/users/:userId/subscription/reactivate',
  authenticateAdmin,
  [
    body('planId').optional().isString(),
    body('notes').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const { userId } = req.params;
    const { planId, notes } = req.body;
    const adminId = req.user!.id;

    const subscription = await prisma.userSubscription.findFirst({
      where: { userId },
      include: { plan: true }
    });

    if (!subscription) {
      throw createError('Subscription not found', 404);
    }

    if (subscription.status === 'ACTIVE') {
      throw createError('Subscription is already active', 400);
    }

    try {
      let newPlanId = subscription.planId;
      
      // Handle plan change during reactivation
      if (planId && planId !== subscription.planId) {
        const newPlan = await prisma.subscriptionPlan.findUnique({
          where: { id: planId }
        });

        if (!newPlan) {
          throw createError('Plan not found', 404);
        }

        newPlanId = planId;
      }

      // Reactivate in Stripe or create new subscription
      let stripeSubscriptionId = subscription.stripeSubscriptionId;
      
      if (subscription.stripeSubscriptionId) {
        // Try to reactivate existing subscription
        try {
          await StripeService.updateSubscription(subscription.stripeSubscriptionId, {
            cancel_at_period_end: false
          });
        } catch (error) {
          // If that fails, we might need to create a new subscription
          logger.warn('Could not reactivate existing Stripe subscription, might need to create new one');
        }
      }

      // Update in database
      const updateData: any = {
        status: 'ACTIVE',
        cancelAt: null,
        canceledAt: null
      };

      if (planId && planId !== subscription.planId) {
        const newPlan = await prisma.subscriptionPlan.findUnique({
          where: { id: planId }
        });
        updateData.planId = planId;
        updateData.currentPrice = subscription.billingCycle === 'MONTHLY'
          ? newPlan!.monthlyPrice
          : newPlan!.yearlyPrice;
      }

      const updatedSubscription = await prisma.userSubscription.update({
        where: { id: subscription.id },
        data: updateData,
        include: { plan: true }
      });

      // Log admin action
      logger.info(`Admin ${adminId} reactivated subscription ${subscription.id} for user ${userId}`, {
        planId,
        notes
      });

      res.json({
        status: 'success',
        data: {
          ...updatedSubscription,
          currentPrice: Number(updatedSubscription.currentPrice),
          plan: {
            ...updatedSubscription.plan,
            monthlyPrice: Number(updatedSubscription.plan.monthlyPrice),
            yearlyPrice: Number(updatedSubscription.plan.yearlyPrice)
          }
        },
        message: 'Subscription reactivated successfully'
      });
    } catch (error) {
      logger.error('Error reactivating subscription:', error);
      throw createError('Error reactivating subscription', 500);
    }
  })
);

// Refund payment
router.post('/payments/:paymentId/refund',
  authenticateAdmin,
  [
    body('amount').optional().isNumeric(),
    body('reason').optional().isString(),
    body('notes').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const { paymentId } = req.params;
    const { amount, reason, notes } = req.body;
    const adminId = req.user!.id;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: true }
    });

    if (!payment) {
      throw createError('Payment not found', 404);
    }

    if (payment.status !== 'SUCCEEDED') {
      throw createError('Can only refund successful payments', 400);
    }

    if (payment.refundedAt) {
      throw createError('Payment already refunded', 400);
    }

    const refundAmount = amount ? Math.round(parseFloat(amount) * 100) : Number(payment.amount);

    if (refundAmount > Number(payment.amount)) {
      throw createError('Refund amount cannot exceed payment amount', 400);
    }

    try {
      // Process refund in Stripe
      if (payment.stripePaymentIntentId) {
        await StripeService.refundPayment(
          payment.stripePaymentIntentId,
          refundAmount
        );
      }

      // Update payment in database
      const updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
          refundAmount: refundAmount
        }
      });

      // Log admin action
      logger.info(`Admin ${adminId} refunded payment ${paymentId}`, {
        amount: refundAmount / 100,
        reason,
        notes
      });

      res.json({
        status: 'success',
        data: {
          ...updatedPayment,
          amount: Number(updatedPayment.amount) / 100,
          refundAmount: updatedPayment.refundAmount ? Number(updatedPayment.refundAmount) / 100 : 0
        },
        message: 'Payment refunded successfully'
      });
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw createError('Error processing refund', 500);
    }
  })
);

// Create promo code
router.post('/promo-codes',
  authenticateAdmin,
  [
    body('code').notEmpty().isString().trim().isLength({ min: 3, max: 50 }),
    body('name').notEmpty().isString().trim(),
    body('description').optional().isString(),
    body('discountType').isIn(['PERCENTAGE', 'FIXED_AMOUNT']),
    body('discountValue').isNumeric(),
    body('maxDiscountAmount').optional().isNumeric(),
    body('maxUses').optional().isInt({ min: 1 }),
    body('validFrom').optional().isISO8601(),
    body('validUntil').optional().isISO8601(),
    body('planIds').optional().isArray()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      maxUses,
      validFrom,
      validUntil,
      planIds
    } = req.body;

    const adminId = req.user!.id;

    // Check if code already exists
    const existingCode = await prisma.promoCode.findUnique({
      where: { code }
    });

    if (existingCode) {
      throw createError('Promo code already exists', 400);
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code,
        name,
        description,
        discountType,
        discountValue: Math.round(parseFloat(discountValue) * 100),
        maxDiscountAmount: maxDiscountAmount 
          ? Math.round(parseFloat(maxDiscountAmount) * 100) 
          : null,
        maxUses,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        applicablePlans: planIds || []
      }
    });

    logger.info(`Admin ${adminId} created promo code: ${code}`);

    res.json({
      status: 'success',
      data: {
        ...promoCode,
        discountValue: Number(promoCode.discountValue) / 100,
        maxDiscountAmount: promoCode.maxDiscountAmount 
          ? Number(promoCode.maxDiscountAmount) / 100 
          : null
      },
      message: 'Promo code created successfully'
    });
  })
);

// List promo codes
router.get('/promo-codes',
  authenticateAdmin,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('active').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const activeOnly = req.query.active === 'true';
    const offset = (page - 1) * limit;

    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
      where.validFrom = { lte: new Date() };
      where.OR = [
        { validUntil: null },
        { validUntil: { gte: new Date() } }
      ];
    }

    const [promoCodes, total] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        include: {
          usages: {
            select: { userId: true, usedAt: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.promoCode.count({ where })
    ]);

    res.json({
      status: 'success',
      data: {
        promoCodes: promoCodes.map(code => ({
          ...code,
          discountValue: Number(code.discountValue) / 100,
          maxDiscountAmount: code.maxDiscountAmount 
            ? Number(code.maxDiscountAmount) / 100 
            : null,
          usageCount: code.usages.length
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

export default router;