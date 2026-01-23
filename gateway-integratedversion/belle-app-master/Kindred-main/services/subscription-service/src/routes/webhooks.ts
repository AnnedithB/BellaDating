import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { stripe } from '../services/stripe';
import { logger } from '../utils/logger';
import appleService, {
  APPLE_NOTIFICATION_TYPES,
  DecodedNotification,
  AppleTransactionInfo,
  AppleRenewalInfo,
} from '../services/apple';

const router = express.Router();
const prisma = new PrismaClient();

// Stripe webhook endpoint
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    logger.error('Stripe webhook secret not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  logger.info(`Received Stripe webhook: ${event.type}`, { eventId: event.id });

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'invoice.created':
        await handleInvoiceCreated(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'customer.created':
        await handleCustomerCreated(event.data.object);
        break;

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle subscription created
async function handleSubscriptionCreated(subscription: any) {
  logger.info(`Processing subscription created: ${subscription.id}`);
  
  try {
    // Update subscription status in database
    await prisma.userSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: subscription.status.toUpperCase(),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        isTrialActive: subscription.status === 'trialing',
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
      }
    });

    logger.info(`Updated subscription in database: ${subscription.id}`);
  } catch (error) {
    logger.error(`Error updating subscription ${subscription.id}:`, error);
    throw error;
  }
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription: any) {
  logger.info(`Processing subscription updated: ${subscription.id}`);

  try {
    const updateData: any = {
      status: subscription.status.toUpperCase(),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      isTrialActive: subscription.status === 'trialing'
    };

    // Handle cancellation
    if (subscription.cancel_at_period_end) {
      updateData.cancelAt = new Date(subscription.current_period_end * 1000);
      updateData.autoRenew = false;
    } else if (subscription.status === 'active') {
      updateData.cancelAt = null;
      updateData.autoRenew = true;
    }

    // Handle immediate cancellation
    if (subscription.status === 'canceled') {
      updateData.canceledAt = new Date();
      updateData.endedAt = new Date();
    }

    await prisma.userSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: updateData
    });

    logger.info(`Updated subscription status: ${subscription.id} -> ${subscription.status}`);
  } catch (error) {
    logger.error(`Error updating subscription ${subscription.id}:`, error);
    throw error;
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription: any) {
  logger.info(`Processing subscription deleted: ${subscription.id}`);

  try {
    await prisma.userSubscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        endedAt: new Date()
      }
    });

    logger.info(`Marked subscription as canceled: ${subscription.id}`);
  } catch (error) {
    logger.error(`Error marking subscription as canceled ${subscription.id}:`, error);
    throw error;
  }
}

// Handle successful invoice payment
async function handleInvoicePaymentSucceeded(invoice: any) {
  logger.info(`Processing invoice payment succeeded: ${invoice.id}`);

  try {
    // Update invoice status
    await prisma.invoice.updateMany({
      where: { stripeInvoiceId: invoice.id },
      data: {
        status: 'PAID',
        paidAt: new Date(invoice.status_transitions.paid_at * 1000)
      }
    });

    // Create payment record
    const subscription = await prisma.userSubscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription }
    });

    if (subscription) {
      await prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          amount: invoice.amount_paid / 100, // Convert from cents
          currency: invoice.currency.toUpperCase(),
          status: 'SUCCEEDED',
          paymentMethod: 'CARD',
          stripeChargeId: invoice.charge,
          processedAt: new Date(invoice.status_transitions.paid_at * 1000)
        }
      });

      // Update subscription renewal notification flag
      await prisma.userSubscription.update({
        where: { id: subscription.id },
        data: { renewalNotifiedAt: null } // Reset for next billing cycle
      });
    }

    logger.info(`Processed successful payment for invoice: ${invoice.id}`);
  } catch (error) {
    logger.error(`Error processing successful payment for invoice ${invoice.id}:`, error);
    throw error;
  }
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice: any) {
  logger.info(`Processing invoice payment failed: ${invoice.id}`);

  try {
    // Update invoice status
    await prisma.invoice.updateMany({
      where: { stripeInvoiceId: invoice.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        attemptedAt: new Date()
      }
    });

    // Create failed payment record
    const subscription = await prisma.userSubscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription }
    });

    if (subscription) {
      await prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          amount: invoice.amount_due / 100, // Convert from cents
          currency: invoice.currency.toUpperCase(),
          status: 'FAILED',
          paymentMethod: 'CARD',
          failedAt: new Date(),
          failureCode: 'payment_failed',
          failureMessage: 'Invoice payment failed'
        }
      });

      // Update subscription status if needed
      if (invoice.attempt_count >= (process.env.PAYMENT_RETRY_ATTEMPTS || 3)) {
        await prisma.userSubscription.update({
          where: { id: subscription.id },
          data: { status: 'PAST_DUE' }
        });
      }
    }

    logger.info(`Processed failed payment for invoice: ${invoice.id}`);
  } catch (error) {
    logger.error(`Error processing failed payment for invoice ${invoice.id}:`, error);
    throw error;
  }
}

