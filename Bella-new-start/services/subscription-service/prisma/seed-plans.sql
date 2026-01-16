-- Seed Subscription Plans
-- Run this SQL directly in the database if TypeScript seed doesn't work

-- First, create Stripe prices (you'll need to do this via Stripe API or Dashboard)
-- For now, we'll create plans without Stripe price IDs - you can add them later

-- Premium Plan
INSERT INTO subscription_plans (
  id,
  name,
  display_name,
  description,
  monthly_price,
  yearly_price,
  yearly_discount,
  features,
  limits,
  is_active,
  sort_order,
  apple_product_id_monthly,
  apple_product_id_yearly,
  created_at,
  updated_at
) VALUES (
  'premium_plan_001',
  'premium',
  'Premium Plan',
  'Access to all premium features including advanced filters, unlimited likes, and priority support',
  29.99,
  139.99,
  44,
  '["Unlimited likes", "Advanced filters", "See who liked you", "Priority support", "Ad-free experience"]'::jsonb,
  '{"matches_per_day": -1, "messages_per_day": -1}'::jsonb,
  true,
  1,
  'com.belle.premium.monthly',
  'com.belle.premium.yearly',
  NOW(),
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Note: You'll need to create Stripe prices separately and update the stripe_price_id_monthly and stripe_price_id_yearly fields
-- You can do this via the admin API endpoint or Stripe Dashboard
