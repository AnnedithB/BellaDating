import express from 'express';
import { PrismaClient, HourlyMetrics } from '@prisma/client';
import NodeCache from 'node-cache';

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize cache (TTL in seconds)
const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default
  checkperiod: 60 // Check for expired keys every minute
});

// Simple logger
class Logger {
  constructor(private context: string) {}
  
  info(message: string, ...args: any[]) {
    console.log(`[${new Date().toISOString()}] [${this.context}] INFO:`, message, ...args);
  }
  
  warn(message: string, ...args: any[]) {
    console.warn(`[${new Date().toISOString()}] [${this.context}] WARN:`, message, ...args);
  }
  
  error(message: string, ...args: any[]) {
    console.error(`[${new Date().toISOString()}] [${this.context}] ERROR:`, message, ...args);
  }
}

const logger = new Logger('AnalyticsAPI');

// Create router
const router = express.Router();

// ========================================
// KPI OVERVIEW ENDPOINTS
// ========================================

router.get('/kpis/overview', async (req, res) => {
  try {
    const cacheKey = 'kpis_overview';
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get latest daily KPI summary
    const latestKPIs = await prisma.dailyKPISummary.findFirst({
      where: { userDimensionId: null },
      orderBy: { date: 'desc' }
    });

    // Get 30-day trends
    const thirtyDayKPIs = await prisma.dailyKPISummary.findMany({
      where: {
        userDimensionId: null,
        date: {
          gte: thirtyDaysAgo,
          lte: today
        }
      },
      orderBy: { date: 'asc' }
    });

    // Calculate trends
    const totalActiveUsers = thirtyDayKPIs.reduce((sum: number, day: any) => sum + day.totalActiveUsers, 0);
    const totalRevenue = thirtyDayKPIs.reduce((sum: number, day: any) => sum + day.totalRevenue, 0);
    const totalMatches = thirtyDayKPIs.reduce((sum: number, day: any) => sum + day.totalMatches, 0);
    const totalMessages = thirtyDayKPIs.reduce((sum: number, day: any) => sum + day.totalMessages, 0);

    // Calculate average metrics
    const avgDailyActiveUsers = totalActiveUsers / thirtyDayKPIs.length;
    const avgDailyRevenue = totalRevenue / thirtyDayKPIs.length;
    const avgMatchesPerUser = totalActiveUsers > 0 ? totalMatches / totalActiveUsers : 0;
    const avgMessagesPerUser = totalActiveUsers > 0 ? totalMessages / totalActiveUsers : 0;

    // Get user growth data
    const userGrowth = thirtyDayKPIs.map((day: any) => ({
      date: day.date,
      newUsers: day.newRegistrations,
      activeUsers: day.totalActiveUsers,
      revenue: day.totalRevenue
    }));

    const overview = {
      currentMetrics: {
        dailyActiveUsers: latestKPIs?.totalActiveUsers || 0,
        newRegistrations: latestKPIs?.newRegistrations || 0,
        totalMatches: latestKPIs?.totalMatches || 0,
        totalMessages: latestKPIs?.totalMessages || 0,
        dailyRevenue: latestKPIs?.totalRevenue || 0,
        avgSessionDuration: latestKPIs?.avgSessionDuration || 0,
        conversionRate: latestKPIs?.conversionToSubscription || 0
      },
      trends: {
        avgDailyActiveUsers,
        avgDailyRevenue,
        avgMatchesPerUser,
        avgMessagesPerUser,
        userGrowth: userGrowth.slice(-7) // Last 7 days
      },
      businessMetrics: {
        totalRevenue30Days: totalRevenue,
        avgRevenuePerUser: avgDailyActiveUsers > 0 ? totalRevenue / avgDailyActiveUsers : 0,
        userRetentionDay7: latestKPIs?.userRetentionDay7 || 0,
        userRetentionDay30: latestKPIs?.userRetentionDay30 || 0
      },
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, overview, 300); // Cache for 5 minutes
    res.json(overview);

  } catch (error) {
    logger.error('Error fetching KPI overview:', error);
    res.status(500).json({
      error: 'Failed to fetch KPI overview',
      message: (error as Error).message
    });
  }
});