// Handle invoice created
async function handleInvoiceCreated(invoice: any) {
  logger.info(`Processing invoice created: ${invoice.id}`);

  try {
    const subscription = await prisma.userSubscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription }
    });

    if (subscription) {
      // Create invoice record
      await prisma.invoice.create({
        data: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          invoiceNumber: invoice.number || `INV-${Date.now()}`,
          status: invoice.status === 'paid' ? 'PAID' : 'PENDING',
          subtotal: invoice.subtotal / 100,
          discountAmount: (invoice.discount?.amount || 0) / 100,
          taxAmount: invoice.tax || 0,
          totalAmount: invoice.total / 100,
          currency: invoice.currency.toUpperCase(),
          periodStart: new Date(invoice.period_start * 1000),
          periodEnd: new Date(invoice.period_end * 1000),
          dueDate: new Date(invoice.due_date * 1000),
          stripeInvoiceId: invoice.id,
          lineItems: invoice.lines.data || []
        }
      });
    }

    logger.info(`Created invoice record: ${invoice.id}`);
  } catch (error) {
    logger.error(`Error creating invoice record ${invoice.id}:`, error);
    throw error;
  }
}

// Handle successful payment intent
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  logger.info(`Processing payment intent succeeded: ${paymentIntent.id}`);

  try {
    // Update payment record if exists
    await prisma.payment.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'SUCCEEDED',
        processedAt: new Date()
      }
    });

    logger.info(`Updated payment intent: ${paymentIntent.id}`);
  } catch (error) {
    logger.error(`Error updating payment intent ${paymentIntent.id}:`, error);
    throw error;
  }
}

// Handle failed payment intent
async function handlePaymentIntentFailed(paymentIntent: any) {
  logger.info(`Processing payment intent failed: ${paymentIntent.id}`);

  try {
    // Update payment record if exists
    await prisma.payment.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureCode: paymentIntent.last_payment_error?.code || 'unknown',
        failureMessage: paymentIntent.last_payment_error?.message || 'Payment failed'
      }
    });

    logger.info(`Updated failed payment intent: ${paymentIntent.id}`);
  } catch (error) {
    logger.error(`Error updating failed payment intent ${paymentIntent.id}:`, error);
    throw error;
  }
}

// Handle customer created
async function handleCustomerCreated(customer: any) {
  logger.info(`Processing customer created: ${customer.id}`);
  // This is mainly for logging purposes
  // Customer creation is typically handled when creating subscriptions
}

// ========================================
// APPLE APP STORE SERVER NOTIFICATIONS V2
// ========================================

/**
 * Apple App Store Server Notifications V2 Webhook
 *
 * Configure this endpoint in App Store Connect:
 * 1. Go to App Store Connect > Your App > App Information
 * 2. Under "App Store Server Notifications", set the URL to:
 *    https://your-domain.com/webhooks/apple
 * 3. Select "Version 2 Notifications"
 */
