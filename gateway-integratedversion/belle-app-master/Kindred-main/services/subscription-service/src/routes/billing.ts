import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { StripeService } from '../services/stripe';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Get user's invoices
router.get('/invoices',
  authenticateUser,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('status').optional().isIn(['PENDING', 'PAID', 'FAILED', 'VOID', 'REFUNDED'])
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          subscription: {
            include: {
              plan: {
                select: {
                  name: true,
                  displayName: true
                }
              }
            }
          }
        }
      }),
      prisma.invoice.count({ where })
    ]);

    res.json({
      status: 'success',
      data: {
        invoices: invoices.map(invoice => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          subtotal: Number(invoice.subtotal),
          discountAmount: Number(invoice.discountAmount),
          taxAmount: Number(invoice.taxAmount),
          totalAmount: Number(invoice.totalAmount),
          currency: invoice.currency,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          dueDate: invoice.dueDate,
          paidAt: invoice.paidAt,
          plan: invoice.subscription?.plan,
          createdAt: invoice.createdAt
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

// Get single invoice details
router.get('/invoices/:id',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        userId
      },
      include: {
        subscription: {
          include: {
            plan: {
              select: {
                name: true,
                displayName: true,
                description: true
              }
            }
          }
        }
      }
    });

    if (!invoice) {
      throw createError('Invoice not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        subtotal: Number(invoice.subtotal),
        discountAmount: Number(invoice.discountAmount),
        taxAmount: Number(invoice.taxAmount),
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        failedAt: invoice.failedAt,
        lineItems: invoice.lineItems,
        plan: invoice.subscription?.plan,
        stripeInvoiceId: invoice.stripeInvoiceId,
        createdAt: invoice.createdAt
      }
    });
  })
);

// Download invoice PDF
router.get('/invoices/:id/pdf',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!invoice) {
      throw createError('Invoice not found', 404);
    }

    if (!invoice.stripeInvoiceId) {
      throw createError('Invoice PDF not available', 404);
    }

    try {
      // Get the invoice PDF URL from Stripe
      const stripeInvoice = await StripeService.retrieveInvoice(invoice.stripeInvoiceId);
      
      if (!stripeInvoice.invoice_pdf) {
        throw createError('Invoice PDF not available', 404);
      }

      // Redirect to Stripe's PDF URL
      res.redirect(stripeInvoice.invoice_pdf);
    } catch (error) {
      logger.error(`Error retrieving invoice PDF: ${invoice.stripeInvoiceId}`, error);
      throw createError('Error retrieving invoice PDF', 500);
    }
  })
);

// Get payment history
router.get('/payments',
  authenticateUser,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('status').optional().isIn(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED'])
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          subscription: {
            include: {
              plan: {
                select: {
                  name: true,
                  displayName: true
                }
              }
            }
          }
        }
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      status: 'success',
      data: {
        payments: payments.map(payment => ({
          id: payment.id,
          amount: Number(payment.amount),
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          last4: payment.last4,
          cardBrand: payment.cardBrand,
          processedAt: payment.processedAt,
          failedAt: payment.failedAt,
          failureMessage: payment.failureMessage,
          refundedAt: payment.refundedAt,
          refundAmount: payment.refundAmount ? Number(payment.refundAmount) : null,
          plan: payment.subscription?.plan,
          createdAt: payment.createdAt
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

// Get/Add payment methods
router.get('/payment-methods',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const paymentMethods = await prisma.paymentMethodInfo.findMany({
      where: {
        userId,
        isActive: true
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      status: 'success',
      data: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        cardBrand: pm.cardBrand,
        cardLast4: pm.cardLast4,
        cardExpMonth: pm.cardExpMonth,
        cardExpYear: pm.cardExpYear,
        isDefault: pm.isDefault,
        billingDetails: pm.billingDetails,
        createdAt: pm.createdAt
      }))
    });
  })
);

// Create setup intent for adding payment method
router.post('/payment-methods/setup-intent',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    try {
      // Create or get Stripe customer
      const customer = await StripeService.createCustomer(userId, userEmail);

      // Create setup intent
      const setupIntent = await StripeService.createSetupIntent(customer.id);

      res.json({
        status: 'success',
        data: {
          clientSecret: setupIntent.client_secret,
          customerId: customer.id
        },
        message: 'Setup intent created successfully'
      });
    } catch (error) {
      logger.error('Error creating setup intent:', error);
      throw createError('Error creating setup intent', 500);
    }
  })
);