// ========================================
// ACTIVE USER METRICS
// ========================================

router.get('/kpis/active-users', async (req, res) => {
  try {
    const granularity = normalizeGranularity((req.query.granularity as string) || 'daily');
    const range = (req.query.range as string) || defaultRangeForGranularity(granularity);
    const { startDate, endDate } = resolveRange(range, granularity);

    if (granularity === 'hourly') {
      const hourlyMetrics = await prisma.hourlyMetrics.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { timestamp: 'asc' }
      });

      const breakdown = hourlyMetrics.map((metric: HourlyMetrics) => ({
        label: metric.timestamp.toISOString(),
        startDate: metric.timestamp,
        endDate: new Date(metric.timestamp.getTime() + 60 * 60 * 1000 - 1),
        activeUsers: metric.concurrentUsers,
        metadata: {
          activeInteractions: metric.activeInteractions,
          queueLength: metric.queueLength,
          newUsers: metric.newUsers
        }
      }));

      const summary = summarizeBreakdown(breakdown);

      return res.json({
        summary: {
          ...summary,
          granularity,
          range: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        },
        breakdown
      });
    }

    const dailyMetrics = await prisma.dailyKPISummary.findMany({
      where: {
        userDimensionId: null,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    });

    const breakdown = bucketDailyMetricsByGranularity(dailyMetrics, granularity);
    const summary = summarizeBreakdown(breakdown);

    res.json({
      summary: {
        ...summary,
        granularity,
        range: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      },
      breakdown
    });

  } catch (error) {
    logger.error('Error fetching active user metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch active user metrics',
      message: (error as Error).message
    });
  }
});

// ========================================
// RETENTION ANALYSIS ENDPOINTS
// ========================================