router.post('/apple', express.text({ type: '*/*' }), async (req: Request, res: Response) => {
  logger.info('Received Apple App Store notification');

  try {
    // The body is a JWS (JSON Web Signature) signed payload
    const signedPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (!signedPayload) {
      logger.error('Empty payload received from Apple');
      return res.status(400).json({ error: 'Empty payload' });
    }

    // Decode and verify the notification
    let notification: DecodedNotification;
    try {
      notification = appleService.decodeNotification(signedPayload);
    } catch (decodeError) {
      logger.error('Failed to decode Apple notification:', decodeError);
      return res.status(400).json({ error: 'Invalid notification format' });
    }

    logger.info(`Apple notification type: ${notification.notificationType}`, {
      subtype: notification.subtype,
      uuid: notification.notificationUUID,
      environment: notification.data.environment,
    });

    // Store the notification for audit trail
    const storedNotification = await prisma.appleNotification.create({
      data: {
        notificationType: notification.notificationType,
        subtype: notification.subtype || null,
        notificationUUID: notification.notificationUUID,
        originalTransactionId: '',  // Will be updated below
        signedPayload,
        decodedPayload: notification as any,
        environment: notification.data.environment,
      },
    });

    // Extract transaction and renewal info
    const { transactionInfo, renewalInfo } = appleService.extractTransactionFromNotification(notification);

    // Update the notification with transaction ID
    if (transactionInfo) {
      await prisma.appleNotification.update({
        where: { id: storedNotification.id },
        data: {
          originalTransactionId: transactionInfo.originalTransactionId,
          transactionId: transactionInfo.transactionId,
          productId: transactionInfo.productId,
        },
      });
    }

    // Process the notification based on type
    try {
      await processAppleNotification(notification, transactionInfo, renewalInfo);

      // Mark as processed
      await prisma.appleNotification.update({
        where: { id: storedNotification.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });
    } catch (processError: any) {
      logger.error('Error processing Apple notification:', processError);

      // Store the error but still return 200 to Apple
      await prisma.appleNotification.update({
        where: { id: storedNotification.id },
        data: {
          processingError: processError.message || 'Unknown error',
        },
      });
    }

    // Always return 200 to acknowledge receipt
    // Apple will retry if we don't acknowledge
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Critical error processing Apple webhook:', error);
    // Still return 200 to prevent Apple from retrying endlessly
    res.status(200).json({ received: true, error: 'Processing error logged' });
  }
});

/**
 * Process Apple notification based on type
 */
async function processAppleNotification(
  notification: DecodedNotification,
  transactionInfo: AppleTransactionInfo | null,
  renewalInfo: AppleRenewalInfo | null
): Promise<void> {
  const { notificationType, subtype } = notification;

  switch (notificationType) {
    case APPLE_NOTIFICATION_TYPES.SUBSCRIBED:
      await handleAppleSubscribed(transactionInfo, renewalInfo, subtype);
      break;

    case APPLE_NOTIFICATION_TYPES.DID_RENEW:
      await handleAppleDidRenew(transactionInfo, renewalInfo);
      break;

    case APPLE_NOTIFICATION_TYPES.DID_FAIL_TO_RENEW:
      await handleAppleDidFailToRenew(transactionInfo, renewalInfo);
      break;

    case APPLE_NOTIFICATION_TYPES.DID_CHANGE_RENEWAL_STATUS:
      await handleAppleRenewalStatusChange(transactionInfo, renewalInfo, subtype);
      break;

    case APPLE_NOTIFICATION_TYPES.DID_CHANGE_RENEWAL_PREF:
      await handleAppleRenewalPrefChange(transactionInfo, renewalInfo);
      break;

    case APPLE_NOTIFICATION_TYPES.EXPIRED:
      await handleAppleExpired(transactionInfo, renewalInfo, subtype);
      break;

    case APPLE_NOTIFICATION_TYPES.GRACE_PERIOD_EXPIRED:
      await handleAppleGracePeriodExpired(transactionInfo, renewalInfo);
      break;

    case APPLE_NOTIFICATION_TYPES.REFUND:
      await handleAppleRefund(transactionInfo);
      break;

    case APPLE_NOTIFICATION_TYPES.REFUND_REVERSED:
      await handleAppleRefundReversed(transactionInfo);
      break;

    case APPLE_NOTIFICATION_TYPES.REVOKE:
      await handleAppleRevoke(transactionInfo);
      break;

    case APPLE_NOTIFICATION_TYPES.OFFER_REDEEMED:
      await handleAppleOfferRedeemed(transactionInfo, renewalInfo);
      break;

    case APPLE_NOTIFICATION_TYPES.PRICE_INCREASE:
      await handleApplePriceIncrease(transactionInfo, renewalInfo, subtype);
      break;

    case APPLE_NOTIFICATION_TYPES.TEST:
      logger.info('Received Apple test notification');
      break;

    default:
      logger.warn(`Unhandled Apple notification type: ${notificationType}`);
  }
}

/**
 * Handle new subscription or resubscription
 */
async function handleAppleSubscribed(
  transactionInfo: AppleTransactionInfo | null,
  renewalInfo: AppleRenewalInfo | null,
  subtype?: string
): Promise<void> {
  if (!transactionInfo) {
    logger.error('No transaction info in SUBSCRIBED notification');
    return;
  }

  logger.info(`Processing Apple subscription: ${transactionInfo.originalTransactionId}`, {
    productId: transactionInfo.productId,
    subtype,
  });

  // Store or update the Apple transaction
  await upsertAppleTransaction(transactionInfo, renewalInfo);

  // Find the subscription by Apple transaction ID
  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: transactionInfo.originalTransactionId },
  });

  if (subscription) {
    // Update existing subscription
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: new Date(transactionInfo.purchaseDate),
        currentPeriodEnd: transactionInfo.expiresDate
          ? new Date(transactionInfo.expiresDate)
          : undefined,
        isTrialActive: transactionInfo.isTrialPeriod,
        autoRenew: renewalInfo?.autoRenewStatus === 1,
      },
    });

    logger.info(`Updated subscription ${subscription.id} to ACTIVE`);
  } else {
    logger.warn(`No subscription found for Apple transaction: ${transactionInfo.originalTransactionId}`);
    // The subscription will be created when the mobile app verifies the purchase
  }
}

