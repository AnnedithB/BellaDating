import express from 'express';
import { config } from 'dotenv';
import winston from 'winston';
import { ETLPipeline } from './etl/pipeline';

// Load environment variables
config();

// Setup logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();
const port = process.env.ETL_PORT || 3010;

// Initialize ETL Pipeline
const etlPipeline = new ETLPipeline();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'analytics-etl',
    version: '1.0.0'
  });
});

// Manual ETL trigger endpoints (for testing/debugging)
app.post('/trigger/daily', async (req, res) => {
  try {
    logger.info('Manual daily ETL trigger requested');
    await etlPipeline.runDailyKPIJob();
    res.json({ success: true, message: 'Daily ETL job completed' });
  } catch (error) {
    logger.error('Manual daily ETL failed:', error);
    res.status(500).json({ success: false, error: 'ETL job failed' });
  }
});

app.post('/trigger/hourly', async (req, res) => {
  try {
    logger.info('Manual hourly ETL trigger requested');
    await etlPipeline.runHourlyBehaviorJob();
    res.json({ success: true, message: 'Hourly ETL job completed' });
  } catch (error) {
    logger.error('Manual hourly ETL failed:', error);
    res.status(500).json({ success: false, error: 'ETL job failed' });
  }
});

// Start ETL pipeline with cron jobs
async function startETLPipeline() {
  try {
    logger.info('Starting ETL Pipeline...');
    await etlPipeline.start();
    logger.info('ETL Pipeline started successfully');
  } catch (error) {
    logger.error('Failed to start ETL Pipeline:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  etlPipeline.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  etlPipeline.stop();
  process.exit(0);
});

// Start server and ETL pipeline
app.listen(port, async () => {
  logger.info(`ETL Pipeline server running on port ${port}`);
  logger.info(`Health check available at http://localhost:${port}/health`);
  await startETLPipeline();
});

export default app;