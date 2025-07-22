import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  server: {
    port: parseInt(process.env.PORT || '8445', 10),
    socketPort: parseInt(process.env.SOCKET_PORT || '8446', 10),
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'techb_pp',
    password: process.env.DB_PASS || 'Tech1324!',
    database: process.env.DB_NAME || 'productparser_db',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
  },
  api: {
    key: process.env.API_KEY || 'YOUR_API_KEY_HERE',
    publicKey: process.env.PUBLIC_API_KEY || 'YOUR_PUBLIC_API_KEY_HERE',
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  agent: {
    heartbeatInterval: parseInt(process.env.AGENT_HEARTBEAT_INTERVAL || '30000', 10),
    timeout: parseInt(process.env.AGENT_TIMEOUT || '60000', 10),
  },
  devMode: process.env.DEV_MODE === 'true',
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED === 'true',
    intervalHours: parseInt(process.env.SCHEDULER_INTERVAL_HOURS || '1', 10),
    rankingCrawlSchedule: process.env.SCHEDULER_RANKING_CRAWL || '0 * * * *', // Default: every hour
    maxConcurrentJobs: parseInt(process.env.SCHEDULER_MAX_CONCURRENT_JOBS || '3', 10),
  },
};