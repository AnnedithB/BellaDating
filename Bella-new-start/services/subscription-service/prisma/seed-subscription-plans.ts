import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();

// Initialize Stripe if secret key is available
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
}

async function seedSubscriptionPlans() {
  console.log('🌱 Seeding subscription plans...');

  try {
    // Check if plans already exist
    const existingPlans = await prisma.subscriptionPlan.findMany();
    if (existingPlans.length > 0) {
      console.log(`✅ ${existingPlans.length} plans already exist. Skipping seed.`);
      return;
    }

    // Premium Plans - Web Pricing (for bella-billing.vercel.app)
    let premiumMonthlyWebPriceId: string | null = null;
    let premiumSixMonthWebPriceId: string | null = null;

    // Premium Plans - Apple Pay Pricing (for mobile app)
    let premiumMonthlyApplePriceId: string | null = null;
    let premiumSixMonthApplePriceId: string | null = null;

    if (stripe) {
      try {
        // Create Stripe prices for Web Pricing
        const premiumMonthlyWebPrice = await stripe.prices.create({
          unit_amount: 1999, // $19.99/month (web pricing)
          currency: 'usd',
          recurring: { interval: 'month' },
          product_data: {
            name: 'Premium Plan - Monthly (Web)',
          },
        });
        premiumMonthlyWebPriceId = premiumMonthlyWebPrice.id;

        const premiumSixMonthWebPrice = await stripe.prices.create({
          unit_amount: 9999, // $99.99 for 6 months (web pricing)
          currency: 'usd',
          recurring: { interval: 'month', interval_count: 6 },
          product_data: {
            name: 'Premium Plan - 6 Months (Web)',
          },
        });
        premiumSixMonthWebPriceId = premiumSixMonthWebPrice.id;

        // Create Stripe prices for Apple Pay Pricing
        const premiumMonthlyApplePrice = await stripe.prices.create({
          unit_amount: 2999, // $29.99/month (Apple Pay pricing)
          currency: 'usd',
          recurring: { interval: 'month' },
          product_data: {
            name: 'Premium Plan - Monthly (Apple Pay)',
          },
        });
        premiumMonthlyApplePriceId = premiumMonthlyApplePrice.id;

        const premiumSixMonthApplePrice = await stripe.prices.create({
          unit_amount: 13999, // $139.99 for 6 months (Apple Pay pricing)
          currency: 'usd',
          recurring: { interval: 'month', interval_count: 6 },
          product_data: {
            name: 'Premium Plan - 6 Months (Apple Pay)',
          },
        });
        premiumSixMonthApplePriceId = premiumSixMonthApplePrice.id;
      } catch (stripeError) {
        console.warn('⚠️  Could not create Stripe prices:', stripeError);
      }
    }

    // ===== WEB PRICING PLANS (for bella-billing.vercel.app) =====
    
    // Create Premium Monthly Plan - Web ($19.99/month)
    const premiumMonthlyWebPlan = await prisma.subscriptionPlan.create({
      data: {
        name: 'premium_monthly_web',
        displayName: 'Monthly Plan',
        description: 'Access to all premium features including advanced filters, unlimited likes, and priority support',
        monthlyPrice: 19.99, // Web pricing
        yearlyPrice: 99.99, // 6-month price (for comparison)
        yearlyDiscount: 17, // ~17% savings for 6-month plan
        features: [
          'Unlimited likes',
          'Advanced filters',
          'See who liked you',
          'Priority support',
          'Ad-free experience',
        ],
        limits: {
          matches_per_day: -1, // Unlimited
          messages_per_day: -1, // Unlimited
        },
        isActive: true,
        sortOrder: 1,
        stripePriceIdMonthly: premiumMonthlyWebPriceId,
        stripePriceIdYearly: premiumSixMonthWebPriceId,
        appleProductIdMonthly: 'com.belle.premium.monthly',
        appleProductIdYearly: 'com.belle.premium.yearly',
      },
    });

    console.log(`✅ Created Premium Monthly Plan (Web): ${premiumMonthlyWebPlan.id}`);

    // Create Premium 6-Month Plan - Web ($99.99 for 6 months)
    const premiumSixMonthWebPlan = await prisma.subscriptionPlan.create({
      data: {
        name: 'premium_6months_web',
        displayName: '6 Months Plan',
        description: 'Access to all premium features including advanced filters, unlimited likes, and priority support',
        monthlyPrice: 19.99, // Equivalent monthly price for comparison
        yearlyPrice: 99.99, // 6-month price (web pricing)
        yearlyDiscount: 17, // ~17% savings compared to monthly
        features: [
          'Unlimited likes',
          'Advanced filters',
          'See who liked you',
          'Priority support',
          'Ad-free experience',
        ],
        limits: {
          matches_per_day: -1, // Unlimited
          messages_per_day: -1, // Unlimited
        },
        isActive: true,
        sortOrder: 2,
        stripePriceIdMonthly: premiumSixMonthWebPriceId,
        stripePriceIdYearly: premiumSixMonthWebPriceId,
        appleProductIdMonthly: 'com.belle.premium.monthly',
        appleProductIdYearly: 'com.belle.premium.yearly',
      },
    });

    console.log(`✅ Created Premium 6-Month Plan (Web): ${premiumSixMonthWebPlan.id}`);

    // ===== APPLE PAY PRICING PLANS (for mobile app) =====

    // Create Premium Monthly Plan - Apple Pay ($29.99/month)
    const premiumMonthlyApplePlan = await prisma.subscriptionPlan.create({
      data: {
        name: 'premium_monthly_apple',
        displayName: 'Monthly Plan',
        description: 'Access to all premium features including advanced filters, unlimited likes, and priority support',
        monthlyPrice: 29.99, // Apple Pay pricing
        yearlyPrice: 139.99, // 6-month price (for comparison)
        yearlyDiscount: 22, // ~22% savings for 6-month plan
        features: [
          'Unlimited likes',
          'Advanced filters',
          'See who liked you',
          'Priority support',
          'Ad-free experience',
        ],
        limits: {
          matches_per_day: -1, // Unlimited
          messages_per_day: -1, // Unlimited
        },
        isActive: true,
        sortOrder: 3,
        stripePriceIdMonthly: premiumMonthlyApplePriceId,
        stripePriceIdYearly: premiumSixMonthApplePriceId,
        appleProductIdMonthly: 'com.belle.premium.monthly',
        appleProductIdYearly: 'com.belle.premium.yearly',
      },
    });

    console.log(`✅ Created Premium Monthly Plan (Apple Pay): ${premiumMonthlyApplePlan.id}`);

    // Create Premium 6-Month Plan - Apple Pay ($139.99 for 6 months)
    const premiumSixMonthApplePlan = await prisma.subscriptionPlan.create({
      data: {
        name: 'premium_6months_apple',
        displayName: '6 Months Plan',
        description: 'Access to all premium features including advanced filters, unlimited likes, and priority support',
        monthlyPrice: 29.99, // Equivalent monthly price for comparison
        yearlyPrice: 139.99, // 6-month price (Apple Pay pricing)
        yearlyDiscount: 22, // ~22% savings compared to monthly
        features: [
          'Unlimited likes',
          'Advanced filters',
          'See who liked you',
          'Priority support',
          'Ad-free experience',
        ],
        limits: {
          matches_per_day: -1, // Unlimited
          messages_per_day: -1, // Unlimited
        },
        isActive: true,
        sortOrder: 4,
        stripePriceIdMonthly: premiumSixMonthApplePriceId,
        stripePriceIdYearly: premiumSixMonthApplePriceId,
        appleProductIdMonthly: 'com.belle.premium.monthly',
        appleProductIdYearly: 'com.belle.premium.yearly',
      },
    });

    console.log(`✅ Created Premium 6-Month Plan (Apple Pay): ${premiumSixMonthApplePlan.id}`);

    console.log('✅ Subscription plans seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding subscription plans:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed
seedSubscriptionPlans()
  .then(() => {
    console.log('✅ Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
