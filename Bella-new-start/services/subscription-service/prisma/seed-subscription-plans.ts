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

    // Premium Plan
    let premiumMonthlyPriceId: string | null = null;
    let premiumYearlyPriceId: string | null = null;

    if (stripe) {
      try {
        // Create Stripe prices for Premium Monthly
        const premiumMonthlyPrice = await stripe.prices.create({
          unit_amount: 2999, // $29.99
          currency: 'usd',
          recurring: { interval: 'month' },
          product_data: {
            name: 'Premium Plan - Monthly',
          },
        });
        premiumMonthlyPriceId = premiumMonthlyPrice.id;

        // Create Stripe prices for Premium Yearly
        const premiumYearlyPrice = await stripe.prices.create({
          unit_amount: 13999, // $139.99 (6 months)
          currency: 'usd',
          recurring: { interval: 'year' },
          product_data: {
            name: 'Premium Plan - Yearly',
          },
        });
        premiumYearlyPriceId = premiumYearlyPrice.id;
      } catch (stripeError) {
        console.warn('⚠️  Could not create Stripe prices:', stripeError);
      }
    }

    // Create Premium Plan
    const premiumPlan = await prisma.subscriptionPlan.create({
      data: {
        name: 'premium',
        displayName: 'Premium Plan',
        description: 'Access to all premium features including advanced filters, unlimited likes, and priority support',
        monthlyPrice: 29.99,
        yearlyPrice: 139.99,
        yearlyDiscount: 44, // ~44% savings
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
        stripePriceIdMonthly: premiumMonthlyPriceId,
        stripePriceIdYearly: premiumYearlyPriceId,
        appleProductIdMonthly: 'com.belle.premium.monthly',
        appleProductIdYearly: 'com.belle.premium.yearly',
      },
    });

    console.log(`✅ Created Premium Plan: ${premiumPlan.id}`);

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
