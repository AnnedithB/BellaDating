# Subscription Service API Tests

Base URL: `http://localhost:3010`

## Typical Flow

1. **Admin** creates plans and promo codes
2. **User** views available plans (no auth)
3. **User** creates subscription (requires login + Stripe payment)
4. **User** manages subscription (cancel, upgrade, etc.)
5. **Admin** monitors analytics and manages all users

---

## 1. Plans (Public - No Auth Required)

```http
GET /api/subscription-plans
GET /api/subscription-plans/:planId
```

---

## 2. Subscriptions (User - Auth Required)

```http
GET  /api/subscriptions/current
POST /api/subscriptions/create
PUT  /api/subscriptions/change-plan
POST /api/subscriptions/cancel
POST /api/subscriptions/reactivate
GET  /api/subscriptions/history
```

**Create Subscription Example:**
```json
POST /api/subscriptions/create
Authorization: Bearer <user_token>

{
  "planId": "plan_id",
  "billingCycle": "MONTHLY",
  "paymentMethodId": "pm_xxx",
  "promoCode": "SAVE20"
}
```

---

## 3. Billing (User - Auth Required)

```http
GET    /api/billing/payment-methods
POST   /api/billing/payment-methods
PUT    /api/billing/payment-methods/:id/default
DELETE /api/billing/payment-methods/:id
GET    /api/billing/invoices
GET    /api/billing/invoices/:id
GET    /api/billing/payments
POST   /api/billing/promo-code
```

---

## 4. Plan Management (Admin Only)

```http
POST   /api/subscription-plans
PUT    /api/subscription-plans/:id
DELETE /api/subscription-plans/:id
GET    /api/subscription-plans/:id/analytics
```

**Create Plan Example:**
```json
POST /api/subscription-plans
Authorization: Bearer <admin_token>

{
  "name": "premium",
  "displayName": "Premium Plan",
  "monthlyPrice": 29.99,
  "yearlyPrice": 299.99,
  "features": ["unlimited_matches", "video_calls"],
  "limits": {"matches_per_day": -1}
}
```

---

## 5. User Management (Admin Only)

```http
GET  /api/admin/users
GET  /api/admin/users/:userId/subscription
PUT  /api/admin/users/:userId/subscription
POST /api/admin/users/:userId/subscription/cancel
POST /api/admin/users/:userId/subscription/reactivate
POST /api/admin/payments/:paymentId/refund
```

---

## 6. Promo Codes (Admin Only)

```http
POST /api/admin/promo-codes
GET  /api/admin/promo-codes
```

**Create Promo Example:**
```json
POST /api/admin/promo-codes
Authorization: Bearer <admin_token>

{
  "code": "SUMMER2024",
  "name": "Summer Sale",
  "discountType": "PERCENTAGE",
  "discountValue": 20,
  "validFrom": "2024-06-01",
  "validUntil": "2024-08-31",
  "maxUses": 100
}
```

---

## 7. Analytics (Admin Only)

```http
GET /api/analytics/dashboard
GET /api/analytics/revenue?period=30d&granularity=day
GET /api/analytics/subscriptions?period=30d
GET /api/analytics/customers?period=30d&cohort=true
```

---

## Quick Test

```powershell
# 1. Login as user
$login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body (@{email="user@test.com"; password="password"} | ConvertTo-Json) -ContentType "application/json"
$token = $login.data.token

# 2. View plans (no auth)
Invoke-RestMethod -Uri "http://localhost:3010/api/subscription-plans"

# 3. Create subscription
Invoke-RestMethod -Uri "http://localhost:3010/api/subscriptions/create" -Method POST -Headers @{Authorization="Bearer $token"} -Body (@{planId="plan_id"; billingCycle="MONTHLY"} | ConvertTo-Json) -ContentType "application/json"

# 4. Check subscription
Invoke-RestMethod -Uri "http://localhost:3010/api/subscriptions/current" -Headers @{Authorization="Bearer $token"}
```