/**
 * Handle subscription renewal
 */
async function handleAppleDidRenew(
  transactionInfo: AppleTransactionInfo | null,
  renewalInfo: AppleRenewalInfo | null
): Promise<void> {
  if (!transactionInfo) {
    logger.error('No transaction info in DID_RENEW notification');
    return;
  }

  logger.info(`Processing Apple renewal: ${transactionInfo.originalTransactionId}`);

  // Update transaction record
  await upsertAppleTransaction(transactionInfo, renewalInfo);

  // Update subscription
  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: transactionInfo.originalTransactionId },
  });

  if (subscription) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: new Date(transactionInfo.purchaseDate),
        currentPeriodEnd: transactionInfo.expiresDate
          ? new Date(transactionInfo.expiresDate)
          : undefined,
        isTrialActive: false,
        renewalNotifiedAt: null,
      },
    });

    // Create payment record for the renewal
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        amount: transactionInfo.price ? transactionInfo.price / 1000 : subscription.currentPrice,
        currency: transactionInfo.currency || subscription.currency,
        status: 'SUCCEEDED',
        paymentMethod: 'APPLE_IAP',
        processedAt: new Date(transactionInfo.purchaseDate),
        metadata: {
          appleTransactionId: transactionInfo.transactionId,
          appleOriginalTransactionId: transactionInfo.originalTransactionId,
        },
      },
    });

    logger.info(`Processed renewal for subscription ${subscription.id}`);
  }
}

/**
 * Handle failed renewal attempt
 */
async function handleAppleDidFailToRenew(
  transactionInfo: AppleTransactionInfo | null,
  renewalInfo: AppleRenewalInfo | null
): Promise<void> {
  if (!transactionInfo) return;

  logger.info(`Processing Apple renewal failure: ${transactionInfo.originalTransactionId}`);

  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: transactionInfo.originalTransactionId },
  });

  if (subscription) {
    // Check if in grace period or billing retry
    const newStatus = renewalInfo?.gracePeriodExpiresDate ? 'PAST_DUE' : 'PAST_DUE';

    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: newStatus,
        autoRenew: renewalInfo?.autoRenewStatus === 1,
      },
    });

    logger.info(`Marked subscription ${subscription.id} as ${newStatus}`);
  }
}

/**
 * Handle auto-renew status change (user turned off auto-renew)
 */
