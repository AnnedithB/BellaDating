/**
 * Apple In-App Purchase Routes
 *
 * These routes are called by the mobile app after a purchase is made via StoreKit.
 * The mobile app uses react-native-iap to handle the native purchase flow,
 * then sends the transaction to this API for verification and subscription creation.
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import appleService from '../services/apple';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to verify JWT token (assuming you have auth middleware)
// import { authMiddleware } from '../middleware/auth';
// router.use(authMiddleware);

interface VerifyPurchaseBody {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseToken?: string; // For StoreKit 1 receipt
}

interface RestorePurchasesBody {
  transactions: Array<{
    transactionId: string;
    originalTransactionId: string;
    productId: string;
  }>;
}

/**
 * GET /api/apple-iap/products
 *
 * Get subscription plans with Apple product IDs
 * Mobile app uses this to know which products to request from StoreKit
 */
router.get('/products', async (req: Request, res: Response) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        isActive: true,
        OR: [
          { appleProductIdMonthly: { not: null } },
          { appleProductIdYearly: { not: null } },
        ],
      },
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
        appleProductIdMonthly: true,
        appleProductIdYearly: true,
      },
    });

    // Extract all Apple product IDs for the mobile app to fetch from StoreKit
    const appleProductIds = plans.flatMap((plan) => [
      plan.appleProductIdMonthly,
      plan.appleProductIdYearly,
    ]).filter(Boolean) as string[];

    res.json({
      status: 'success',
      data: {
        plans,
        appleProductIds,
      },
    });
  } catch (error) {
    logger.error('Error fetching Apple IAP products:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch products',
    });
  }
});

/**
 * POST /api/apple-iap/verify-purchase
 *
 * Verify a purchase made via StoreKit and create/update subscription
 * Called by mobile app after successful purchase
 */