router.get('/kpis/retention', async (req, res) => {
  try {
    const { period = 'weekly', cohortCount = 12 } = req.query;
    const cacheKey = `retention_${period}_${cohortCount}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get retention cohort data
    const retentionData = await prisma.retentionCohort.findMany({
      where: {
        userDimensionId: null,
        periodNumber: {
          lte: parseInt(cohortCount as string)
        }
      },
      orderBy: [
        { cohortWeek: 'desc' },
        { periodNumber: 'asc' }
      ],
      take: parseInt(cohortCount as string) * 13 // 13 periods max per cohort
    });

    // Group by cohort week
    const cohortMap = new Map();
    retentionData.forEach((record: any) => {
      const cohortKey = record.cohortWeek.toISOString().split('T')[0];
      if (!cohortMap.has(cohortKey)) {
        cohortMap.set(cohortKey, []);
      }
      cohortMap.get(cohortKey).push(record);
    });

    // Format cohort table
    const cohortTable = Array.from(cohortMap.entries()).map(([cohortWeek, periods]) => {
      const sortedPeriods = (periods as any[]).sort((a, b) => a.periodNumber - b.periodNumber);
      return {
        cohortWeek,
        cohortSize: sortedPeriods[0]?.cohortSize || 0,
        retentionRates: sortedPeriods.map(p => ({
          period: p.periodNumber,
          retentionRate: p.retentionRate,
          usersReturned: p.usersReturned
        }))
      };
    });

    // Calculate average retention by period
    const periodAverages = [];
    for (let period = 0; period <= parseInt(cohortCount as string); period++) {
      const periodData = retentionData.filter((r: any) => r.periodNumber === period);
      const avgRetention = periodData.length > 0 
        ? periodData.reduce((sum: number, r: any) => sum + r.retentionRate, 0) / periodData.length 
        : 0;
      periodAverages.push({
        period,
        averageRetention: avgRetention,
        cohortCount: periodData.length
      });
    }

    const retention = {
      cohortTable,
      periodAverages,
      insights: {
        strongestCohort: cohortTable.reduce((best, current) => {
          const currentMonth1 = current.retentionRates.find(r => r.period === 4); // Month 1
          const bestMonth1 = best.retentionRates?.find(r => r.period === 4);
          return (currentMonth1?.retentionRate || 0) > (bestMonth1?.retentionRate || 0) ? current : best;
        }, cohortTable[0]),
        overallRetentionTrend: periodAverages.slice(1, 5).map(p => p.averageRetention) // Weeks 1-4
      },
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, retention, 600); // Cache for 10 minutes
    res.json(retention);

  } catch (error) {
    logger.error('Error fetching retention data:', error);
    res.status(500).json({
      error: 'Failed to fetch retention data',
      message: (error as Error).message
    });
  }
});

// ========================================
// REVENUE ANALYSIS ENDPOINTS
// ========================================

router.get('/kpis/revenue', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const cacheKey = `revenue_${timeframe}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get revenue metrics
    const revenueData = await prisma.revenueMetrics.findMany({
      where: {
        userDimensionId: null,
        date: { gte: startDate }
      },
      orderBy: { date: 'desc' }
    });

    // Calculate totals and trends
    const totalRevenue = revenueData.reduce((sum: number, day: any) => sum + day.totalRevenue, 0);
    const totalNewSubs = revenueData.reduce((sum: number, day: any) => sum + day.newSubscriptions, 0);
    const totalChurnedSubs = revenueData.reduce((sum: number, day: any) => sum + day.churnedSubscriptions, 0);
    
    const avgMRR = revenueData.length > 0 
      ? revenueData.reduce((sum: number, day: any) => sum + day.monthlyRecurringRev, 0) / revenueData.length 
      : 0;
    
    const avgChurnRate = revenueData.length > 0 
      ? revenueData.reduce((sum: number, day: any) => sum + day.churnRate, 0) / revenueData.length 
      : 0;

    // Get subscription plan breakdown
    const planBreakdown = await prisma.revenueMetrics.groupBy({
      by: ['subscriptionPlan'],
      where: {
        userDimensionId: null,
        date: { gte: startDate }
      },
      _sum: {
        totalRevenue: true,
        newSubscriptions: true
      },
      _avg: {
        avgRevenuePerUser: true
      }
    });

    // Revenue timeline
    const revenueTimeline = revenueData.slice(-30).map((day: any) => ({
      date: day.date,
      revenue: day.totalRevenue,
      newSubscriptions: day.newSubscriptions,
      churnedSubscriptions: day.churnedSubscriptions,
      mrr: day.monthlyRecurringRev
    }));

    const revenue = {
      summary: {
        totalRevenue,
        totalNewSubscriptions: totalNewSubs,
        totalChurnedSubscriptions: totalChurnedSubs,
        netSubscriptionGrowth: totalNewSubs - totalChurnedSubs,
        averageMRR: avgMRR,
        averageChurnRate: avgChurnRate,
        averageRevenuePerUser: totalNewSubs > 0 ? totalRevenue / totalNewSubs : 0
      },
      planBreakdown: planBreakdown.map((plan: any) => ({
        plan: plan.subscriptionPlan,
        totalRevenue: plan._sum.totalRevenue || 0,
        totalSubscriptions: plan._sum.newSubscriptions || 0,
        avgRevenuePerUser: plan._avg.avgRevenuePerUser || 0
      })),
      timeline: revenueTimeline,
      insights: {
        topPerformingPlan: planBreakdown.reduce((top: any, current: any) => {
          return (current._sum.totalRevenue || 0) > (top._sum.totalRevenue || 0) ? current : top;
        }, planBreakdown[0]),
        revenueGrowthRate: calculateGrowthRate(revenueTimeline.map((r: any) => r.revenue))
      },
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, revenue, 600); // Cache for 10 minutes
    res.json(revenue);

  } catch (error) {
    logger.error('Error fetching revenue data:', error);
    res.status(500).json({
      error: 'Failed to fetch revenue data',
      message: (error as Error).message
    });
  }
});

