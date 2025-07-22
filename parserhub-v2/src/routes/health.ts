import { Router, Request, Response } from 'express';
import { testConnection } from '../db/pool';
import { redis } from '../db/redis';
import { agentManager } from '../socket/agentManager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Basic health check
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'ParserHub v2 API is running',
    timestamp: new Date(),
  });
});

// Detailed health check
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const dbHealthy = await testConnection();
  
  let redisHealthy = false;
  try {
    await redis.ping();
    redisHealthy = true;
  } catch (error) {
    // Redis not healthy
  }

  const agents = agentManager.getAllAgents();
  const onlineAgents = agents.filter(a => a.status === 'online').length;

  res.json({
    success: true,
    services: {
      api: 'healthy',
      database: dbHealthy ? 'healthy' : 'unhealthy',
      redis: redisHealthy ? 'healthy' : 'unhealthy',
      agents: {
        total: agents.length,
        online: onlineAgents,
        status: onlineAgents > 0 ? 'healthy' : 'degraded',
      },
    },
    timestamp: new Date(),
  });
}));

export default router;