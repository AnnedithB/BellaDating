import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Get dashboard overview metrics
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { period = '7d' } = req.query;
    
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const startDate = subDays(new Date(), days);
    
    // Get daily metrics for the period
    const dailyMetrics = await prisma.dailyKPISummary.findMany({
      where: {
        date: {
          gte: startDate
        }
      },
      orderBy: { date: 'desc' }
    });

    // Calculate aggregated metrics
    const totalUsers = dailyMetrics.reduce((sum: number, day: any) => sum + day.totalUsers, 0);
    const totalInteractions = dailyMetrics.reduce((sum: number, day: any) => sum + day.totalInteractions, 0);
    const totalVideoInteractions = dailyMetrics.reduce((sum: number, day: any) => sum + day.videoInteractions, 0);
    const avgDuration = dailyMetrics.reduce((sum: number, day: any) => sum + (Number(day.averageCallDuration) || 0), 0) / dailyMetrics.length;

    // Get latest day for active metrics
    const latestMetrics = dailyMetrics[0];
    
    // Calculate rates
    const completionRate = totalInteractions > 0 ? 
      (dailyMetrics.reduce((sum: number, day: any) => sum + day.completedInteractions, 0) / totalInteractions * 100) : 0;
    
    const videoAdoptionRate = totalInteractions > 0 ? 
      (totalVideoInteractions / totalInteractions * 100) : 0;

    const videoAcceptanceRate = dailyMetrics.reduce((sum: number, day: any) => sum + day.videoRequestsMade, 0) > 0 ?
      (dailyMetrics.reduce((sum: number, day: any) => sum + day.videoRequestsAccepted, 0) / 
       dailyMetrics.reduce((sum: number, day: any) => sum + day.videoRequestsMade, 0) * 100) : 0;

    res.json({
      status: 'success',
      data: {
        overview: {
          totalUsers: latestMetrics?.totalActiveUsers || 0,
          activeUsers: latestMetrics?.totalActiveUsers || 0,
          totalInteractions,
          avgCallDuration: Math.round(avgDuration),
          completionRate: Math.round(completionRate * 100) / 100,
          videoAdoptionRate: Math.round(videoAdoptionRate * 100) / 100,
          videoAcceptanceRate: Math.round(videoAcceptanceRate * 100) / 100
        },
        trends: dailyMetrics.map((day: any) => ({
          date: format(day.date, 'yyyy-MM-dd'),
          activeUsers: day.activeUsers,
          interactions: day.totalInteractions,
          videoInteractions: day.videoInteractions,
          averageDuration: Number(day.averageCallDuration) || 0
        }))
      }
    });

  } catch (error) {
    logger.error('Error fetching dashboard metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get Daily Active Users (DAU) and Monthly Active Users (MAU)
router.get('/users/activity', async (req: Request, res: Response) => {
  try {
    const { period = '30d' } = req.query;
    const days = period === '90d' ? 90 : 30;
    const startDate = subDays(new Date(), days);
    
    const metrics = await prisma.dailyKPISummary.findMany({
      where: {
        date: { gte: startDate }
      },
      select: {
        date: true,
        totalActiveUsers: true,
        newRegistrations: true
      },
      orderBy: { date: 'asc' }
    });

    // Calculate MAU (unique active users in last 30 days)
    const last30Days = metrics.slice(-30);
    const mau = last30Days.reduce((sum: number, day: any) => sum + day.totalActiveUsers, 0);
    const dau = metrics[metrics.length - 1]?.totalActiveUsers || 0;
    
    res.json({
      status: 'success',
      data: {
        dau,
        mau,
        dauMauRatio: mau > 0 ? Math.round((dau / mau) * 10000) / 100 : 0,
        trends: metrics.map((day: any) => ({
          date: format(day.date, 'yyyy-MM-dd'),
          totalUsers: day.totalUsers,
          activeUsers: day.activeUsers,
          newRegistrations: day.newRegistrations
        }))
      }
    });

  } catch (error) {
    logger.error('Error fetching user activity metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get call and interaction metrics
router.get('/interactions', async (req: Request, res: Response) => {
  try {
    const { period = '7d' } = req.query;
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const startDate = subDays(new Date(), days);
    
    const metrics = await prisma.dailyKPISummary.findMany({
      where: {
        date: { gte: startDate }
      },
      select: {
        date: true,
        totalMatches: true,
        totalVideoCallsCompleted: true,
        totalVideoCallsInitiated: true,
        avgVideoCallDuration: true
      },
      orderBy: { date: 'asc' }
    });

    const totalInteractions = metrics.reduce((sum: number, day: any) => sum + day.totalMatches, 0);
    const completedInteractions = metrics.reduce((sum: number, day: any) => sum + day.completedInteractions, 0);
    const videoInteractions = metrics.reduce((sum: number, day: any) => sum + day.videoInteractions, 0);
    
    res.json({
      status: 'success',
      data: {
        summary: {
          totalInteractions,
          completedInteractions,
          failedInteractions: metrics.reduce((sum: number, day: any) => sum + day.failedInteractions, 0),
          completionRate: totalInteractions > 0 ? (completedInteractions / totalInteractions * 100) : 0,
          videoAdoptionRate: totalInteractions > 0 ? (videoInteractions / totalInteractions * 100) : 0,
          averageDuration: metrics.reduce((sum: number, day: any) => sum + (Number(day.averageCallDuration) || 0), 0) / metrics.length,
          averageRating: metrics.reduce((sum: number, day: any) => sum + (Number(day.averageRating) || 0), 0) / metrics.length
        },
        trends: metrics.map((day: any) => ({
          date: format(day.date, 'yyyy-MM-dd'),
          totalInteractions: day.totalInteractions,
          completedInteractions: day.completedInteractions,
          failedInteractions: day.failedInteractions,
          videoInteractions: day.videoInteractions,
          averageDuration: Number(day.averageCallDuration) || 0,
          connectionIssues: day.connectionIssues
        }))
      }
    });

  } catch (error) {
    logger.error('Error fetching interaction metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get user distribution by intent/demographics
router.get('/users/distribution', async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();
    const dateKey = startOfDay(targetDate);
    
    const segments = await prisma.userSegmentMetrics.findMany({
      where: {
        date: dateKey
      }
    });

    // Group by different dimensions
    const byGender = segments.reduce((acc: any, segment: any) => {
      if (segment.gender) {
        acc[segment.gender] = (acc[segment.gender] || 0) + segment.userCount;
      }
      return acc;
    }, {} as Record<string, number>);

    const byAgeGroup = segments.reduce((acc: any, segment: any) => {
      if (segment.ageGroup) {
        acc[segment.ageGroup] = (acc[segment.ageGroup] || 0) + segment.userCount;
      }
      return acc;
    }, {} as Record<string, number>);

    const byIntent = segments.reduce((acc: any, segment: any) => {
      if (segment.intent) {
        acc[segment.intent] = (acc[segment.intent] || 0) + segment.userCount;
      }
      return acc;
    }, {} as Record<string, number>);

    const byLocation = segments.reduce((acc: any, segment: any) => {
      if (segment.location) {
        acc[segment.location] = (acc[segment.location] || 0) + segment.userCount;
      }
      return acc;
    }, {} as Record<string, number>);

    res.json({
      status: 'success',
      data: {
        date: format(targetDate, 'yyyy-MM-dd'),
        byGender,
        byAgeGroup,
        byIntent,
        byLocation: Object.entries(byLocation)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 10) // Top 10 locations
          .reduce((acc: any, [key, value]) => ({ ...acc, [key]: value }), {})
      }
    });

  } catch (error) {
    logger.error('Error fetching user distribution:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get real-time metrics
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);
    
    const hourlyMetric = await prisma.hourlyMetrics.findFirst({
      where: {
        timestamp: currentHour,
        hour: currentHour.getHours()
      }
    });

    // Get performance metrics for the last hour
    const performanceMetrics = await prisma.performanceMetrics.findMany({
      where: {
        timestamp: {
          gte: subDays(new Date(), 1)
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 24 // Last 24 hours
    });

    const avgResponseTime = performanceMetrics.length > 0 ? 
      performanceMetrics.reduce((sum: number, metric: any) => sum + Number(metric.avgResponseTime), 0) / performanceMetrics.length : 0;

    const totalRequests = performanceMetrics.reduce((sum: number, metric: any) => sum + metric.requestCount, 0);
    const totalErrors = performanceMetrics.reduce((sum: number, metric: any) => sum + metric.errorCount, 0);

    res.json({
      status: 'success',
      data: {
        current: {
          concurrentUsers: hourlyMetric?.concurrentUsers || 0,
          activeInteractions: hourlyMetric?.activeInteractions || 0,
          queueLength: hourlyMetric?.queueLength || 0
        },
        performance: {
          avgResponseTime: Math.round(avgResponseTime),
          totalRequests,
          errorRate: totalRequests > 0 ? (totalErrors / totalRequests * 100) : 0,
          uptime: 99.9 // This would come from monitoring service
        },
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching real-time metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get custom date range metrics
router.get('/custom', async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, metrics } = req.query;
    
    if (!startDate || !endDate) {
      res.status(400).json({
        status: 'error',
        message: 'Start date and end date are required'
      });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const requestedMetrics = (metrics as string)?.split(',') || ['users', 'interactions'];

    const dailyMetrics = await prisma.dailyKPISummary.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      orderBy: { date: 'asc' }
    });

    const result: any = {
      period: {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
        days: dailyMetrics.length
      }
    };

    if (requestedMetrics.includes('users')) {
      result.users = {
        totalUsers: dailyMetrics[dailyMetrics.length - 1]?.totalActiveUsers || 0,
        newRegistrations: dailyMetrics.reduce((sum: number, day: any) => sum + day.newRegistrations, 0),
        activeUsers: dailyMetrics.reduce((sum: number, day: any) => sum + day.activeUsers, 0) / dailyMetrics.length
      };
    }

    if (requestedMetrics.includes('interactions')) {
      result.interactions = {
        total: dailyMetrics.reduce((sum: number, day: any) => sum + day.totalInteractions, 0),
        completed: dailyMetrics.reduce((sum: number, day: any) => sum + day.completedInteractions, 0),
        video: dailyMetrics.reduce((sum: number, day: any) => sum + day.videoInteractions, 0),
        averageDuration: dailyMetrics.reduce((sum: number, day: any) => sum + (Number(day.averageCallDuration) || 0), 0) / dailyMetrics.length
      };
    }

    result.trends = dailyMetrics;

    res.json({
      status: 'success',
      data: result
    });

  } catch (error) {
    logger.error('Error fetching custom metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

export default router;