// ========================================
// USER BEHAVIOR ANALYSIS ENDPOINTS
// ========================================

router.get('/kpis/user-behavior', async (req, res) => {
  try {
    const { timeframe = '7d', eventType } = req.query;
    const cacheKey = `user_behavior_${timeframe}_${eventType || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const days = timeframe === '1d' ? 1 : timeframe === '30d' ? 30 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user behavior events
    const events = await prisma.userBehaviorEvent.findMany({
      where: {
        eventTime: { gte: startDate },
        ...(eventType && { eventName: eventType as string })
      },
      select: {
        eventName: true,
        eventTime: true,
        platform: true,
        userId: true
      }
    });

    // Aggregate events by type
    const eventCounts = events.reduce((acc: any, event: any) => {
      acc[event.eventName] = (acc[event.eventName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Platform breakdown
    const platformCounts = events.reduce((acc: any, event: any) => {
      acc[event.platform] = (acc[event.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Hourly pattern analysis
    const hourlyPattern = Array.from({ length: 24 }, (_, hour) => {
      const hourEvents = events.filter((e: any) => new Date(e.eventTime).getHours() === hour);
      return {
        hour,
        eventCount: hourEvents.length,
        uniqueUsers: new Set(hourEvents.map((e: any) => e.userId)).size
      };
    });

    // Top events
    const topEvents = Object.entries(eventCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([eventName, count]) => ({ eventName, count }));

    // User engagement metrics
    const uniqueUsers = new Set(events.map((e: any) => e.userId)).size;
    const avgEventsPerUser = uniqueUsers > 0 ? events.length / uniqueUsers : 0;

    const behavior = {
      overview: {
        totalEvents: events.length,
        uniqueUsers,
        avgEventsPerUser,
        topEventType: topEvents[0]?.eventName || null
      },
      eventBreakdown: topEvents,
      platformBreakdown: Object.entries(platformCounts).map(([platform, count]) => ({
        platform,
        count,
        percentage: ((count as number) / events.length) * 100
      })),
      temporalPatterns: {
        hourlyPattern,
        peakHour: hourlyPattern.reduce((peak, current) => 
          current.eventCount > peak.eventCount ? current : peak
        )
      },
      insights: {
        mostActiveHours: hourlyPattern
          .filter(h => h.eventCount > avgEventsPerUser)
          .map(h => h.hour),
        dominantPlatform: Object.entries(platformCounts).reduce(([maxPlatform, maxCount], [platform, count]) => 
          (count as number) > (maxCount as number) ? [platform, count] : [maxPlatform, maxCount]
        )[0]
      },
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, behavior, 300); // Cache for 5 minutes
    res.json(behavior);

  } catch (error) {
    logger.error('Error fetching user behavior data:', error);
    res.status(500).json({
      error: 'Failed to fetch user behavior data',
      message: (error as Error).message
    });
  }
});

// ========================================
// CONVERSION FUNNEL ENDPOINTS
// ========================================

router.get('/kpis/funnel', async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const cacheKey = `funnel_${timeframe}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get funnel data
    const funnelData = await prisma.conversionFunnel.findMany({
      where: {
        userDimensionId: null,
        date: { gte: startDate }
      },
      orderBy: { date: 'desc' }
    });

    // Group by funnel step and calculate averages
    const stepMap = new Map();
    funnelData.forEach((record: any) => {
      if (!stepMap.has(record.funnelStep)) {
        stepMap.set(record.funnelStep, []);
      }
      stepMap.get(record.funnelStep).push(record);
    });

    const funnelSteps = [
      'app_open',
      'registration_start', 
      'registration_complete',
      'first_session',
      'first_match',
      'first_message',
      'subscription_view',
      'subscription_purchase'
    ];

    const funnel = funnelSteps.map(step => {
      const stepData = stepMap.get(step) || [];
      const avgUsers = stepData.length > 0 
        ? stepData.reduce((sum: number, r: any) => sum + r.totalUsers, 0) / stepData.length 
        : 0;
      const avgConverted = stepData.length > 0 
        ? stepData.reduce((sum: number, r: any) => sum + r.convertedUsers, 0) / stepData.length 
        : 0;
      const avgConversionRate = stepData.length > 0 
        ? stepData.reduce((sum: number, r: any) => sum + r.conversionRate, 0) / stepData.length 
        : 0;

      return {
        step,
        averageUsers: Math.round(avgUsers),
        averageConverted: Math.round(avgConverted),
        conversionRate: avgConversionRate,
        dropOffCount: stepData.length > 0 ? Math.round(avgUsers - avgConverted) : 0
      };
    });

    // Calculate step-to-step conversion rates
    const stepConversions = funnel.slice(1).map((step, index) => ({
      fromStep: funnel[index].step,
      toStep: step.step,
      conversionRate: funnel[index].averageUsers > 0 
        ? (step.averageUsers / funnel[index].averageUsers) * 100 
        : 0,
      dropOffRate: funnel[index].averageUsers > 0 
        ? ((funnel[index].averageUsers - step.averageUsers) / funnel[index].averageUsers) * 100 
        : 0
    }));

    const funnelAnalysis = {
      funnel,
      stepConversions,
      insights: {
        biggestDropOff: stepConversions.reduce((max, current) => 
          current.dropOffRate > max.dropOffRate ? current : max
        ),
        overallConversionRate: funnel.length > 0 && funnel[0].averageUsers > 0 
          ? (funnel[funnel.length - 1].averageUsers / funnel[0].averageUsers) * 100 
          : 0,
        totalUsers: funnel[0]?.averageUsers || 0,
        finalConversions: funnel[funnel.length - 1]?.averageUsers || 0
      },
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, funnelAnalysis, 600); // Cache for 10 minutes
    res.json(funnelAnalysis);

  } catch (error) {
    logger.error('Error fetching funnel data:', error);
    res.status(500).json({
      error: 'Failed to fetch funnel data',
      message: (error as Error).message
    });
  }
});