async function handleAppleRenewalStatusChange(
  transactionInfo: AppleTransactionInfo | null,
  renewalInfo: AppleRenewalInfo | null,
  subtype?: string
): Promise<void> {
  if (!renewalInfo) return;

  logger.info(`Processing Apple renewal status change: ${renewalInfo.originalTransactionId}`, {
    autoRenewStatus: renewalInfo.autoRenewStatus,
    subtype,
  });

  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: renewalInfo.originalTransactionId },
  });

  if (subscription) {
    const autoRenewEnabled = renewalInfo.autoRenewStatus === 1;

    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew: autoRenewEnabled,
        // If auto-renew disabled, set cancel date to period end
        cancelAt: !autoRenewEnabled ? subscription.currentPeriodEnd : null,
      },
    });

    logger.info(`Updated auto-renew for subscription ${subscription.id}: ${autoRenewEnabled}`);
  }
}

/**
 * Handle renewal preference change (user changed plan)
 */
async function handleAppleRenewalPrefChange(
  transactionInfo: AppleTransactionInfo | null,
  renewalInfo: AppleRenewalInfo | null
): Promise<void> {
  if (!renewalInfo) return;

  logger.info(`Processing Apple renewal pref change: ${renewalInfo.originalTransactionId}`, {
    newProductId: renewalInfo.autoRenewProductId,
  });

  // The plan change will take effect at next renewal
  // We can store the pending change or just let it happen
  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: renewalInfo.originalTransactionId },
  });

  if (subscription) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        metadata: {
          ...(subscription.metadata as any),
          pendingAppleProductId: renewalInfo.autoRenewProductId,
        },
      },
    });
  }
}

/**
 * Handle subscription expiration
 */
async function handleAppleExpired(
  transactionInfo: AppleTransactionInfo | null,
  renewalInfo: AppleRenewalInfo | null,
  subtype?: string
): Promise<void> {
  if (!transactionInfo) return;

  logger.info(`Processing Apple expiration: ${transactionInfo.originalTransactionId}`, {
    subtype,
    expirationIntent: renewalInfo?.expirationIntent,
  });

  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: transactionInfo.originalTransactionId },
  });

  if (subscription) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        endedAt: transactionInfo.expiresDate
          ? new Date(transactionInfo.expiresDate)
          : new Date(),
        cancellationReason: getExpirationReasonText(renewalInfo?.expirationIntent),
      },
    });

    logger.info(`Marked subscription ${subscription.id} as expired`);
  }
}

/**
 * Handle grace period expiration
 */
async function handleAppleGracePeriodExpired(
  transactionInfo: AppleTransactionInfo | null,
  renewalInfo: AppleRenewalInfo | null
): Promise<void> {
  if (!transactionInfo) return;

  logger.info(`Processing Apple grace period expired: ${transactionInfo.originalTransactionId}`);

  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: transactionInfo.originalTransactionId },
  });

  if (subscription) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        endedAt: new Date(),
        cancellationReason: 'Grace period expired - payment failed',
      },
    });
  }
}

/**
 * Handle refund
 */
async function handleAppleRefund(transactionInfo: AppleTransactionInfo | null): Promise<void> {
  if (!transactionInfo) return;

  logger.info(`Processing Apple refund: ${transactionInfo.originalTransactionId}`);

  // Update transaction as revoked
  await prisma.appleTransaction.updateMany({
    where: { originalTransactionId: transactionInfo.originalTransactionId },
    data: { isRevoked: true },
  });

  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: transactionInfo.originalTransactionId },
  });

  if (subscription) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        endedAt: new Date(),
        cancellationReason: 'Refunded',
        refundedAt: new Date(),
      },
    });
  }
}

/**
 * Handle refund reversal (Apple denied the refund request)
 */
async function handleAppleRefundReversed(transactionInfo: AppleTransactionInfo | null): Promise<void> {
  if (!transactionInfo) return;

  logger.info(`Processing Apple refund reversed: ${transactionInfo.originalTransactionId}`);

  // Reactivate the subscription
  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: transactionInfo.originalTransactionId },
  });

  if (subscription && transactionInfo.expiresDate && transactionInfo.expiresDate > Date.now()) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        canceledAt: null,
        endedAt: null,
        cancellationReason: null,
        refundedAt: null,
      },
    });
  }
}

/**
 * Handle revocation (family sharing ended, etc.)
 */
