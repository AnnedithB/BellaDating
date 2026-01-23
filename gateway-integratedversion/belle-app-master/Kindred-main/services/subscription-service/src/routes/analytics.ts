import express, { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticateAdmin, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();

// Dashboard overview metrics
router.get('/dashboard',
  authenticateAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get subscription counts
    const [
      totalSubscriptions,
      activeSubscriptions,
      newSubscriptionsLast30Days,
      canceledSubscriptionsLast30Days,
      totalRevenue,
      monthlyRevenue,
      trialUsers,
      conversionRate
    ] = await Promise.all([
      // Total subscriptions
      prisma.userSubscription.count(),
      
      // Active subscriptions
      prisma.userSubscription.count({
        where: { status: 'ACTIVE' }
      }),
      
      // New subscriptions last 30 days
      prisma.userSubscription.count({
        where: {
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      
      // Canceled subscriptions last 30 days
      prisma.userSubscription.count({
        where: {
          status: 'CANCELED',
          canceledAt: { gte: thirtyDaysAgo }
        }
      }),
      
      // Total revenue (all time)
      prisma.payment.aggregate({
        where: {
          status: 'SUCCEEDED'
        },
        _sum: { amount: true }
      }),
      
      // Monthly revenue (last 30 days)
      prisma.payment.aggregate({
        where: {
          status: 'SUCCEEDED',
          processedAt: { gte: thirtyDaysAgo }
        },
        _sum: { amount: true }
      }),
      
      // Trial users count
      prisma.userSubscription.count({
        where: { status: 'TRIALING' }
      }),
      
      // Calculate conversion rate (trials to paid)
      prisma.$queryRaw`
        SELECT 
          COUNT(CASE WHEN status = 'ACTIVE' AND trial_ended_at IS NOT NULL THEN 1 END) as converted,
          COUNT(CASE WHEN trial_ended_at IS NOT NULL THEN 1 END) as total_trials
        FROM user_subscriptions 
        WHERE trial_ended_at >= ${thirtyDaysAgo}
      ` as any[]
    ]);

    // Calculate churn rate (canceled / total active at start of period)
    const activeAtStartOfPeriod = await prisma.userSubscription.count({
      where: {
        OR: [
          { status: 'ACTIVE' },
          { 
            status: 'CANCELED',
            canceledAt: { gte: thirtyDaysAgo }
          }
        ],
        createdAt: { lt: thirtyDaysAgo }
      }
    });

    const churnRate = activeAtStartOfPeriod > 0 
      ? (canceledSubscriptionsLast30Days / activeAtStartOfPeriod) * 100 
      : 0;

    const conversionData = conversionRate[0] || { converted: 0, total_trials: 0 };
    const actualConversionRate = conversionData.total_trials > 0 
      ? (Number(conversionData.converted) / Number(conversionData.total_trials)) * 100 
      : 0;

    res.json({
      status: 'success',
      data: {
        subscriptions: {
          total: totalSubscriptions,
          active: activeSubscriptions,
          trial: trialUsers,
          newLast30Days: newSubscriptionsLast30Days,
          canceledLast30Days: canceledSubscriptionsLast30Days
        },
        revenue: {
          total: totalRevenue._sum.amount ? Number(totalRevenue._sum.amount) / 100 : 0,
          monthly: monthlyRevenue._sum.amount ? Number(monthlyRevenue._sum.amount) / 100 : 0
        },
        metrics: {
          churnRate: Number(churnRate.toFixed(2)),
          conversionRate: Number(actualConversionRate.toFixed(2))
        }
      }
    });
  })
);

// Revenue analytics
router.get('/revenue',
  authenticateAdmin,
  [
    query('period').optional().isIn(['7d', '30d', '90d', '1y']),
    query('granularity').optional().isIn(['day', 'week', 'month'])
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const period = req.query.period as string || '30d';
    const granularity = req.query.granularity as string || 'day';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Revenue over time
    const revenueQuery = granularity === 'month' 
      ? Prisma.sql`
          SELECT 
            DATE_TRUNC('month', processed_at) as period,
            SUM(amount) as revenue,
            COUNT(*) as transaction_count
          FROM payments 
          WHERE status = 'SUCCEEDED' 
            AND processed_at >= ${startDate}
            AND processed_at <= ${now}
          GROUP BY DATE_TRUNC('month', processed_at)
          ORDER BY period ASC
        `
      : granularity === 'week'
      ? Prisma.sql`
          SELECT 
            DATE_TRUNC('week', processed_at) as period,
            SUM(amount) as revenue,
            COUNT(*) as transaction_count
          FROM payments 
          WHERE status = 'SUCCEEDED' 
            AND processed_at >= ${startDate}
            AND processed_at <= ${now}
          GROUP BY DATE_TRUNC('week', processed_at)
          ORDER BY period ASC
        `
      : Prisma.sql`
          SELECT 
            DATE_TRUNC('day', processed_at) as period,
            SUM(amount) as revenue,
            COUNT(*) as transaction_count
          FROM payments 
          WHERE status = 'SUCCEEDED' 
            AND processed_at >= ${startDate}
            AND processed_at <= ${now}
          GROUP BY DATE_TRUNC('day', processed_at)
          ORDER BY period ASC
        `;

    const revenueData = await prisma.$queryRaw(revenueQuery) as any[];

    // MRR (Monthly Recurring Revenue) - current active subscriptions
    const mrrData = await prisma.$queryRaw`
      SELECT 
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        COUNT(us.id) as subscriber_count,
        SUM(us.current_price) as total_mrr
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.status = 'ACTIVE'
      GROUP BY sp.id, sp.name, sp.display_name
      ORDER BY total_mrr DESC
    ` as any[];

    // Revenue by plan
    const revenueByPlan = await prisma.$queryRaw`
      SELECT 
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        SUM(p.amount) as total_revenue,
        COUNT(p.id) as payment_count
      FROM payments p
      JOIN user_subscriptions us ON p.subscription_id = us.id
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE p.status = 'SUCCEEDED'
        AND p.processed_at >= ${startDate}
        AND p.processed_at <= ${now}
      GROUP BY sp.id, sp.name, sp.display_name
      ORDER BY total_revenue DESC
    ` as any[];

    res.json({
      status: 'success',
      data: {
        period,
        granularity,
        revenueOverTime: revenueData.map((row: any) => ({
          period: row.period,
          revenue: Number(row.revenue) / 100,
          transactionCount: Number(row.transaction_count)
        })),
        mrr: {
          total: mrrData.reduce((sum: number, row: any) => sum + Number(row.total_mrr), 0) / 100,
          byPlan: mrrData.map((row: any) => ({
            planName: row.plan_name,
            planDisplayName: row.plan_display_name,
            subscriberCount: Number(row.subscriber_count),
            mrr: Number(row.total_mrr) / 100
          }))
        },
        revenueByPlan: revenueByPlan.map((row: any) => ({
          planName: row.plan_name,
          planDisplayName: row.plan_display_name,
          totalRevenue: Number(row.total_revenue) / 100,
          paymentCount: Number(row.payment_count)
        }))
      }
    });
  })
);

// Subscription analytics
router.get('/subscriptions',
  authenticateAdmin,
  [
    query('period').optional().isIn(['7d', '30d', '90d', '1y']),
    query('granularity').optional().isIn(['day', 'week', 'month'])
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const period = req.query.period as string || '30d';
    const granularity = req.query.granularity as string || 'day';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // New subscriptions over time
    const newSubscriptionsQuery = granularity === 'month'
      ? Prisma.sql`
          SELECT 
            DATE_TRUNC('month', created_at) as period,
            COUNT(*) as new_subscriptions
          FROM user_subscriptions 
          WHERE created_at >= ${startDate}
            AND created_at <= ${now}
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY period ASC
        `
      : granularity === 'week'
      ? Prisma.sql`
          SELECT 
            DATE_TRUNC('week', created_at) as period,
            COUNT(*) as new_subscriptions
          FROM user_subscriptions 
          WHERE created_at >= ${startDate}
            AND created_at <= ${now}
          GROUP BY DATE_TRUNC('week', created_at)
          ORDER BY period ASC
        `
      : Prisma.sql`
          SELECT 
            DATE_TRUNC('day', created_at) as period,
            COUNT(*) as new_subscriptions
          FROM user_subscriptions 
          WHERE created_at >= ${startDate}
            AND created_at <= ${now}
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY period ASC
        `;

    const newSubscriptionsData = await prisma.$queryRaw(newSubscriptionsQuery) as any[];

    // Churn analysis
    const churnData = await prisma.$queryRaw`
      SELECT 
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        COUNT(CASE WHEN us.status = 'CANCELED' AND us.canceled_at >= ${startDate} THEN 1 END) as churned,
        COUNT(*) as total_subscriptions,
        ROUND(
          (COUNT(CASE WHEN us.status = 'CANCELED' AND us.canceled_at >= ${startDate} THEN 1 END) * 100.0) / 
          NULLIF(COUNT(*), 0), 2
        ) as churn_rate
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.created_at < ${startDate}
      GROUP BY sp.id, sp.name, sp.display_name
      ORDER BY churn_rate DESC
    ` as any[];

    // Trial conversion analysis
    const trialConversionData = await prisma.$queryRaw`
      SELECT 
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        COUNT(CASE WHEN us.trial_ended_at IS NOT NULL THEN 1 END) as total_trials,
        COUNT(CASE WHEN us.trial_ended_at IS NOT NULL AND us.status = 'ACTIVE' THEN 1 END) as converted_trials,
        ROUND(
          (COUNT(CASE WHEN us.trial_ended_at IS NOT NULL AND us.status = 'ACTIVE' THEN 1 END) * 100.0) / 
          NULLIF(COUNT(CASE WHEN us.trial_ended_at IS NOT NULL THEN 1 END), 0), 2
        ) as conversion_rate
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.trial_ended_at >= ${startDate}
      GROUP BY sp.id, sp.name, sp.display_name
      ORDER BY conversion_rate DESC
    ` as any[];

    // Plan distribution
    const planDistribution = await prisma.$queryRaw`
      SELECT 
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        sp.price_amount as plan_price,
        COUNT(us.id) as subscriber_count,
        ROUND(
          (COUNT(us.id) * 100.0) / (
            SELECT COUNT(*) FROM user_subscriptions WHERE status IN ('ACTIVE', 'TRIALING')
          ), 2
        ) as percentage
      FROM subscription_plans sp
      LEFT JOIN user_subscriptions us ON sp.id = us.plan_id AND us.status IN ('ACTIVE', 'TRIALING')
      GROUP BY sp.id, sp.name, sp.display_name, sp.price_amount
      ORDER BY subscriber_count DESC
    ` as any[];

    res.json({
      status: 'success',
      data: {
        period,
        granularity,
        newSubscriptions: newSubscriptionsData.map((row: any) => ({
          period: row.period,
          count: Number(row.new_subscriptions)
        })),
        churnAnalysis: churnData.map((row: any) => ({
          planName: row.plan_name,
          planDisplayName: row.plan_display_name,
          churned: Number(row.churned),
          totalSubscriptions: Number(row.total_subscriptions),
          churnRate: Number(row.churn_rate) || 0
        })),
        trialConversion: trialConversionData.map((row: any) => ({
          planName: row.plan_name,
          planDisplayName: row.plan_display_name,
          totalTrials: Number(row.total_trials),
          convertedTrials: Number(row.converted_trials),
          conversionRate: Number(row.conversion_rate) || 0
        })),
        planDistribution: planDistribution.map((row: any) => ({
          planName: row.plan_name,
          planDisplayName: row.plan_display_name,
          planPrice: Number(row.plan_price) / 100,
          subscriberCount: Number(row.subscriber_count),
          percentage: Number(row.percentage) || 0
        }))
      }
    });
  })
);

