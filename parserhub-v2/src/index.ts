import http from 'http';
import { createApp } from './app';
import { setupSocketServer } from './socket';
import { config } from './config';
import { logger } from './utils/logger';
import { testConnection } from './db/pool';
import { redis } from './db/redis';
import { schedulerService } from './services/schedulerService';

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }

    // Test Redis connection
    await redis.ping();
    logger.info('Redis connected');

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const server = http.createServer(app);

    // Setup Socket.io
    const io = setupSocketServer(server);

    // Start server
    server.listen(config.server.port, () => {
      logger.info(`ParserHub v2 API running on port ${config.server.port}`);
      logger.info(`Socket.io listening on port ${config.server.socketPort}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Dev mode: ${config.devMode}`);
      logger.info(`Scheduler enabled: ${config.scheduler.enabled}`);
    });

    // Start scheduler if enabled
    if (config.scheduler.enabled) {
      await schedulerService.start();
    }

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      // Stop scheduler
      schedulerService.stop();

      server.close(() => {
        logger.info('HTTP server closed');
      });

      io.close(() => {
        logger.info('Socket.io server closed');
      });

      await redis.quit();
      logger.info('Redis connection closed');

      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      
      // Stop scheduler
      schedulerService.stop();

      server.close(() => {
        logger.info('HTTP server closed');
      });

      io.close(() => {
        logger.info('Socket.io server closed');
      });

      await redis.quit();
      logger.info('Redis connection closed');

      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();