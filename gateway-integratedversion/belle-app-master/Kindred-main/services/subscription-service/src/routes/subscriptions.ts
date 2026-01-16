import express, { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { StripeService } from '../services/stripe';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Get user's current subscription
router.get('/current',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            features: true,
            limits: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      return res.json({
        status: 'success',
        data: null,
        message: 'No active subscription found'
      });
    }

    res.json({
      status: 'success',
      data: {
        id: subscription.id,
        planId: subscription.planId,
        plan: subscription.plan,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        currentPrice: Number(subscription.currentPrice),
        currency: subscription.currency,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAt: subscription.cancelAt,
        isTrialActive: subscription.isTrialActive,
        trialEnd: subscription.trialEnd,
        autoRenew: subscription.autoRenew,
        createdAt: subscription.createdAt
      }
    });
  })
);

// Create new subscription
router.post('/create',
  authenticateUser,
  [
    body('planId').notEmpty().isString(),
    body('billingCycle').isIn(['MONTHLY', 'YEARLY']),
    body('paymentMethodId').optional().isString(),
    body('promoCode').optional().isString().trim()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const { planId, billingCycle, paymentMethodId, promoCode } = req.body;

    // Check if user already has an active subscription
    const existingSubscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
      }
    });

    if (existingSubscription) {
      throw createError('User already has an active subscription', 409);
    }

    // Get subscription plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId, isActive: true }
    });

    if (!plan) {
      throw createError('Subscription plan not found or inactive', 404);
    }

    // Get the appropriate Stripe price ID
    const stripePriceId = billingCycle === 'YEARLY' 
      ? plan.stripePriceIdYearly 
      : plan.stripePriceIdMonthly;

    if (!stripePriceId) {
      throw createError('Stripe price not configured for this billing cycle', 500);
    }

    // Create or get Stripe customer
    const customer = await StripeService.createCustomer(userId, userEmail);

    // Validate promo code if provided
    let promotionCode = null;
    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { 
          code: promoCode,
          isActive: true,
          validFrom: { lte: new Date() }
        }
      });

      if (!promo || (promo.validUntil && promo.validUntil < new Date())) {
        throw createError('Invalid or expired promo code', 400);
      }

      if (promo.maxUses && promo.currentUses >= promo.maxUses) {
        throw createError('Promo code usage limit exceeded', 400);
      }

      // Check if user already used this promo code
      const existingUsage = await prisma.promoCodeUsage.findUnique({
        where: {
          promoCodeId_userId: {
            promoCodeId: promo.id,
            userId
          }
        }
      });

      if (existingUsage) {
        throw createError('Promo code already used by this user', 400);
      }

      promotionCode = promo.stripeCouponId;
    }

    // Create Stripe subscription
    const stripeSubscription = await StripeService.createSubscription(
      customer.id,
      stripePriceId,
      {
        trialPeriodDays: process.env.DEFAULT_TRIAL_DAYS ? parseInt(process.env.DEFAULT_TRIAL_DAYS) : 7,
        promotionCode,
        paymentMethodId
      }
    );

    // Calculate pricing
    const price = billingCycle === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;

    // Create subscription in database
    const subscription = await prisma.userSubscription.create({
      data: {
        userId,
        planId,
        status: stripeSubscription.status.toUpperCase() as any,
        billingCycle,
        currentPrice: price,
        currency: 'USD',
        startedAt: new Date(stripeSubscription.created * 1000),
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customer.id,
        isTrialActive: stripeSubscription.status === 'trialing',
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        autoRenew: true
      },
      include: {
        plan: true
      }
    });

    // Record promo code usage if applicable
    if (promoCode && promo) {
      await Promise.all([
        prisma.promoCodeUsage.create({
          data: {
            promoCodeId: promo.id,
            userId,
            subscriptionId: subscription.id,
            discountAmount: 0 // Will be updated when payment is processed
          }
        }),
        prisma.promoCode.update({
          where: { id: promo.id },
          data: { currentUses: { increment: 1 } }
        })
      ]);
    }

    logger.info(`Created subscription: ${subscription.id} for user: ${userId}`);

    res.status(201).json({
      status: 'success',
      data: {
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          plan: subscription.plan,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPrice: Number(subscription.currentPrice),
          isTrialActive: subscription.isTrialActive,
          trialEnd: subscription.trialEnd,
          currentPeriodEnd: subscription.currentPeriodEnd
        },
        clientSecret: (stripeSubscription.latest_invoice as any)?.payment_intent?.client_secret,
        requiresPayment: stripeSubscription.status === 'incomplete'
      },
      message: 'Subscription created successfully'
    });
  })
);