async function handleAppleRevoke(transactionInfo: AppleTransactionInfo | null): Promise<void> {
  if (!transactionInfo) return;

  logger.info(`Processing Apple revoke: ${transactionInfo.originalTransactionId}`, {
    revocationReason: transactionInfo.revocationReason,
  });

  await prisma.appleTransaction.updateMany({
    where: { originalTransactionId: transactionInfo.originalTransactionId },
    data: { isRevoked: true },
  });

  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: transactionInfo.originalTransactionId },
  });

  if (subscription) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        endedAt: new Date(),
        cancellationReason: 'Access revoked',
      },
    });
  }
}

/**
 * Handle promotional offer redemption
 */
async function handleAppleOfferRedeemed(
  transactionInfo: AppleTransactionInfo | null,
  renewalInfo: AppleRenewalInfo | null
): Promise<void> {
  if (!transactionInfo) return;

  logger.info(`Processing Apple offer redeemed: ${transactionInfo.originalTransactionId}`, {
    offerId: transactionInfo.offerIdentifier,
    offerType: transactionInfo.offerType,
  });

  await upsertAppleTransaction(transactionInfo, renewalInfo);
}

/**
 * Handle price increase consent
 */
async function handleApplePriceIncrease(
  transactionInfo: AppleTransactionInfo | null,
  renewalInfo: AppleRenewalInfo | null,
  subtype?: string
): Promise<void> {
  logger.info('Processing Apple price increase notification', {
    subtype,
    priceIncreaseStatus: renewalInfo?.priceIncreaseStatus,
  });

  // subtype: PENDING (needs consent), ACCEPTED (user accepted), or notification without subtype
  // priceIncreaseStatus: 0 = not responded, 1 = accepted
}

/**
 * Upsert Apple transaction record
 */
async function upsertAppleTransaction(
  transactionInfo: AppleTransactionInfo,
  renewalInfo: AppleRenewalInfo | null
): Promise<void> {
  // Find associated subscription
  const subscription = await prisma.userSubscription.findFirst({
    where: { appleOriginalTransactionId: transactionInfo.originalTransactionId },
  });

  await prisma.appleTransaction.upsert({
    where: { originalTransactionId: transactionInfo.originalTransactionId },
    create: {
      userId: subscription?.userId || 'unknown',
      subscriptionId: subscription?.id,
      originalTransactionId: transactionInfo.originalTransactionId,
      transactionId: transactionInfo.transactionId,
      webOrderLineItemId: transactionInfo.webOrderLineItemId,
      productId: transactionInfo.productId,
      bundleId: transactionInfo.bundleId,
      purchaseDate: new Date(transactionInfo.purchaseDate),
      originalPurchaseDate: new Date(transactionInfo.originalPurchaseDate),
      expiresDate: transactionInfo.expiresDate ? new Date(transactionInfo.expiresDate) : null,
      isTrialPeriod: transactionInfo.isTrialPeriod || false,
      isInIntroOfferPeriod: transactionInfo.offerType === 1,
      isUpgraded: transactionInfo.isUpgraded || false,
      autoRenewStatus: renewalInfo?.autoRenewStatus === 1,
      autoRenewProductId: renewalInfo?.autoRenewProductId,
      expirationIntent: renewalInfo?.expirationIntent,
      priceInMillis: transactionInfo.price ? BigInt(transactionInfo.price) : null,
      currency: transactionInfo.currency,
      environment: transactionInfo.environment,
    },
    update: {
      transactionId: transactionInfo.transactionId,
      expiresDate: transactionInfo.expiresDate ? new Date(transactionInfo.expiresDate) : null,
      isTrialPeriod: transactionInfo.isTrialPeriod || false,
      isUpgraded: transactionInfo.isUpgraded || false,
      autoRenewStatus: renewalInfo?.autoRenewStatus === 1,
      autoRenewProductId: renewalInfo?.autoRenewProductId,
      expirationIntent: renewalInfo?.expirationIntent,
      priceInMillis: transactionInfo.price ? BigInt(transactionInfo.price) : null,
      currency: transactionInfo.currency,
    },
  });
}

/**
 * Get human-readable expiration reason
 */
function getExpirationReasonText(expirationIntent?: number): string {
  switch (expirationIntent) {
    case 1:
      return 'Customer voluntarily canceled';
    case 2:
      return 'Billing error';
    case 3:
      return 'Customer did not consent to price increase';
    case 4:
      return 'Product not available at renewal';
    default:
      return 'Unknown reason';
  }
}

export default router;