// Customer analytics
router.get('/customers',
  authenticateAdmin,
  [
    query('period').optional().isIn(['7d', '30d', '90d', '1y']),
    query('cohort').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400);
    }

    const period = req.query.period as string || '30d';
    const includeCohort = req.query.cohort === 'true';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Customer lifetime value
    const clvData = await prisma.$queryRaw`
      SELECT 
        AVG(total_spent) as avg_clv,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_spent) as median_clv,
        MAX(total_spent) as max_clv,
        MIN(total_spent) as min_clv
      FROM (
        SELECT 
          us.user_id,
          SUM(p.amount) as total_spent
        FROM user_subscriptions us
        JOIN payments p ON us.id = p.subscription_id
        WHERE p.status = 'SUCCEEDED'
        GROUP BY us.user_id
      ) customer_spending
    ` as any[];

    // Customer segmentation by spending
    const customerSegments = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN total_spent >= 10000 THEN 'High Value (>$100)'
          WHEN total_spent >= 5000 THEN 'Medium Value ($50-$100)'
          WHEN total_spent >= 2000 THEN 'Low Value ($20-$50)'
          ELSE 'New Customer (<$20)'
        END as segment,
        COUNT(*) as customer_count,
        AVG(total_spent) as avg_spending
      FROM (
        SELECT 
          us.user_id,
          SUM(p.amount) as total_spent
        FROM user_subscriptions us
        JOIN payments p ON us.id = p.subscription_id
        WHERE p.status = 'SUCCEEDED'
        GROUP BY us.user_id
      ) customer_spending
      GROUP BY segment
      ORDER BY avg_spending DESC
    ` as any[];

    let cohortAnalysis = null;
    if (includeCohort) {
      // Cohort analysis for retention
      cohortAnalysis = await prisma.$queryRaw`
        WITH cohorts AS (
          SELECT 
            user_id,
            DATE_TRUNC('month', MIN(created_at)) as cohort_month,
            MIN(created_at) as first_subscription
          FROM user_subscriptions
          GROUP BY user_id
        ),
        user_activities AS (
          SELECT 
            c.user_id,
            c.cohort_month,
            DATE_TRUNC('month', p.processed_at) as activity_month,
            EXTRACT(MONTH FROM AGE(p.processed_at, c.first_subscription)) as period_number
          FROM cohorts c
          JOIN user_subscriptions us ON c.user_id = us.user_id
          JOIN payments p ON us.id = p.subscription_id
          WHERE p.status = 'SUCCEEDED'
            AND p.processed_at >= ${startDate}
        )
        SELECT 
          cohort_month,
          period_number,
          COUNT(DISTINCT user_id) as customers
        FROM user_activities
        WHERE cohort_month >= ${startDate}
        GROUP BY cohort_month, period_number
        ORDER BY cohort_month, period_number
      ` as any[];
    }

    const clv = clvData[0] || {};

    res.json({
      status: 'success',
      data: {
        period,
        customerLifetimeValue: {
          average: Number(clv.avg_clv) / 100 || 0,
          median: Number(clv.median_clv) / 100 || 0,
          maximum: Number(clv.max_clv) / 100 || 0,
          minimum: Number(clv.min_clv) / 100 || 0
        },
        customerSegments: customerSegments.map((row: any) => ({
          segment: row.segment,
          customerCount: Number(row.customer_count),
          averageSpending: Number(row.avg_spending) / 100
        })),
        ...(cohortAnalysis && {
          cohortAnalysis: cohortAnalysis.map((row: any) => ({
            cohortMonth: row.cohort_month,
            periodNumber: Number(row.period_number),
            customers: Number(row.customers)
          }))
        })
      }
    });
  })
);

export default router;