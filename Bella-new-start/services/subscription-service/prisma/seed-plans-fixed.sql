-- Fixed Seed Subscription Plans
-- Prisma uses camelCase in code but converts to database naming
-- Check actual column names first with: \d subscription_plans

-- Option 1: If columns use camelCase (quoted identifiers)
INSERT INTO subscription_plans (
  id, name, "displayName", description,
  "monthlyPrice", "yearlyPrice", "yearlyDiscount",
  features, limits, "isActive", "sortOrder",
  "appleProductIdMonthly", "appleProductIdYearly",
  "createdAt", "updatedAt"
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

-- Option 2: If columns use snake_case (unquoted)
-- Uncomment and use this if Option 1 doesn't work:
/*
INSERT INTO subscription_plans (
  id, name, display_name, description,
  monthly_price, yearly_price, yearly_discount,
  features, limits, is_active, sort_order,
  apple_product_id_monthly, apple_product_id_yearly,
  created_at, updated_at
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
*/
