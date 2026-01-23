// Apple In-App Purchase routes
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Verify and process Apple IAP receipt
router.post('/verify',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { receiptData, productId } = req.body;

    // TODO: Implement Apple receipt verification
    // For now, this is a stub implementation
    
    logger.info('Apple IAP verification requested', { userId, productId });

    // Find or create subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
      },
      include: {
        plan: true  // Include plan relation to fix TypeScript error
      }
    });

    if (subscription && subscription.plan) {
      res.json({
        status: 'success',
        data: {
          subscription: {
            id: subscription.id,
            planId: subscription.planId,
            plan: subscription.plan,  // Now accessible because we included it
            status: subscription.status
          }
        }
      });
    } else {
      res.json({
        status: 'success',
        data: { subscription: null }
      });
    }
  })
);

// Get Apple subscription status
router.get('/subscription-status',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // Find user's active subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
      },
      include: {
        plan: true  // Include plan relation
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      return res.json({
        status: 'success',
        data: {
          hasActiveSubscription: false,
          subscription: null
        }
      });
    }

    res.json({
      status: 'success',
      data: {
        hasActiveSubscription: true,
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          plan: subscription.plan,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          appleOriginalTransactionId: subscription.appleOriginalTransactionId
        }
      }
    });
  })
);

// Handle Apple subscription status updates
router.post('/status',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { originalTransactionId, status } = req.body;

    // Find subscription by Apple transaction ID
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        appleOriginalTransactionId: originalTransactionId
      },
      include: {
        plan: true  // Include plan relation
      }
    });

    if (!subscription) {
      return res.status(404).json({
        status: 'error',
        message: 'Subscription not found'
      });
    }

    // Update subscription status if needed
    if (status && subscription.status !== status) {
      await prisma.userSubscription.update({
        where: { id: subscription.id },
        data: { status: status as any }
      });
    }

    res.json({
      status: 'success',
      data: {
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          plan: subscription.plan,  // Accessible because we included it
          status: subscription.status
        }
      }
    });
  })
);

// Get products with Apple product IDs
router.get('/products',
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
        appleProductIdMonthly: true,
        appleProductIdYearly: true,
        stripePriceIdMonthly: true,
        stripePriceIdYearly: true,
      }
    });

    // Format products for frontend
    const products = plans.flatMap(plan => {
      const result = [];
      
      if (plan.appleProductIdMonthly) {
        result.push({
          id: plan.id,
          planId: plan.id,
          appleProductId: plan.appleProductIdMonthly,
          name: plan.displayName,
          billingCycle: 'MONTHLY',
          price: Number(plan.monthlyPrice),
          stripePriceId: plan.stripePriceIdMonthly,
        });
      }
      
      if (plan.appleProductIdYearly) {
        result.push({
          id: plan.id,
          planId: plan.id,
          appleProductId: plan.appleProductIdYearly,
          name: plan.displayName,
          billingCycle: 'YEARLY',
          price: Number(plan.yearlyPrice),
          stripePriceId: plan.stripePriceIdYearly,
        });
      }
      
      return result;
    });

    res.json({
      status: 'success',
      data: {
        products
      }
    });
  })
);

export default router;