router.post('/verify-purchase', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
    }

    const { transactionId, originalTransactionId, productId } = req.body as VerifyPurchaseBody;

    if (!transactionId || !originalTransactionId || !productId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: transactionId, originalTransactionId, productId',
      });
    }

    logger.info(`Verifying Apple purchase for user ${userId}`, {
      transactionId,
      originalTransactionId,
      productId,
    });

    // Verify the transaction with Apple's servers
    let subscriptionStatus;
    try {
      subscriptionStatus = await appleService.getFullSubscriptionStatus(originalTransactionId);
    } catch (appleError) {
      logger.error('Apple verification failed:', appleError);
      // In sandbox, Apple API might not be available, allow the purchase anyway
      if (appleService.getEnvironment() === 'Sandbox') {
        logger.warn('Sandbox mode: proceeding without Apple verification');
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to verify purchase with Apple',
        });
      }
    }

    // Find the plan by Apple product ID
    const plan = await prisma.subscriptionPlan.findFirst({
      where: {
        OR: [
          { appleProductIdMonthly: productId },
          { appleProductIdYearly: productId },
        ],
      },
    });

    if (!plan) {
      return res.status(400).json({
        status: 'error',
        message: `No plan found for product ID: ${productId}`,
      });
    }

    // Determine billing cycle
    const billingCycle = plan.appleProductIdYearly === productId ? 'YEARLY' : 'MONTHLY';
    const price = billingCycle === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;

    // Check for existing subscription with this Apple transaction
    let subscription = await prisma.userSubscription.findFirst({
      where: { appleOriginalTransactionId: originalTransactionId },
    });

    // Calculate period dates
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Use Apple's dates if available
    const purchaseDate = subscriptionStatus?.transactionInfo?.purchaseDate
      ? new Date(subscriptionStatus.transactionInfo.purchaseDate)
      : now;
    const expiresDate = subscriptionStatus?.transactionInfo?.expiresDate
      ? new Date(subscriptionStatus.transactionInfo.expiresDate)
      : periodEnd;

    if (subscription) {
      // Update existing subscription
      subscription = await prisma.userSubscription.update({
        where: { id: subscription.id },
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          billingCycle,
          currentPrice: price,
          currentPeriodStart: purchaseDate,
          currentPeriodEnd: expiresDate,
          isTrialActive: subscriptionStatus?.transactionInfo?.isTrialPeriod || false,
          autoRenew: subscriptionStatus?.renewalInfo?.autoRenewStatus === 1,
          cancelAt: null,
          canceledAt: null,
          endedAt: null,
        },
        include: { plan: true },
      });

      logger.info(`Updated subscription ${subscription.id} for user ${userId}`);
    } else {
      // Check if user already has an active subscription (different Apple transaction)
      const existingActive = await prisma.userSubscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          paymentProvider: 'APPLE',
        },
      });

      if (existingActive) {
        // Cancel the old subscription
        await prisma.userSubscription.update({
          where: { id: existingActive.id },
          data: {
            status: 'CANCELED',
            canceledAt: now,
            endedAt: now,
            cancellationReason: 'Upgraded to new subscription',
          },
        });
      }

      // Create new subscription
      subscription = await prisma.userSubscription.create({
        data: {
          userId,
          planId: plan.id,
          status: 'ACTIVE',
          billingCycle,
          currentPrice: price,
          currency: 'USD',
          startedAt: purchaseDate,
          currentPeriodStart: purchaseDate,
          currentPeriodEnd: expiresDate,
          paymentProvider: 'APPLE',
          appleOriginalTransactionId: originalTransactionId,
          appleProductId: productId,
          isTrialActive: subscriptionStatus?.transactionInfo?.isTrialPeriod || false,
          autoRenew: subscriptionStatus?.renewalInfo?.autoRenewStatus !== 0,
        },
        include: { plan: true },
      });

      logger.info(`Created subscription ${subscription.id} for user ${userId}`);
    }

    // Store Apple transaction
    await prisma.appleTransaction.upsert({
      where: { originalTransactionId },
      create: {
        userId,
        subscriptionId: subscription.id,
        originalTransactionId,
        transactionId,
        productId,
        bundleId: process.env.APPLE_BUNDLE_ID || 'com.belle.dating',
        purchaseDate,
        originalPurchaseDate: subscriptionStatus?.transactionInfo?.originalPurchaseDate
          ? new Date(subscriptionStatus.transactionInfo.originalPurchaseDate)
          : purchaseDate,
        expiresDate,
        isTrialPeriod: subscriptionStatus?.transactionInfo?.isTrialPeriod || false,
        autoRenewStatus: subscriptionStatus?.renewalInfo?.autoRenewStatus === 1,
        environment: appleService.getEnvironment(),
      },
      update: {
        subscriptionId: subscription.id,
        transactionId,
        expiresDate,
        isTrialPeriod: subscriptionStatus?.transactionInfo?.isTrialPeriod || false,
        autoRenewStatus: subscriptionStatus?.renewalInfo?.autoRenewStatus === 1,
      },
    });

    // Create payment record
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        userId,
        amount: price,
        currency: 'USD',
        status: 'SUCCEEDED',
        paymentMethod: 'APPLE_IAP',
        processedAt: purchaseDate,
        metadata: {
          appleTransactionId: transactionId,
          appleOriginalTransactionId: originalTransactionId,
          appleProductId: productId,
        },
      },
    });

    res.json({
      status: 'success',
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          plan: subscription.plan,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          isTrialActive: subscription.isTrialActive,
          autoRenew: subscription.autoRenew,
        },
      },
    });
  } catch (error) {
    logger.error('Error verifying Apple purchase:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify purchase',
    });
  }
});

/**
 * POST /api/apple-iap/restore-purchases
 *
 * Restore purchases for a user (e.g., after reinstalling app)
 * Mobile app calls this with all restored transactions from StoreKit
 */
