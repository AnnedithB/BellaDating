#!/usr/bin/env node

/**
 * ETL Pipeline Service Runner
 * 
 * This script starts the ETL pipeline service as a standalone process.
 * It can be run in Docker containers or as a scheduled service.
 */

import express from 'express';
import { etlPipeline } from './pipeline';

// Environment configuration
const NODE_ENV: string = process.env.NODE_ENV || 'development';

console.log(`Starting ETL Pipeline Service in ${NODE_ENV} mode...`);

// Health check endpoint for container orchestration
const app = express();
const port = process.env.ETL_PORT || 3010;

app.use(express.json());

// Health check endpoint
app.get('/health', (req: any, res: any) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'etl-pipeline',
    version: '1.0.0'
  });
});

// ETL job status endpoint
app.get('/api/etl/status', async (req: any, res: any) => {
  try {
    const history = await etlPipeline.getJobHistory(undefined, 10);
    res.json({
      recentJobs: history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch ETL status',
      message: (error as Error).message
    });
  }
});

// Manual job trigger endpoint (for admin/testing)
app.post('/api/etl/run/:jobType', async (req: any, res: any) => {
  const { jobType } = req.params;
  
  try {
    await etlPipeline.runJobManually(jobType);
    res.json({
      message: `ETL job ${jobType} started successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      error: 'Failed to start ETL job',
      message: (error as Error).message
    });
  }
});

// Data quality alerts endpoint
app.get('/api/etl/alerts', async (req: any, res: any) => {
  try {
    const isResolved = req.query.resolved ? req.query.resolved === 'true' : undefined;
    const alerts = await etlPipeline.getDataQualityAlerts(isResolved);
    res.json({
      alerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch data quality alerts',
      message: (error as Error).message
    });
  }
});

// Start the health check server
app.listen(port, () => {
  console.log(`ETL Pipeline health check server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`ETL status: http://localhost:${port}/api/etl/status`);
  console.log(`ETL alerts: http://localhost:${port}/api/etl/alerts`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Keep the process alive
console.log('ETL Pipeline service started successfully');
console.log('Scheduled jobs are now running according to cron schedules');
console.log('- Daily KPI aggregation: 1 AM UTC');
console.log('- Hourly behavior events: Every hour at minute 5');
console.log('- Weekly retention analysis: Monday 2 AM UTC');
console.log('- Session analytics: Every 15 minutes');