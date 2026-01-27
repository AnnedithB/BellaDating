// API Configuration
// Use relative URLs in production on Vercel to avoid mixed content errors
// Vercel will proxy these via vercel.json
function getApiBaseUrl(): string {
  // Check if we're in production on Vercel (not localhost)
  const isVercelProduction =
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    !window.location.hostname.includes('127.0.0.1') &&
    (window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('vercel.com'));

  // Use relative URLs in production on Vercel to avoid mixed content
  if (isVercelProduction) {
    return '';
  }

  // Use environment variable or default for development
  return import.meta.env.VITE_SUBSCRIPTION_SERVICE_URL || 'http://localhost:3006';
}

export const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  // Subscription Plans
  PLANS: `${API_BASE_URL}/api/subscription-plans`,
  PLAN_BY_ID: (id: string) => `${API_BASE_URL}/api/subscription-plans/${id}`,

  // Subscriptions
  SUBSCRIPTION_CURRENT: `${API_BASE_URL}/api/subscriptions/current`,
  SUBSCRIPTION_CREATE: `${API_BASE_URL}/api/subscriptions/create`,
  SUBSCRIPTION_CHANGE_PLAN: `${API_BASE_URL}/api/subscriptions/change-plan`,
  SUBSCRIPTION_CANCEL: `${API_BASE_URL}/api/subscriptions/cancel`,
  SUBSCRIPTION_REACTIVATE: `${API_BASE_URL}/api/subscriptions/reactivate`,
  SUBSCRIPTION_HISTORY: `${API_BASE_URL}/api/subscriptions/history`,

  // Billing
  INVOICES: `${API_BASE_URL}/api/billing/invoices`,
  INVOICE_BY_ID: (id: string) => `${API_BASE_URL}/api/billing/invoices/${id}`,
  INVOICE_PDF: (id: string) => `${API_BASE_URL}/api/billing/invoices/${id}/pdf`,
  PAYMENTS: `${API_BASE_URL}/api/billing/payments`,
  PAYMENT_METHODS: `${API_BASE_URL}/api/billing/payment-methods`,
  PAYMENT_METHOD_SETUP_INTENT: `${API_BASE_URL}/api/billing/payment-methods/setup-intent`,
  PAYMENT_METHOD_SET_DEFAULT: (id: string) =>
    `${API_BASE_URL}/api/billing/payment-methods/${id}/default`,
  PAYMENT_METHOD_DELETE: (id: string) => `${API_BASE_URL}/api/billing/payment-methods/${id}`,
};

// Get auth token from URL parameters, localStorage, or sessionStorage
// This allows the app to redirect with a token in the URL
export const getAuthToken = (): string | null => {
  // First, check URL parameters (for redirects from app)
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl =
    urlParams.get('token') || urlParams.get('access_token') || urlParams.get('authToken');

  if (tokenFromUrl) {
    // Store it for future use
    setAuthToken(tokenFromUrl, false); // Use sessionStorage for security
    // Clean URL by removing token parameter
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('token');
    newUrl.searchParams.delete('access_token');
    newUrl.searchParams.delete('authToken');
    window.history.replaceState({}, '', newUrl.toString());
    return tokenFromUrl;
  }

  // Fallback to stored tokens
  return sessionStorage.getItem('authToken') || localStorage.getItem('authToken') || null;
};

// Set auth token
export const setAuthToken = (token: string, persist = true): void => {
  if (persist) {
    localStorage.setItem('authToken', token);
  } else {
    sessionStorage.setItem('authToken', token);
  }
};

// Remove auth token
export const removeAuthToken = (): void => {
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');
};
