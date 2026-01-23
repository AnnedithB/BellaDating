export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: number;
  features: string[];
  limits: Record<string, number>;
  isActive: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  plan: SubscriptionPlan;
  status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED';
  billingCycle: 'MONTHLY' | 'YEARLY' | 'SIXMONTH';
  currentPrice: number;
  currency: string;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt?: string;
  canceledAt?: string;
  endedAt?: string;
  trialStart?: string;
  trialEnd?: string;
  isTrialActive: boolean;
  autoRenew: boolean;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  userId: string;
  invoiceNumber: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'VOID' | 'REFUNDED';
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt?: string;
  attemptedAt?: string;
  failedAt?: string;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
}

export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  invoiceId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  paymentMethod: string;
  processedAt?: string;
  failureReason?: string;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: 'card' | 'bank_account' | 'apple_pay' | 'google_pay';
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  isDefault: boolean;
  isActive: boolean;
  billingDetails?: {
    name?: string;
    email?: string;
    address?: string;
    city?: string;
    country?: string;
    zipCode?: string;
  };
}