// Upgrade/downgrade subscription
router.put('/change-plan',
  authenticateUser,
  [
    body('newPlanId').notEmpty().isString(),
    body('billingCycle').optional().isIn(['MONTHLY', 'YEARLY']),
    body('prorationBehavior').optional().isIn(['create_prorations', 'none', 'always_invoice'])
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const userId = req.user!.id;
    const { newPlanId, billingCycle, prorationBehavior = 'create_prorations' } = req.body;

    // Get current subscription
    const currentSubscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] }
      },
      include: { plan: true }
    });

    if (!currentSubscription) {
      throw createError('No active subscription found', 404);
    }

    // Get new plan
    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: newPlanId, isActive: true }
    });

    if (!newPlan) {
      throw createError('New subscription plan not found or inactive', 404);
    }

    if (currentSubscription.planId === newPlanId) {
      throw createError('User is already subscribed to this plan', 400);
    }

    // Get new Stripe price ID
    const newBillingCycle = billingCycle || currentSubscription.billingCycle;
    const newStripePriceId = newBillingCycle === 'YEARLY' 
      ? newPlan.stripePriceIdYearly 
      : newPlan.stripePriceIdMonthly;

    if (!newStripePriceId) {
      throw createError('Stripe price not configured for new plan', 500);
    }

    // Update Stripe subscription
    const updatedStripeSubscription = await StripeService.updateSubscription(
      currentSubscription.stripeSubscriptionId!,
      {
        items: [{
          id: (await StripeService.stripe.subscriptions.retrieve(currentSubscription.stripeSubscriptionId!)).items.data[0].id,
          price: newStripePriceId
        }],
        proration_behavior: prorationBehavior as any
      }
    );

    // Calculate new price
    const newPrice = newBillingCycle === 'YEARLY' ? newPlan.yearlyPrice : newPlan.monthlyPrice;

    // Update subscription in database
    const updatedSubscription = await prisma.userSubscription.update({
      where: { id: currentSubscription.id },
      data: {
        planId: newPlanId,
        billingCycle: newBillingCycle,
        currentPrice: newPrice,
        currentPeriodStart: new Date(updatedStripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(updatedStripeSubscription.current_period_end * 1000)
      },
      include: { plan: true }
    });

    logger.info(`Changed subscription plan: ${currentSubscription.id} from ${currentSubscription.plan.name} to ${newPlan.name}`);

    res.json({
      status: 'success',
      data: {
        subscription: {
          id: updatedSubscription.id,
          planId: updatedSubscription.planId,
          plan: updatedSubscription.plan,
          status: updatedSubscription.status,
          billingCycle: updatedSubscription.billingCycle,
          currentPrice: Number(updatedSubscription.currentPrice),
          currentPeriodEnd: updatedSubscription.currentPeriodEnd
        }
      },
      message: 'Subscription plan changed successfully'
    });
  })
);

// Cancel subscription
router.post('/cancel',
  authenticateUser,
  [
    body('immediately').optional().isBoolean(),
    body('reason').optional().isString().trim().isLength({ max: 500 })
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const userId = req.user!.id;
    const { immediately = false, reason } = req.body;

    // Get current subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
      }
    });

    if (!subscription) {
      throw createError('No active subscription found', 404);
    }

    // Cancel Stripe subscription
    const canceledStripeSubscription = await StripeService.cancelSubscription(
      subscription.stripeSubscriptionId!,
      immediately
    );

    // Update subscription in database
    const updateData: any = {
      cancelledReason: reason || 'User requested cancellation'
    };

    if (immediately) {
      updateData.status = 'CANCELED';
      updateData.canceledAt = new Date();
      updateData.endedAt = new Date();
    } else {
      updateData.cancelAt = new Date(canceledStripeSubscription.cancel_at! * 1000);
      updateData.autoRenew = false;
    }

    const updatedSubscription = await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: updateData,
      include: { plan: true }
    });

    logger.info(`Canceled subscription: ${subscription.id} for user: ${userId}`, {
      immediately,
      reason
    });

    res.json({
      status: 'success',
      data: {
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancelAt: updatedSubscription.cancelAt,
          canceledAt: updatedSubscription.canceledAt,
          endedAt: updatedSubscription.endedAt
        }
      },
      message: immediately 
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at the end of the current billing period'
    });
  })
);

// Reactivate canceled subscription
router.post('/reactivate',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // Get canceled subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        cancelAt: { not: null }
      }
    });

    if (!subscription) {
      throw createError('No subscription eligible for reactivation found', 404);
    }

    // Reactivate Stripe subscription
    const reactivatedStripeSubscription = await StripeService.updateSubscription(
      subscription.stripeSubscriptionId!,
      {
        cancel_at_period_end: false
      }
    );

    // Update subscription in database
    const updatedSubscription = await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        cancelAt: null,
        cancellationReason: null,
        autoRenew: true
      },
      include: { plan: true }
    });

    logger.info(`Reactivated subscription: ${subscription.id} for user: ${userId}`);

    res.json({
      status: 'success',
      data: {
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          autoRenew: updatedSubscription.autoRenew,
          currentPeriodEnd: updatedSubscription.currentPeriodEnd
        }
      },
      message: 'Subscription reactivated successfully'
    });
  })
);

// Get subscription history
router.get('/history',
  authenticateUser,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      prisma.userSubscription.findMany({
        where: { userId },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              displayName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.userSubscription.count({
        where: { userId }
      })
    ]);

    res.json({
      status: 'success',
      data: {
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          plan: sub.plan,
          status: sub.status,
          billingCycle: sub.billingCycle,
          currentPrice: Number(sub.currentPrice),
          startedAt: sub.startedAt,
          endedAt: sub.endedAt,
          canceledAt: sub.canceledAt,
          cancellationReason: sub.cancellationReason
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