// Confirm payment method setup
router.post('/payment-methods/confirm',
  authenticateUser,
  [
    body('paymentMethodId').notEmpty().isString(),
    body('isDefault').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const userId = req.user!.id;
    const { paymentMethodId, isDefault = false } = req.body;

    try {
      // Retrieve payment method from Stripe
      const paymentMethod = await StripeService.stripe.paymentMethods.retrieve(paymentMethodId);

      if (!paymentMethod.customer) {
        throw createError('Payment method not attached to customer', 400);
      }

      // If setting as default, update other payment methods
      if (isDefault) {
        await prisma.paymentMethodInfo.updateMany({
          where: {
            userId,
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      // Save payment method info
      const paymentMethodInfo = await prisma.paymentMethodInfo.create({
        data: {
          userId,
          stripePaymentMethodId: paymentMethod.id,
          stripeCustomerId: paymentMethod.customer as string,
          type: paymentMethod.type,
          cardBrand: paymentMethod.card?.brand,
          cardLast4: paymentMethod.card?.last4,
          cardExpMonth: paymentMethod.card?.exp_month,
          cardExpYear: paymentMethod.card?.exp_year,
          isDefault,
          billingDetails: paymentMethod.billing_details as any
        }
      });

      logger.info(`Added payment method: ${paymentMethod.id} for user: ${userId}`);

      res.json({
        status: 'success',
        data: {
          id: paymentMethodInfo.id,
          type: paymentMethodInfo.type,
          cardBrand: paymentMethodInfo.cardBrand,
          cardLast4: paymentMethodInfo.cardLast4,
          cardExpMonth: paymentMethodInfo.cardExpMonth,
          cardExpYear: paymentMethodInfo.cardExpYear,
          isDefault: paymentMethodInfo.isDefault
        },
        message: 'Payment method added successfully'
      });
    } catch (error) {
      logger.error('Error confirming payment method:', error);
      throw createError('Error adding payment method', 500);
    }
  })
);

// Set default payment method
router.put('/payment-methods/:id/default',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const paymentMethod = await prisma.paymentMethodInfo.findFirst({
      where: {
        id,
        userId,
        isActive: true
      }
    });

    if (!paymentMethod) {
      throw createError('Payment method not found', 404);
    }

    // Update all payment methods to not be default
    await prisma.paymentMethodInfo.updateMany({
      where: {
        userId,
        isDefault: true
      },
      data: { isDefault: false }
    });

    // Set the selected one as default
    await prisma.paymentMethodInfo.update({
      where: { id },
      data: { isDefault: true }
    });

    logger.info(`Set default payment method: ${id} for user: ${userId}`);

    res.json({
      status: 'success',
      message: 'Default payment method updated successfully'
    });
  })
);

// Delete payment method
router.delete('/payment-methods/:id',
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const paymentMethod = await prisma.paymentMethodInfo.findFirst({
      where: {
        id,
        userId,
        isActive: true
      }
    });

    if (!paymentMethod) {
      throw createError('Payment method not found', 404);
    }

    try {
      // Detach from Stripe
      await StripeService.stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);

      // Mark as inactive in database
      await prisma.paymentMethodInfo.update({
        where: { id },
        data: { isActive: false }
      });

      logger.info(`Deleted payment method: ${id} for user: ${userId}`);

      res.json({
        status: 'success',
        message: 'Payment method deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting payment method:', error);
      throw createError('Error deleting payment method', 500);
    }
  })
);

// Apply promo code
router.post('/promo-codes/apply',
  authenticateUser,
  [
    body('code').notEmpty().isString().trim(),
    body('subscriptionId').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const userId = req.user!.id;
    const { code, subscriptionId } = req.body;

    // Find promo code
    const promoCode = await prisma.promoCode.findUnique({
      where: {
        code,
        isActive: true,
        validFrom: { lte: new Date() }
      }
    });

    if (!promoCode || (promoCode.validUntil && promoCode.validUntil < new Date())) {
      throw createError('Invalid or expired promo code', 400);
    }

    if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
      throw createError('Promo code usage limit exceeded', 400);
    }

    // Check if user already used this promo code
    const existingUsage = await prisma.promoCodeUsage.findUnique({
      where: {
        promoCodeId_userId: {
          promoCodeId: promoCode.id,
          userId
        }
      }
    });

    if (existingUsage) {
      throw createError('Promo code already used by this user', 400);
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (subscriptionId) {
      const subscription = await prisma.userSubscription.findFirst({
        where: {
          id: subscriptionId,
          userId
        }
      });

      if (!subscription) {
        throw createError('Subscription not found', 404);
      }

      const price = Number(subscription.currentPrice);
      if (promoCode.discountType === 'PERCENTAGE') {
        discountAmount = (price * Number(promoCode.discountValue)) / 100;
      } else {
        discountAmount = Number(promoCode.discountValue);
      }

      if (promoCode.maxDiscountAmount && discountAmount > Number(promoCode.maxDiscountAmount)) {
        discountAmount = Number(promoCode.maxDiscountAmount);
      }
    }

    res.json({
      status: 'success',
      data: {
        code: promoCode.code,
        name: promoCode.name,
        description: promoCode.description,
        discountType: promoCode.discountType,
        discountValue: Number(promoCode.discountValue),
        discountAmount,
        validUntil: promoCode.validUntil
      },
      message: 'Promo code is valid and can be applied'
    });
  })
);

export default router;