import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { httpLogStream } from './utils/logger';

// Import routes
import healthRouter from './routes/health';
import rankingRouter from './routes/ranking';
import publicRankingRouter from './routes/publicRanking';
import agentRouter from './routes/agents';
import workflowRouter from './routes/workflows';
import adminRouter from './routes/admin';
import schedulerRouter from './routes/scheduler';
import searchRouter from './routes/search';
// import apiKeysRouter from './routes/apiKeys';
import legacyWorkflowRouter from './routes/legacyWorkflow';

export const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.cors.origin === '*' ? true : config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  }));

  // Compression
  app.use(compression());

  // Logging
  app.use(morgan('combined', { stream: httpLogStream }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Trust proxy
  app.set('trust proxy', 1);

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/v2/public/ranking', publicRankingRouter);
  app.use('/api/v2/ranking', rankingRouter);
  app.use('/api/v2/agents', agentRouter);
  app.use('/api/v2/workflows', workflowRouter);
  app.use('/api/v2/admin', adminRouter);
  app.use('/api/v2/scheduler', schedulerRouter);
  app.use('/api/v2/search', searchRouter);
  // app.use('/api/v2/api-keys', apiKeysRouter);
  
  // Legacy API support (v1 compatibility)
  app.use('/api/workflow', legacyWorkflowRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      timestamp: new Date(),
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};