router.post('/restore-purchases', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
    }

    const { transactions } = req.body as RestorePurchasesBody;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No transactions to restore',
      });
    }

    logger.info(`Restoring ${transactions.length} purchases for user ${userId}`);

    const restoredSubscriptions: any[] = [];
    const errors: any[] = [];

    for (const tx of transactions) {
      try {
        // Check if transaction already exists for another user
        const existingTx = await prisma.appleTransaction.findUnique({
          where: { originalTransactionId: tx.originalTransactionId },
        });

        if (existingTx && existingTx.userId !== userId && existingTx.userId !== 'unknown') {
          errors.push({
            transactionId: tx.transactionId,
            error: 'Transaction belongs to another account',
          });
          continue;
        }

        // Verify with Apple
        const status = await appleService.getFullSubscriptionStatus(tx.originalTransactionId);

        if (!status || status.status !== 1) {
          // Status 1 = Active
          errors.push({
            transactionId: tx.transactionId,
            error: 'Subscription is not active',
          });
          continue;
        }

        // Find the plan
        const plan = await prisma.subscriptionPlan.findFirst({
          where: {
            OR: [
              { appleProductIdMonthly: tx.productId },
              { appleProductIdYearly: tx.productId },
            ],
          },
        });

        if (!plan) {
          errors.push({
            transactionId: tx.transactionId,
            error: 'Unknown product ID',
          });
          continue;
        }

        const billingCycle = plan.appleProductIdYearly === tx.productId ? 'YEARLY' : 'MONTHLY';
        const price = billingCycle === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;

        // Create or update subscription
        const subscription = await prisma.userSubscription.upsert({
          where: { appleOriginalTransactionId: tx.originalTransactionId },
          create: {
            userId,
            planId: plan.id,
            status: 'ACTIVE',
            billingCycle,
            currentPrice: price,
            currency: 'USD',
            startedAt: status.transactionInfo.originalPurchaseDate
              ? new Date(status.transactionInfo.originalPurchaseDate)
              : new Date(),
            currentPeriodStart: new Date(status.transactionInfo.purchaseDate),
            currentPeriodEnd: status.transactionInfo.expiresDate
              ? new Date(status.transactionInfo.expiresDate)
              : new Date(),
            paymentProvider: 'APPLE',
            appleOriginalTransactionId: tx.originalTransactionId,
            appleProductId: tx.productId,
            autoRenew: status.renewalInfo?.autoRenewStatus === 1,
          },
          update: {
            userId, // Update userId to current user (in case of account merge)
            status: 'ACTIVE',
            currentPeriodStart: new Date(status.transactionInfo.purchaseDate),
            currentPeriodEnd: status.transactionInfo.expiresDate
              ? new Date(status.transactionInfo.expiresDate)
              : new Date(),
            autoRenew: status.renewalInfo?.autoRenewStatus === 1,
            cancelAt: null,
            canceledAt: null,
            endedAt: null,
          },
          include: { plan: true },
        });

        // Update Apple transaction
        await prisma.appleTransaction.upsert({
          where: { originalTransactionId: tx.originalTransactionId },
          create: {
            userId,
            subscriptionId: subscription.id,
            originalTransactionId: tx.originalTransactionId,
            transactionId: tx.transactionId,
            productId: tx.productId,
            bundleId: status.transactionInfo.bundleId,
            purchaseDate: new Date(status.transactionInfo.purchaseDate),
            originalPurchaseDate: new Date(status.transactionInfo.originalPurchaseDate),
            expiresDate: status.transactionInfo.expiresDate
              ? new Date(status.transactionInfo.expiresDate)
              : null,
            autoRenewStatus: status.renewalInfo?.autoRenewStatus === 1,
            environment: status.transactionInfo.environment,
          },
          update: {
            userId,
            subscriptionId: subscription.id,
            transactionId: tx.transactionId,
            expiresDate: status.transactionInfo.expiresDate
              ? new Date(status.transactionInfo.expiresDate)
              : null,
            autoRenewStatus: status.renewalInfo?.autoRenewStatus === 1,
          },
        });

        restoredSubscriptions.push({
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        });
      } catch (txError: any) {
        logger.error(`Error restoring transaction ${tx.transactionId}:`, txError);
        errors.push({
          transactionId: tx.transactionId,
          error: txError.message || 'Unknown error',
        });
      }
    }

    res.json({
      status: 'success',
      data: {
        restored: restoredSubscriptions,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    logger.error('Error restoring purchases:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to restore purchases',
    });
  }
});

