import { API_BASE_URL, API_ENDPOINTS, getAuthToken } from 'config/api';
import { Invoice, PaymentMethod, SubscriptionPlan, UserSubscription } from 'types/billing';

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Generic API request function
async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Subscription Plans API (public - no auth required)
export const plansApi = {
  getAll: async (): Promise<SubscriptionPlan[]> => {
    // Plans endpoint is public, so we can call it without auth
    try {
      const response = await fetch(API_ENDPOINTS.PLANS);
      if (!response.ok) {
        throw new Error(`Failed to fetch plans: ${response.status}`);
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(
          `Cannot connect to backend server at ${API_BASE_URL}. Please check that the subscription service is running.`
        );
      }
      throw error;
    }
  },

  getById: async (id: string): Promise<SubscriptionPlan> => {
    const response = await fetch(API_ENDPOINTS.PLAN_BY_ID(id));
    if (!response.ok) {
      throw new Error(`Failed to fetch plan: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  },
};

// Subscriptions API (requires authentication)
export const subscriptionsApi = {
  getCurrent: async (): Promise<UserSubscription | null> => {
    const token = getAuthToken();
    if (!token) {
      // Not authenticated, return null gracefully
      return null;
    }

    try {
      const response = await apiRequest<{
        id: string;
        planId: string;
        plan: SubscriptionPlan;
        status: string;
        billingCycle: string;
        currentPrice: number;
        currency: string;
        currentPeriodStart: string;
        currentPeriodEnd: string;
        cancelAt?: string;
        isTrialActive: boolean;
        trialEnd?: string;
        autoRenew: boolean;
        createdAt: string;
      }>(API_ENDPOINTS.SUBSCRIPTION_CURRENT);

      if (!response.data) {
        return null;
      }

      // Transform the response to match our UserSubscription type
      return {
        id: response.data.id,
        userId: '', // Will be set from auth context
        planId: response.data.planId,
        plan: response.data.plan,
        status: response.data.status as UserSubscription['status'],
        billingCycle: response.data.billingCycle as UserSubscription['billingCycle'],
        currentPrice: response.data.currentPrice,
        currency: response.data.currency,
        startedAt: response.data.createdAt,
        currentPeriodStart: response.data.currentPeriodStart,
        currentPeriodEnd: response.data.currentPeriodEnd,
        cancelAt: response.data.cancelAt,
        isTrialActive: response.data.isTrialActive,
        trialEnd: response.data.trialEnd,
        autoRenew: response.data.autoRenew,
      };
    } catch (error) {
      // If 401/403, user is not authenticated - return null gracefully
      if (
        error instanceof Error &&
        (error.message.includes('401') || error.message.includes('403'))
      ) {
        return null;
      }
      // If 404 or no subscription, return null
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  },

  create: async (planId: string, billingCycle: string, paymentMethodId?: string) => {
    const response = await apiRequest(API_ENDPOINTS.SUBSCRIPTION_CREATE, {
      method: 'POST',
      body: JSON.stringify({
        planId,
        billingCycle,
        paymentMethodId,
      }),
    });
    return response.data;
  },

  changePlan: async (newPlanId: string, billingCycle: string) => {
    const response = await apiRequest(API_ENDPOINTS.SUBSCRIPTION_CHANGE_PLAN, {
      method: 'PUT',
      body: JSON.stringify({
        newPlanId,
        billingCycle,
      }),
    });
    return response.data;
  },

  cancel: async (reason?: string) => {
    const response = await apiRequest(API_ENDPOINTS.SUBSCRIPTION_CANCEL, {
      method: 'POST',
      body: JSON.stringify({
        cancellationReason: reason,
      }),
    });
    return response.data;
  },

  reactivate: async () => {
    const response = await apiRequest(API_ENDPOINTS.SUBSCRIPTION_REACTIVATE, {
      method: 'POST',
    });
    return response.data;
  },
};

// Billing API (requires authentication)
export const billingApi = {
  getInvoices: async (
    page = 1,
    limit = 10,
    status?: string
  ): Promise<PaginatedResponse<Invoice>> => {
    const token = getAuthToken();
    if (!token) {
      // Not authenticated, return empty result
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0,
        },
      };
    }

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
    });

    const response = await apiRequest<{ invoices: Invoice[]; pagination: any }>(
      `${API_ENDPOINTS.INVOICES}?${params.toString()}`
    );

    // Transform invoices to match our Invoice type
    const transformedInvoices = response.data.invoices.map((invoice: any) => ({
      id: invoice.id,
      subscriptionId: invoice.subscriptionId || '',
      userId: '', // Will be set from auth context
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      attemptedAt: invoice.attemptedAt,
      failedAt: invoice.failedAt,
      lineItems: Array.isArray(invoice.lineItems)
        ? invoice.lineItems
        : [
            {
              description: invoice.plan?.displayName || 'Subscription',
              amount: invoice.totalAmount,
              quantity: 1,
            },
          ],
    }));

    return {
      data: transformedInvoices,
      pagination: response.data.pagination,
    };
  },

  getInvoiceById: async (id: string): Promise<Invoice> => {
    const response = await apiRequest<Invoice>(API_ENDPOINTS.INVOICE_BY_ID(id));
    return response.data;
  },

  downloadInvoicePDF: (id: string): string => {
    return API_ENDPOINTS.INVOICE_PDF(id);
  },

  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    const token = getAuthToken();
    if (!token) {
      // Not authenticated, return empty array
      return [];
    }

    try {
      const response = await apiRequest<PaymentMethod[]>(API_ENDPOINTS.PAYMENT_METHODS);
      return response.data.map((pm: any) => ({
        id: pm.id,
        userId: '', // Will be set from auth context
        type: pm.type,
        cardBrand: pm.cardBrand,
        cardLast4: pm.cardLast4,
        cardExpMonth: pm.cardExpMonth,
        cardExpYear: pm.cardExpYear,
        isDefault: pm.isDefault,
        isActive: true,
        billingDetails: pm.billingDetails,
      }));
    } catch (error) {
      // If 401/403, user is not authenticated - return empty array
      if (
        error instanceof Error &&
        (error.message.includes('401') || error.message.includes('403'))
      ) {
        return [];
      }
      throw error;
    }
  },

  setDefaultPaymentMethod: async (id: string) => {
    const response = await apiRequest(API_ENDPOINTS.PAYMENT_METHOD_SET_DEFAULT(id), {
      method: 'PUT',
    });
    return response.data;
  },

  deletePaymentMethod: async (id: string) => {
    const response = await apiRequest(API_ENDPOINTS.PAYMENT_METHOD_DELETE(id), {
      method: 'DELETE',
    });
    return response.data;
  },
};
