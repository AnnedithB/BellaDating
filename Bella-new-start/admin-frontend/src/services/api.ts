// API Service for Admin Panel
// Connects to Admin Service (port 3009) and Analytics Service (port 3008)

// Helper function to get base URLs - handles both build-time and runtime
function getBaseUrls() {
  // Check if we're in production on Vercel (not localhost)
  const isVercelProduction =
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    !window.location.hostname.includes('127.0.0.1') &&
    (window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('vercel.com'));

  // Always use relative URLs in production on Vercel to avoid mixed content errors
  // Vercel will proxy these via vercel.json
  if (isVercelProduction) {
    // Debug log (remove after confirming it works)
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel')) {
      console.log('[API Config] Using Vercel proxy mode - relative URLs');
    }
    return {
      admin: '',
      analytics: '/analytics',
    };
  }

  // Use environment variables or defaults for development
  const envAdminUrl = import.meta.env.VITE_ADMIN_SERVICE_URL;
  const envAnalyticsUrl = import.meta.env.VITE_ANALYTICS_SERVICE_URL;

  // Debug log for development
  if (import.meta.env.DEV) {
    console.log('[API Config] Using direct URLs:', {
      admin: envAdminUrl || 'http://localhost:3009',
      analytics: envAnalyticsUrl || 'http://localhost:3008',
    });
  }

  return {
    admin: envAdminUrl || 'http://localhost:3009',
    analytics: envAnalyticsUrl || 'http://localhost:3008',
  };
}

// Get base URLs - will be evaluated at runtime, not build time
const getAdminServiceUrl = () => getBaseUrls().admin;
const getAnalyticsServiceUrl = () => getBaseUrls().analytics;

// Token management
export const tokenStorage = {
  getToken: (): string | null => {
    return localStorage.getItem('admin_token');
  },
  setToken: (token: string): void => {
    localStorage.setItem('admin_token', token);
  },
  removeToken: (): void => {
    localStorage.removeItem('admin_token');
  },
};

// API request helper
async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T | null> {
  const token = tokenStorage.getToken();

  // Log URL in production to help debug (temporary)
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    console.log('[API Request] URL:', url);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        tokenStorage.removeToken();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/')) {
          window.location.href = '/auth/login';
        }
        throw new Error('Unauthorized - please login again');
      }

      // Handle 404 - for /me endpoint, return null
      if (response.status === 404 && url.includes('/api/auth/me')) {
        return null;
      }

      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      const errorMessage = error.message || `HTTP error! status: ${response.status}`;

      // Log the full URL and error details for debugging
      console.error('[API Error]', {
        url,
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        errorDetails: error,
      });

      // Provide more helpful error messages
      if (response.status === 500) {
        throw new Error(
          `Backend server error (500). This usually means:\n` +
            `1. Vercel proxy cannot reach your EC2 backend\n` +
            `2. Backend service is not running\n` +
            `3. EC2 Security Group is blocking Vercel's servers\n` +
            `Check: ${url}`,
        );
      }

      if (response.status === 404) {
        throw new Error(
          `Endpoint not found (404): ${url}\n` +
            `This might mean the route doesn't exist or the proxy rewrite isn't working correctly.`,
        );
      }

      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    // Handle abort (timeout)
    if (error.name === 'AbortError') {
      throw new Error(
        'Request timeout. Please check if the backend services are running and accessible.',
      );
    }

    // Handle network errors gracefully
    if (
      error.message === 'Failed to fetch' ||
      error.name === 'TypeError' ||
      error.message?.includes('ERR_CONNECTION_TIMED_OUT') ||
      error.message?.includes('ERR_CONNECTION_REFUSED')
    ) {
      throw new Error(
        'Unable to connect to server. Please make sure the backend services are running.',
      );
    }
    throw error;
  }
}

// ========================================
// AUTHENTICATION API
// ========================================
export const authAPI = {
  login: async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; admin: any }>(
      `${getAdminServiceUrl()}/api/auth/login`,
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );
    if (!data) {
      throw new Error('Login failed - no response from server');
    }
    if (data.token) {
      tokenStorage.setToken(data.token);
    }
    return data;
  },

  logout: () => {
    tokenStorage.removeToken();
  },

  getCurrentAdmin: async () => {
    const result = await apiRequest<any>(`${getAdminServiceUrl()}/api/auth/me`);
    if (!result) {
      throw new Error('Admin not found');
    }
    return result;
  },
};

// ========================================
// USERS API
// ========================================
export const usersAPI = {
  getUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);

    return apiRequest<{ users: any[]; pagination: any }>(
      `${getAdminServiceUrl()}/api/users?${queryParams.toString()}`,
    );
  },

  getUser: async (id: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/users/${id}`);
  },

  updateUserStatus: async (id: string, status: string, reason?: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  },

  deleteUser: async (id: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/users/${id}`, {
      method: 'DELETE',
    });
  },
};