// ========================================
// CACHE MANAGEMENT ENDPOINTS
// ========================================

router.delete('/cache/:key?', (req, res) => {
  try {
    const { key } = req.params;
    
    if (key) {
      cache.del(key);
      res.json({ message: `Cache key '${key}' cleared` });
    } else {
      cache.flushAll();
      res.json({ message: 'All cache cleared' });
    }
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: (error as Error).message
    });
  }
});

router.get('/cache/stats', (req, res) => {
  const stats = cache.getStats();
  res.json({
    ...stats,
    timestamp: new Date().toISOString()
  });
});

// ========================================
// UTILITY FUNCTIONS
// ========================================

function calculateGrowthRate(values: number[]): number {
  if (values.length < 2) return 0;
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  return firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
}

type Granularity = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'hourly';

function normalizeGranularity(value: string): Granularity {
  const normalized = (value || 'daily').toLowerCase();
  if (['daily', 'weekly', 'monthly', 'quarterly', 'hourly'].includes(normalized)) {
    return normalized as Granularity;
  }
  return 'daily';
}

function defaultRangeForGranularity(granularity: Granularity): string {
  switch (granularity) {
    case 'hourly':
      return '72h';
    case 'weekly':
      return '12w';
    case 'monthly':
      return '6m';
    case 'quarterly':
      return '4q';
    default:
      return '30d';
  }
}

