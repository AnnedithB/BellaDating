import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role?: string;
  };
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
}

export interface SessionQuery extends PaginationQuery, DateRangeQuery {
  userId?: string;
  type?: string;
  status?: string;
}

export interface MessageQuery extends PaginationQuery {
  sessionId: string;
  messageType?: string;
}

export interface ReportQuery extends PaginationQuery, DateRangeQuery {
  status?: string;
  reportType?: string;
  severity?: string;
}

export interface AnalyticsQuery extends DateRangeQuery {
  granularity?: 'hour' | 'day' | 'week' | 'month';
}