// ========================================
// MODERATION API
// ========================================
export const moderationAPI = {
  getReports: async () => {
    return apiRequest<any[]>(`${getAdminServiceUrl()}/api/moderation/reports`);
  },

  getReport: async (id: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/moderation/reports/${id}`);
  },

  assignReport: async (id: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/moderation/reports/${id}/assign`, {
      method: 'PATCH',
    });
  },

  takeAction: async (reportId: string, action: string, reason: string, severity?: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/moderation/reports/${reportId}/action`, {
      method: 'PUT',
      body: JSON.stringify({ action, reason, severity }),
    });
  },

  getActions: async () => {
    return apiRequest<any[]>(`${getAdminServiceUrl()}/api/moderation/actions`);
  },
};

// ========================================
// SUPPORT TICKETS API
// ========================================
export const ticketsAPI = {
  getTickets: async (params?: {
    status?: string;
    priority?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.category) queryParams.append('category', params.category);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return apiRequest<{ data: any[]; meta: any }>(
      `${getAdminServiceUrl()}/api/support-tickets?${queryParams.toString()}`,
    );
  },

  getTicket: async (id: string) => {
    return apiRequest<{ data: any }>(`${getAdminServiceUrl()}/api/support-tickets/${id}`);
  },

  assignTicket: async (id: string, assignedTo?: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/support-tickets/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignedTo, assignToSelf: !assignedTo }),
    });
  },

  addComment: async (id: string, content: string, isInternal: boolean = false) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/support-tickets/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, isInternal }),
    });
  },

  resolveTicket: async (id: string, resolution: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/support-tickets/${id}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ resolution, status: 'RESOLVED' }),
    });
  },

  getMetrics: async () => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/support-tickets/metrics/dashboard`);
  },
};

// ========================================
// KNOWLEDGE BASE API
// ========================================
export const knowledgeBaseAPI = {
  getArticles: async (params?: {
    category?: string;
    published?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.published !== undefined)
      queryParams.append('published', params.published.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return apiRequest<{ data: any[]; meta: any }>(
      `${getAdminServiceUrl()}/api/knowledge-base/articles?${queryParams.toString()}`,
    );
  },

  getArticle: async (id: string) => {
    return apiRequest<{ data: any }>(`${getAdminServiceUrl()}/api/knowledge-base/articles/${id}`);
  },

  createArticle: async (article: {
    title: string;
    content: string;
    summary?: string;
    category: string;
    tags?: string[];
    searchKeywords?: string[];
    isPublished?: boolean;
  }) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/knowledge-base/articles`, {
      method: 'POST',
      body: JSON.stringify(article),
    });
  },

  updateArticle: async (id: string, article: Partial<any>) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/knowledge-base/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(article),
    });
  },

  deleteArticle: async (id: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/knowledge-base/articles/${id}`, {
      method: 'DELETE',
    });
  },

  publishArticle: async (id: string, isPublished: boolean) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/knowledge-base/articles/${id}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublished }),
    });
  },
};

// ========================================
// SETTINGS API
// ========================================
export const settingsAPI = {
  getSettings: async () => {
    return apiRequest<any[]>(`${getAdminServiceUrl()}/api/settings`);
  },

  getSetting: async (key: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/settings/${key}`);
  },

  updateSetting: async (key: string, value: any, description?: string) => {
    return apiRequest<any>(`${getAdminServiceUrl()}/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value, description }),
    });
  },
};

// ========================================
// ANALYTICS API (Admin Service)
// ========================================
export const adminAnalyticsAPI = {
  getDashboard: async (period?: string) => {
    const queryParams = period ? `?period=${period}` : '';
    return apiRequest<any>(`${getAdminServiceUrl()}/api/analytics/dashboard${queryParams}`);
  },
};

// ========================================
// ANALYTICS SERVICE API (Port 3008)
// ========================================
export const analyticsAPI = {
  getOverview: async () => {
    return apiRequest<any>(`${getAnalyticsServiceUrl()}/kpis/overview`);
  },

  getActiveUsers: async (params?: { granularity?: string; range?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.granularity) queryParams.append('granularity', params.granularity);
    if (params?.range) queryParams.append('range', params.range);

    return apiRequest<any>(
      `${getAnalyticsServiceUrl()}/kpis/active-users?${queryParams.toString()}`,
    );
  },

  getRetention: async (params?: { period?: string; cohortCount?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append('period', params.period);
    if (params?.cohortCount) queryParams.append('cohortCount', params.cohortCount.toString());

    return apiRequest<any>(`${getAnalyticsServiceUrl()}/kpis/retention?${queryParams.toString()}`);
  },

  getRevenue: async (params?: { timeframe?: string }) => {
    const queryParams = params?.timeframe ? `?timeframe=${params.timeframe}` : '';
    return apiRequest<any>(`${getAnalyticsServiceUrl()}/kpis/revenue${queryParams}`);
  },

  getUserBehavior: async (params?: { timeframe?: string; eventType?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.timeframe) queryParams.append('timeframe', params.timeframe);
    if (params?.eventType) queryParams.append('eventType', params.eventType);

    return apiRequest<any>(
      `${getAnalyticsServiceUrl()}/kpis/user-behavior?${queryParams.toString()}`,
    );
  },

  getFunnel: async (params?: { timeframe?: string }) => {
    const queryParams = params?.timeframe ? `?timeframe=${params.timeframe}` : '';
    return apiRequest<any>(`${getAnalyticsServiceUrl()}/kpis/funnel${queryParams}`);
  },
};