/**
 * GET /api/apple-iap/subscription-status
 *
 * Get current subscription status for the user
 * Includes sync with Apple if subscription is active
 */
router.get('/subscription-status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
    }

    // Get the user's subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        paymentProvider: 'APPLE',
        status: { in: ['ACTIVE', 'PAST_DUE', 'TRIALING'] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return res.json({
        status: 'success',
        data: {
          hasActiveSubscription: false,
          subscription: null,
        },
      });
    }

    // Optionally sync with Apple for accurate status
    if (subscription.appleOriginalTransactionId) {
      try {
        const appleStatus = await appleService.getFullSubscriptionStatus(
          subscription.appleOriginalTransactionId
        );

        if (appleStatus) {
          const newStatus = appleService.mapAppleStatusToInternal(appleStatus.status);

          // Update if status changed
          if (newStatus !== subscription.status) {
            await prisma.userSubscription.update({
              where: { id: subscription.id },
              data: {
                status: newStatus,
                currentPeriodEnd: appleStatus.transactionInfo.expiresDate
                  ? new Date(appleStatus.transactionInfo.expiresDate)
                  : subscription.currentPeriodEnd,
                autoRenew: appleStatus.renewalInfo?.autoRenewStatus === 1,
              },
            });

            subscription.status = newStatus as any;
            if (appleStatus.transactionInfo.expiresDate) {
              subscription.currentPeriodEnd = new Date(appleStatus.transactionInfo.expiresDate);
            }
            subscription.autoRenew = appleStatus.renewalInfo?.autoRenewStatus === 1;
          }
        }
      } catch (syncError) {
        logger.warn('Failed to sync with Apple:', syncError);
        // Continue with cached data
      }
    }

    res.json({
      status: 'success',
      data: {
        hasActiveSubscription: subscription.status === 'ACTIVE' || subscription.status === 'TRIALING',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          plan: {
            id: subscription.plan.id,
            name: subscription.plan.name,
            displayName: subscription.plan.displayName,
            features: subscription.plan.features,
          },
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          isTrialActive: subscription.isTrialActive,
          autoRenew: subscription.autoRenew,
          cancelAt: subscription.cancelAt,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting subscription status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get subscription status',
    });
  }
});

/**
 * POST /api/apple-iap/sync
 *
 * Force sync subscription status with Apple
 * Useful for debugging or manual refresh
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
    }

    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        paymentProvider: 'APPLE',
        appleOriginalTransactionId: { not: null },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription || !subscription.appleOriginalTransactionId) {
      return res.status(404).json({
        status: 'error',
        message: 'No Apple subscription found',
      });
    }

    const appleStatus = await appleService.getFullSubscriptionStatus(
      subscription.appleOriginalTransactionId
    );

    if (!appleStatus) {
      return res.status(404).json({
        status: 'error',
        message: 'Could not retrieve status from Apple',
      });
    }

    const newStatus = appleService.mapAppleStatusToInternal(appleStatus.status);

    const updatedSubscription = await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: newStatus,
        currentPeriodEnd: appleStatus.transactionInfo.expiresDate
          ? new Date(appleStatus.transactionInfo.expiresDate)
          : subscription.currentPeriodEnd,
        autoRenew: appleStatus.renewalInfo?.autoRenewStatus === 1,
      },
      include: { plan: true },
    });

    res.json({
      status: 'success',
      data: {
        subscription: updatedSubscription,
        appleStatus: {
          status: appleStatus.status,
          expiresDate: appleStatus.transactionInfo.expiresDate,
          autoRenewStatus: appleStatus.renewalInfo?.autoRenewStatus,
        },
      },
    });
  } catch (error) {
    logger.error('Error syncing with Apple:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync with Apple',
    });
  }
});

export default router;
