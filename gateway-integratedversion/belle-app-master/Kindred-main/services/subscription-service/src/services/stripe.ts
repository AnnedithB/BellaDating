import Stripe from 'stripe';
import { logger } from '../utils/logger';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-09-30.acacia',
  typescript: true,
});

export class StripeService {
  /**
   * Create or retrieve a Stripe customer
   */
  static async createCustomer(userId: string, email: string, name?: string): Promise<Stripe.Customer> {
    try {
      // Check if customer already exists
      const existingCustomers = await stripe.customers.list({
        email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email,
        name: name || email,
        metadata: {
          userId
        }
      });

      logger.info(`Created Stripe customer: ${customer.id} for user: ${userId}`);
      return customer;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create a subscription
   */
  static async createSubscription(
    customerId: string,
    priceId: string,
    options: {
      trialPeriodDays?: number;
      promotionCode?: string;
      paymentMethodId?: string;
    } = {}
  ): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      };

      if (options.trialPeriodDays) {
        subscriptionData.trial_period_days = options.trialPeriodDays;
      }

      if (options.promotionCode) {
        subscriptionData.promotion_code = options.promotionCode;
      }

      if (options.paymentMethodId) {
        subscriptionData.default_payment_method = options.paymentMethodId;
      }

      const subscription = await stripe.subscriptions.create(subscriptionData);
      
      logger.info(`Created Stripe subscription: ${subscription.id}`);
      return subscription;
    } catch (error) {
      logger.error('Error creating Stripe subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription
   */
  static async updateSubscription(
    subscriptionId: string, 
    updates: Stripe.SubscriptionUpdateParams
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, updates);
      logger.info(`Updated Stripe subscription: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      logger.error('Error updating Stripe subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = immediately 
        ? await stripe.subscriptions.cancel(subscriptionId)
        : await stripe.subscriptions.update(subscriptionId, { 
            cancel_at_period_end: true 
          });
      
      logger.info(`Canceled Stripe subscription: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      logger.error('Error canceling Stripe subscription:', error);
      throw error;
    }
  }

  /**
   * Create payment method
   */
  static async createPaymentMethod(
    customerId: string,
    paymentMethodData: Stripe.PaymentMethodCreateParams
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await stripe.paymentMethods.create(paymentMethodData);
      
      // Attach to customer
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customerId
      });

      logger.info(`Created payment method: ${paymentMethod.id}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Error creating payment method:', error);
      throw error;
    }
  }

  /**
   * Create setup intent for payment method
   */
  static async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session'
      });

      return setupIntent;
    } catch (error) {
      logger.error('Error creating setup intent:', error);
      throw error;
    }
  }

  /**
   * Retrieve invoice
   */
  static async retrieveInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      return invoice;
    } catch (error) {
      logger.error('Error retrieving invoice:', error);
      throw error;
    }
  }

  /**
   * Create coupon for promotional codes
   */
  static async createCoupon(
    couponData: Stripe.CouponCreateParams
  ): Promise<Stripe.Coupon> {
    try {
      const coupon = await stripe.coupons.create(couponData);
      logger.info(`Created Stripe coupon: ${coupon.id}`);
      return coupon;
    } catch (error) {
      logger.error('Error creating coupon:', error);
      throw error;
    }
  }

  /**
   * Refund payment
   */
  static async refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    try {
      const refundData: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId
      };

      if (amount) {
        refundData.amount = amount;
      }

      if (reason) {
        refundData.reason = reason as Stripe.RefundCreateParams.Reason;
      }

      const refund = await stripe.refunds.create(refundData);
      logger.info(`Created refund: ${refund.id}`);
      return refund;
    } catch (error) {
      logger.error('Error creating refund:', error);
      throw error;
    }
  }

  /**
   * Get customer's payment methods
   */
  static async getCustomerPaymentMethods(
    customerId: string
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      return paymentMethods.data;
    } catch (error) {
      logger.error('Error retrieving payment methods:', error);
      throw error;
    }
  }
}