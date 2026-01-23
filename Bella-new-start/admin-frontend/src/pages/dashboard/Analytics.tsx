import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import dayjs from 'dayjs';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { adminAnalyticsAPI, analyticsAPI, ticketsAPI } from 'services/api';
import ReactEchart from 'components/base/ReactEchart';
import AnalyticKPI from 'components/sections/dashboards/analytics/kpi/AnalyticKPI';

echarts.use([
  TooltipComponent,
  GridComponent,
  LineChart,
  BarChart,
  CanvasRenderer,
  LegendComponent,
]);

const Analytics = () => {
  const [overview, setOverview] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [activeUsersData, setActiveUsersData] = useState<any>(null);
  const [supportTicketsCount, setSupportTicketsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load from both services and fetch additional chart data
      const [overviewData, dashboardData, revenueResponse, activeUsersResponse, ticketsMetrics] =
        await Promise.all([
          analyticsAPI.getOverview().catch(() => null),
          adminAnalyticsAPI.getDashboard().catch(() => null),
          analyticsAPI.getRevenue({ timeframe: '30d' }).catch(() => null),
          analyticsAPI.getActiveUsers({ granularity: 'daily', range: '7d' }).catch(() => null),
          ticketsAPI.getMetrics().catch(() => null),
        ]);

      if (overviewData) {
        setOverview(overviewData);
      }
      if (dashboardData) {
        setDashboard(dashboardData);
      }
      if (revenueResponse) {
        setRevenueData(revenueResponse);
      }
      if (activeUsersResponse) {
        setActiveUsersData(activeUsersResponse);
      }
      if (ticketsMetrics?.data?.overview) {
        setSupportTicketsCount(ticketsMetrics.data.overview.totalTickets || 0);
      }
    } catch (err: any) {
      // Show friendly message if backend is not running
      if (err.message?.includes('connect') || err.message?.includes('Unable to connect')) {
        setError(
          'Backend services are not running. Please start Admin Service (port 3009) and Analytics Service (port 3008).',
        );
      } else {
        setError(err.message || 'Failed to load analytics');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  // Create KPI cards from the data
  const kpis = [];

  if (overview?.currentMetrics) {
    kpis.push(
      {
        title: 'Daily Active Users',
        value: overview.currentMetrics.dailyActiveUsers || 0,
        link: { prefix: 'View', url: '#', text: 'details' },
        icon: { name: 'material-symbols:people-outline', color: 'primary' },
      },
      {
        title: 'New Registrations',
        value: overview.currentMetrics.newRegistrations || 0,
        link: { prefix: 'View', url: '#', text: 'details' },
        icon: { name: 'material-symbols:person-add-outline', color: 'success' },
      },
      {
        title: 'Total Matches',
        value: overview.currentMetrics.totalMatches || 0,
        link: { prefix: 'View', url: '#', text: 'details' },
        icon: { name: 'material-symbols:favorite-outline', color: 'error' },
      },
      {
        title: 'Total Messages',
        value: overview.currentMetrics.totalMessages || 0,
        link: { prefix: 'View', url: '#', text: 'details' },
        icon: { name: 'material-symbols:chat-outline', color: 'info' },
      },
    );
  }

  if (dashboard) {
    if (dashboard.users) {
      kpis.push({
        title: 'Total Users',
        value: dashboard.users.total || 0,
        link: { prefix: 'View', url: '#', text: 'all users' },
        icon: { name: 'material-symbols:people-outline', color: 'primary' },
      });
    }
    if (dashboard.reports) {
      kpis.push({
        title: 'Pending Reports',
        value: dashboard.reports.pending || 0,
        link: { prefix: 'View', url: '#', text: 'reports' },
        icon: { name: 'material-symbols:flag-outline', color: 'warning' },
      });
    }
  }

  // Add support tickets count (always show, even if 0)
  kpis.push({
    title: 'Support Tickets',
    value: supportTicketsCount,
    link: { prefix: 'View', url: '#', text: 'all tickets' },
    icon: { name: 'material-symbols:support-agent-outline', color: 'info' },
  });

  return (
    <Grid container spacing={3}>
      {kpis.length > 0 ? (
        kpis.map((kpi, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <AnalyticKPI kpi={kpi} />
          </Grid>
        ))
      ) : (
        <Grid size={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Analytics Dashboard
            </Typography>
            <Typography color="text.secondary">
              No analytics data available. Make sure the Analytics Service is running.
            </Typography>
          </Paper>
        </Grid>
      )}

      {/* Revenue Chart */}
      <Grid size={{ xs: 12, lg: 8 }}>
        <Paper sx={{ p: 3, height: 400 }}>
          <Typography variant="h6" gutterBottom>
            Revenue Trends (Last 30 Days)
          </Typography>
          <Box sx={{ height: 320, mt: 2 }}>
            {revenueData?.timeline && revenueData.timeline.length > 0 ? (
              <ReactEchart
                echarts={echarts}
                option={{
                  tooltip: {
                    trigger: 'axis',
                    formatter: (params: any) => {
                      const param = params[0];
                      return `${param.name}<br/>$${param.value.toFixed(2)}`;
                    },
                  },
                  xAxis: {
                    type: 'category',
                    data: revenueData.timeline.map((item: any) =>
                      dayjs(item.date).format('MMM DD'),
                    ),
                    axisLabel: { rotate: 45 },
                  },
                  yAxis: {
                    type: 'value',
                    axisLabel: {
                      formatter: (value: number) => `$${value.toFixed(0)}`,
                    },
                  },
                  series: [
                    {
                      name: 'Revenue',
                      type: 'line',
                      smooth: true,
                      data: revenueData.timeline.map((item: any) => item.revenue || 0),
                      areaStyle: {
                        color: {
                          type: 'linear',
                          x: 0,
                          y: 0,
                          x2: 0,
                          y2: 1,
                          colorStops: [
                            { offset: 0, color: 'rgba(25, 118, 210, 0.3)' },
                            { offset: 1, color: 'rgba(25, 118, 210, 0.05)' },
                          ],
                        },
                      },
                      lineStyle: { width: 2, color: '#1976d2' },
                    },
                  ],
                  grid: { left: 60, right: 20, top: 20, bottom: 60 },
                }}
              />
            ) : (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                sx={{ height: '100%', color: 'text.secondary' }}
              >
                <Typography>No revenue data available</Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Revenue (30 Days)
              </Typography>
              <Typography variant="h6" color="primary">
                $
                {revenueData?.summary?.totalRevenue?.toFixed(2) ||
                  overview?.businessMetrics?.totalRevenue30Days?.toFixed(2) ||
                  '0.00'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Avg Revenue Per User
              </Typography>
              <Typography variant="h6">
                $
                {revenueData?.summary?.averageRevenuePerUser?.toFixed(2) ||
                  overview?.businessMetrics?.avgRevenuePerUser?.toFixed(2) ||
                  '0.00'}
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Grid>

      {/* User Retention Chart */}
      <Grid size={{ xs: 12, lg: 4 }}>
        <Paper sx={{ p: 3, height: 400 }}>
          <Typography variant="h6" gutterBottom>
            User Retention
          </Typography>
          <Box sx={{ height: 280, mt: 2 }}>
            {overview?.businessMetrics ? (
              <ReactEchart
                echarts={echarts}
                option={{
                  tooltip: {
                    trigger: 'item',
                    formatter: '{b}: {c}%',
                  },
                  series: [
                    {
                      type: 'bar',
                      data: [
                        {
                          value: parseFloat(
                            ((overview.businessMetrics?.userRetentionDay7 || 0) * 100).toFixed(1),
                          ),
                          name: 'Day 7',
                          itemStyle: { color: '#1976d2' },
                        },
                        {
                          value: parseFloat(
                            ((overview.businessMetrics?.userRetentionDay30 || 0) * 100).toFixed(1),
                          ),
                          name: 'Day 30',
                          itemStyle: { color: '#2e7d32' },
                        },
                      ],
                      label: {
                        show: true,
                        position: 'top',
                        formatter: '{c}%',
                      },
                    },
                  ],
                  xAxis: {
                    type: 'category',
                    data: ['Day 7', 'Day 30'],
                  },
                  yAxis: {
                    type: 'value',
                    max: 100,
                    axisLabel: {
                      formatter: '{value}%',
                    },
                  },
                  grid: { left: 50, right: 20, top: 40, bottom: 20 },
                }}
              />
            ) : (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                sx={{ height: '100%', color: 'text.secondary' }}
              >
                <Typography>No retention data available</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>

      {/* Active Users Chart */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper sx={{ p: 3, height: 350 }}>
          <Typography variant="h6" gutterBottom>
            Active Users (Last 7 Days)
          </Typography>
          <Box sx={{ height: 270, mt: 2 }}>
            {activeUsersData?.breakdown && activeUsersData.breakdown.length > 0 ? (
              <ReactEchart
                echarts={echarts}
                option={{
                  tooltip: {
                    trigger: 'axis',
                    formatter: (params: any) => {
                      const param = params[0];
                      return `${param.name}<br/>Active Users: ${param.value}`;
                    },
                  },
                  xAxis: {
                    type: 'category',
                    data: activeUsersData.breakdown.map((item: any) =>
                      dayjs(item.startDate).format('MMM DD'),
                    ),
                  },
                  yAxis: {
                    type: 'value',
                  },
                  series: [
                    {
                      name: 'Active Users',
                      type: 'bar',
                      data: activeUsersData.breakdown.map((item: any) => item.activeUsers || 0),
                      itemStyle: {
                        color: {
                          type: 'linear',
                          x: 0,
                          y: 0,
                          x2: 0,
                          y2: 1,
                          colorStops: [
                            { offset: 0, color: '#42a5f5' },
                            { offset: 1, color: '#1976d2' },
                          ],
                        },
                        borderRadius: [4, 4, 0, 0],
                      },
                    },
                  ],
                  grid: { left: 50, right: 20, top: 20, bottom: 40 },
                }}
              />
            ) : (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                sx={{ height: '100%', color: 'text.secondary' }}
              >
                <Typography>No active users data available</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>

      {/* User Growth Chart */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper sx={{ p: 3, height: 350 }}>
          <Typography variant="h6" gutterBottom>
            User Growth (Last 30 Days)
          </Typography>
          <Box sx={{ height: 270, mt: 2 }}>
            {overview?.trends?.userGrowth && overview.trends.userGrowth.length > 0 ? (
              <ReactEchart
                echarts={echarts}
                option={{
                  tooltip: {
                    trigger: 'axis',
                    formatter: (params: any) => {
                      const param = params[0];
                      return `${param.name}<br/>New Users: ${param.value}`;
                    },
                  },
                  xAxis: {
                    type: 'category',
                    data: overview.trends.userGrowth.map((item: any) =>
                      dayjs(item.date).format('MMM DD'),
                    ),
                  },
                  yAxis: {
                    type: 'value',
                  },
                  series: [
                    {
                      name: 'New Users',
                      type: 'line',
                      smooth: true,
                      data: overview.trends.userGrowth.map((item: any) => item.newUsers || 0),
                      lineStyle: { width: 3, color: '#2e7d32' },
                      itemStyle: { color: '#2e7d32' },
                      areaStyle: {
                        color: {
                          type: 'linear',
                          x: 0,
                          y: 0,
                          x2: 0,
                          y2: 1,
                          colorStops: [
                            { offset: 0, color: 'rgba(46, 125, 50, 0.3)' },
                            { offset: 1, color: 'rgba(46, 125, 50, 0.05)' },
                          ],
                        },
                      },
                    },
                  ],
                  grid: { left: 50, right: 20, top: 20, bottom: 40 },
                }}
              />
            ) : (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                sx={{ height: '100%', color: 'text.secondary' }}
              >
                <Typography>No user growth data available</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>

      {dashboard && (
        <>
          {dashboard.moderation && (
            <Grid size={{ xs: 12, lg: 6 }}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Moderation Stats
                </Typography>
                <Typography variant="body1">
                  Total Actions: {dashboard.moderation.totalActions || 0}
                </Typography>
                <Typography variant="body1">
                  Pending Reports: {dashboard.reports?.pending || 0}
                </Typography>
              </Paper>
            </Grid>
          )}

          {dashboard.support && (
            <Grid size={{ xs: 12, lg: 6 }}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Support Stats
                </Typography>
                <Typography variant="body1">
                  Open Tickets: {dashboard.support.openTickets || 0}
                </Typography>
                <Typography variant="body1">
                  Avg Response Time: {dashboard.support.avgResponseTime?.toFixed(1) || '0'} hours
                </Typography>
              </Paper>
            </Grid>
          )}
        </>
      )}
    </Grid>
  );
};

export default Analytics;