function resolveRange(range: string, granularity: Granularity): { startDate: Date; endDate: Date } {
  const now = new Date();
  const trimmed = range ? range.trim() : '';
  const match = /^(\d+)\s*([dwmhq])$/i.exec(trimmed);

  const endDate = now;
  const startDate = new Date(endDate);

  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'h':
        startDate.setHours(startDate.getHours() - amount);
        break;
      case 'd':
        startDate.setDate(startDate.getDate() - amount);
        break;
      case 'w':
        startDate.setDate(startDate.getDate() - amount * 7);
        break;
      case 'm':
        startDate.setMonth(startDate.getMonth() - amount);
        break;
      case 'q':
        startDate.setMonth(startDate.getMonth() - amount * 3);
        break;
      default:
        startDate.setDate(startDate.getDate() - amount);
    }
  } else {
    startDate.setDate(startDate.getDate() - 30);
  }

  if (granularity === 'quarterly') {
    startDate.setMonth(startDate.getMonth() - 3);
  } else if (granularity === 'monthly') {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  return { startDate, endDate };
}

function bucketDailyMetricsByGranularity(records: any[], granularity: Granularity) {
  if (granularity === 'daily') {
    return records.map(record => ({
      label: toISODate(record.date),
      startDate: record.date,
      endDate: record.date,
      activeUsers: record.totalActiveUsers,
      metadata: {
        newRegistrations: record.newRegistrations,
        totalSessions: record.totalSessions
      }
    }));
  }

  const buckets = new Map<string, {
    startDate: Date;
    endDate: Date;
    totalActiveUsers: number;
    days: number;
  }>();

  records.forEach(record => {
    const date = new Date(record.date);
    const bucketInfo = getBucketInfo(date, granularity);
    const bucketKey = bucketInfo.label;

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        startDate: bucketInfo.start,
        endDate: bucketInfo.end,
        totalActiveUsers: 0,
        days: 0
      });
    }

    const bucket = buckets.get(bucketKey)!;
    bucket.totalActiveUsers += record.totalActiveUsers;
    bucket.days += 1;
  });

  return Array.from(buckets.entries())
    .sort((a, b) => a[1].startDate.getTime() - b[1].startDate.getTime())
    .map(([label, bucket]) => ({
      label,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      activeUsers: Math.round(bucket.totalActiveUsers / Math.max(1, bucket.days)),
      metadata: {
        totalActiveUsers: bucket.totalActiveUsers,
        days: bucket.days
      }
    }));
}

function summarizeBreakdown(breakdown: Array<{ activeUsers: number }>) {
  const total = breakdown.reduce((sum, bucket) => sum + bucket.activeUsers, 0);
  const average = breakdown.length ? total / breakdown.length : 0;
  const latest = breakdown[breakdown.length - 1];
  return {
    latestBucketActiveUsers: latest?.activeUsers || 0,
    averageBucketActiveUsers: Number(average.toFixed(2)),
    totalBuckets: breakdown.length
  };
}

function getBucketInfo(date: Date, granularity: Granularity) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);

  if (granularity === 'weekly') {
    const day = normalized.getDay();
    const diffToMonday = (day + 6) % 7;
    const start = new Date(normalized);
    start.setDate(start.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
      label: `${start.getFullYear()}-W${getWeekNumber(start)}`,
      start,
      end
    };
  }

  if (granularity === 'monthly') {
    const start = new Date(normalized.getFullYear(), normalized.getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return {
      label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      start,
      end
    };
  }

  if (granularity === 'quarterly') {
    const quarter = Math.floor(normalized.getMonth() / 3);
    const startMonth = quarter * 3;
    const start = new Date(normalized.getFullYear(), startMonth, 1);
    const end = new Date(normalized.getFullYear(), startMonth + 3, 0);
    return {
      label: `${start.getFullYear()}-Q${quarter + 1}`,
      start,
      end
    };
  }

  return {
    label: toISODate(normalized),
    start: normalized,
    end: normalized
  };
}

function getWeekNumber(date: Date): string {
  const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return String(weekNum).padStart(2, '0');
}

function toISODate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().split('T')[0];
}

export default router;
