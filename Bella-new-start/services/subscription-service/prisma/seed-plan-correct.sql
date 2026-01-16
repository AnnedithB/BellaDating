-- Correct SQL with actual column names from database
INSERT INTO subscription_plans (
  id, name, "displayName", description,
  "monthlyPrice", "yearlyPrice", "yearlyDiscount",
  features, limits, "isActive", "sortOrder",
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
