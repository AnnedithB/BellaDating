import express, { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { StripeService, stripe } from '../services/stripe';
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
    body('billingCycle').isIn(['MONTHLY', 'SIXMONTH', 'YEARLY']),
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
    let promo = null;
    if (promoCode) {
      promo = await prisma.promoCode.findUnique({
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
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
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

// Create Stripe Checkout Session for web payments
router.post('/create-checkout-session',
  authenticateUser,
  [
    body('planId').optional().isString(),
    body('appleProductId').optional().isString(),
    body('billingCycle').isIn(['MONTHLY', 'SIXMONTH', 'YEARLY']),
    body('successUrl').optional().isString(),
    body('cancelUrl').optional().isString(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const userId = req.user!.id;
    const userEmail = req.user!.email;
    const { planId, appleProductId, billingCycle, successUrl, cancelUrl } = req.body;

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

    // Get subscription plan - either by planId or by appleProductId
    let plan;
    if (planId) {
      plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId, isActive: true }
      });
    } else if (appleProductId) {
      // Find plan by Apple product ID
      plan = await prisma.subscriptionPlan.findFirst({
        where: {
          isActive: true,
          OR: [
            { appleProductIdMonthly: appleProductId },
            { appleProductIdYearly: appleProductId }
          ]
        }
      });
      
      // Determine billing cycle from which field matched
      if (plan && plan.appleProductIdMonthly === appleProductId) {
        // Override billing cycle if it was determined from the product ID
        // billingCycle is already set from request
      }
    } else {
      throw createError('Either planId or appleProductId must be provided', 400);
    }

    if (!plan) {
      throw createError('Subscription plan not found or inactive', 404);
    }

    // Web pricing: $19.99/month, $99.99/6 months (different from Apple prices)
    // Apple pricing: $29.99/month, $139.99/6 months (stored in plan)
    const webMonthlyPrice = 19.99;
    const webSixMonthPrice = 99.99;
    
    // Use web pricing for Stripe checkout
    let webPrice: number;
    let priceInterval: string;
    if (billingCycle === 'SIXMONTH') {
      webPrice = webSixMonthPrice;
      priceInterval = 'month'; // Stripe will handle 6-month interval via recurring count
    } else if (billingCycle === 'YEARLY') {
      webPrice = webSixMonthPrice; // Keep same price for backwards compatibility
      priceInterval = 'year';
    } else {
      webPrice = webMonthlyPrice;
      priceInterval = 'month';
    }
    
    // Create Stripe price dynamically with web pricing
    let stripePriceId: string;
    try {
      const recurringConfig: any = { interval: priceInterval };
      if (billingCycle === 'SIXMONTH') {
        recurringConfig.interval_count = 6; // 6 months
      }
      
      const stripePrice = await stripe.prices.create({
        unit_amount: Math.round(webPrice * 100), // Convert to cents
        currency: 'usd',
        recurring: recurringConfig,
        product_data: {
          name: `${plan.displayName} - ${billingCycle === 'SIXMONTH' ? '6 Months' : billingCycle === 'YEARLY' ? 'Yearly' : 'Monthly'} (Web)`,
        },
      });
      stripePriceId = stripePrice.id;
      logger.info(`Created Stripe price for web checkout: ${stripePriceId} ($${webPrice}/${priceInterval})`);
    } catch (stripeError) {
      logger.error('Error creating Stripe price:', stripeError);
      throw createError('Failed to create payment price', 500);
    }

    // Create or get Stripe customer
    const customer = await StripeService.createCustomer(userId, userEmail);

    // Default URLs if not provided
    const defaultSuccessUrl = successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription/cancel`;

    // Create checkout session
    const session = await StripeService.createCheckoutSession(
      customer.id,
      stripePriceId,
      defaultSuccessUrl,
      defaultCancelUrl,
      {
        userId,
        planId: plan.id, // Always use database planId
        appleProductId: appleProductId, // Also include for webhook fallback
        billingCycle,
      }
    );

    if (!session.url) {
      throw createError('Failed to generate checkout URL', 500);
    }

    res.json({
      status: 'success',
      data: {
        sessionId: session.id,
        url: session.url,
      },
      message: 'Checkout session created successfully'
    });
  })
);

// Upgrade/downgrade subscription
router.put('/change-plan',
  authenticateUser,
  [
    body('newPlanId').notEmpty().isString(),
    body('billingCycle').optional().isIn(['MONTHLY', 'SIXMONTH', 'YEARLY']),
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
          id: (await stripe.subscriptions.retrieve(currentSubscription.stripeSubscriptionId!)).items.data[0].id,
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
      cancellationReason: reason || 'User requested cancellation'
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

// Checkout success endpoint (called by Stripe redirect)
router.get('/checkout-success',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.query.session_id as string;

    logger.info(`[CHECKOUT-SUCCESS] ========== CHECKOUT SUCCESS ENDPOINT CALLED ==========`);
    logger.info(`[CHECKOUT-SUCCESS] Session ID from query: ${sessionId}`);
    logger.info(`[CHECKOUT-SUCCESS] Full query params:`, JSON.stringify(req.query, null, 2));

    if (!sessionId) {
      logger.error(`[CHECKOUT-SUCCESS] ❌ No session ID provided`);
      return res.status(400).json({
        status: 'error',
        message: 'Session ID is required'
      });
    }

    try {
      // Retrieve the session from Stripe
      logger.info(`[CHECKOUT-SUCCESS] Retrieving Stripe session: ${sessionId}`);
      const session = await stripe.checkout.sessions.retrieve(sessionId as string);
      logger.info(`[CHECKOUT-SUCCESS] Stripe session retrieved:`);
      logger.info(`[CHECKOUT-SUCCESS] - Payment status: ${session.payment_status}`);
      logger.info(`[CHECKOUT-SUCCESS] - Subscription ID: ${session.subscription}`);
      logger.info(`[CHECKOUT-SUCCESS] - Metadata:`, JSON.stringify(session.metadata, null, 2));
      logger.info(`[CHECKOUT-SUCCESS] - Customer: ${session.customer}`);

      if (session.payment_status === 'paid' && session.subscription) {
        logger.info(`[CHECKOUT-SUCCESS] ✅ Payment is paid and subscription exists`);
        // Check if subscription already exists (created by webhook)
        logger.info(`[CHECKOUT-SUCCESS] Checking for existing subscription with Stripe ID: ${session.subscription}`);
        let subscription = await prisma.userSubscription.findFirst({
          where: { stripeSubscriptionId: session.subscription as string },
          include: { plan: true }
        });

        if (subscription) {
          logger.info(`[CHECKOUT-SUCCESS] ✅ Subscription already exists: ${subscription.id}, status: ${subscription.status}`);
        } else {
          logger.info(`[CHECKOUT-SUCCESS] ⚠️ Subscription not found in database, creating now...`);
          logger.info(`[CHECKOUT-SUCCESS] Session metadata:`, JSON.stringify(session.metadata, null, 2));
          
          const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const userId = session.metadata?.userId;
          let planId = session.metadata?.planId;
          const appleProductId = session.metadata?.appleProductId;
          const billingCycle = session.metadata?.billingCycle || 'MONTHLY';
          
          logger.info(`Attempting to create subscription. userId: ${userId}, planId: ${planId}, appleProductId: ${appleProductId}, billingCycle: ${billingCycle}`);

          if (!userId) {
            return res.status(400).json({
              status: 'error',
              message: 'User ID not found in session metadata'
            });
          }

          // Find plan
          let plan;
          if (planId) {
            plan = await prisma.subscriptionPlan.findUnique({
              where: { id: planId, isActive: true }
            });
            logger.info(`Plan lookup by planId ${planId}: ${plan ? `found (${plan.name})` : 'not found'}`);
          }
          
          if (!plan && appleProductId) {
            plan = await prisma.subscriptionPlan.findFirst({
              where: {
                isActive: true,
                OR: [
                  { appleProductIdMonthly: appleProductId },
                  { appleProductIdYearly: appleProductId }
                ]
              }
            });
            if (plan) planId = plan.id;
          }

          // If still no plan, try to get the default premium plan
          if (!plan) {
            logger.warn(`Plan not found by planId or appleProductId, trying default plan...`);
            plan = await prisma.subscriptionPlan.findFirst({
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' }
            });
            if (plan) {
              planId = plan.id;
              logger.info(`Using default plan: ${plan.id}`);
            }
          }

          if (!plan) {
            logger.error(`No subscription plan found. planId: ${planId}, appleProductId: ${appleProductId}`);
            // List all available plans for debugging
            const allPlans = await prisma.subscriptionPlan.findMany({
              select: { id: true, name: true, isActive: true, appleProductIdMonthly: true, appleProductIdYearly: true }
            });
            logger.error(`Available plans in database:`, JSON.stringify(allPlans, null, 2));
            return res.status(404).json({
              status: 'error',
              message: 'Subscription plan not found. Please ensure plans are seeded in the database.',
              debug: {
                requestedPlanId: planId,
                requestedAppleProductId: appleProductId,
                availablePlans: allPlans
              }
            });
          }

          // Create subscription
          const price = billingCycle === 'SIXMONTH' ? 99.99 : billingCycle === 'YEARLY' ? 99.99 : 19.99;
          subscription = await prisma.userSubscription.create({
            data: {
              userId,
              planId: plan.id,
              status: stripeSubscription.status.toUpperCase() as any,
              billingCycle: billingCycle as any,
              currentPrice: price,
              currency: 'USD',
              startedAt: new Date(stripeSubscription.created * 1000),
              currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
              stripeSubscriptionId: stripeSubscription.id,
              stripeCustomerId: stripeSubscription.customer as string,
              paymentProvider: 'STRIPE',
              isTrialActive: stripeSubscription.status === 'trialing',
              trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
              trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
              autoRenew: true
            },
            include: { plan: true }
          });

          logger.info(`[CHECKOUT-SUCCESS] ✅ Created subscription from checkout success endpoint: ${subscription.id}, status: ${subscription.status}`);
        }

        if (subscription) {
          logger.info(`[CHECKOUT-SUCCESS] ✅✅✅ RETURNING SUCCESS RESPONSE WITH SUBSCRIPTION ✅✅✅`);
          logger.info(`[CHECKOUT-SUCCESS] Subscription details:`, JSON.stringify({
            id: subscription.id,
            planId: subscription.planId,
            status: subscription.status,
            userId: subscription.userId,
            stripeSubscriptionId: subscription.stripeSubscriptionId
          }, null, 2));
          
          return res.json({
            status: 'success',
            message: 'Subscription activated successfully',
            data: {
              subscription: {
                id: subscription.id,
                plan: subscription.plan,
                status: subscription.status
              }
            }
          });
        } else {
          logger.warn(`[CHECKOUT-SUCCESS] ⚠️ Subscription object is null after creation attempt`);
        }
      } else {
        logger.warn(`[CHECKOUT-SUCCESS] ⚠️ Payment status is not 'paid' or subscription is missing`);
        logger.warn(`[CHECKOUT-SUCCESS] Payment status: ${session.payment_status}, Has subscription: ${!!session.subscription}`);
      }

      // Return success page HTML or redirect
      logger.info(`[CHECKOUT-SUCCESS] Redirecting to frontend success page...`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/subscription-success?session_id=${sessionId}`;
      logger.info(`[CHECKOUT-SUCCESS] Redirect URL: ${redirectUrl}`);
      return res.redirect(redirectUrl);
    } catch (error) {
      logger.error(`[CHECKOUT-SUCCESS] ❌❌❌ ERROR VERIFYING CHECKOUT SESSION! ❌❌❌`);
      logger.error(`[CHECKOUT-SUCCESS] Error message:`, error instanceof Error ? error.message : String(error));
      logger.error(`[CHECKOUT-SUCCESS] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      logger.error(`[CHECKOUT-SUCCESS] Full error:`, error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to verify payment'
      });
    }
  })
);

// Checkout cancel endpoint
router.get('/checkout-cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/subscription-cancel`);
  })
);

export default router;