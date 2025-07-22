import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { clearCache } from '../db/redis';
import { pool, query } from '../db/pool';
import { agentManager } from '../socket/agentManager';

const router = Router();

// Apply authentication
router.use(authenticateApiKey);

// System statistics
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const agents = agentManager.getAllAgents();
  const tasks = agentManager.getTasks();
  
  const stats = {
    agents: {
      total: agents.length,
      online: agents.filter(a => a.status === 'online').length,
      offline: agents.filter(a => a.status === 'offline').length,
      busy: agents.filter(a => a.status === 'busy').length,
    },
    tasks: {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    },
    database: {
      poolSize: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
    },
  };

  res.json({
    success: true,
    data: stats,
    timestamp: new Date(),
  });
}));

// Clear all cache
router.delete('/cache/all', asyncHandler(async (req: Request, res: Response) => {
  await clearCache();
  
  res.json({
    success: true,
    message: 'All cache cleared',
    timestamp: new Date(),
  });
}));

// Clear specific cache pattern
router.delete('/cache/pattern', asyncHandler(async (req: Request, res: Response) => {
  const { pattern } = req.body;
  
  if (!pattern) {
    throw new Error('Pattern is required');
  }
  
  await clearCache(pattern);
  
  res.json({
    success: true,
    message: `Cache cleared for pattern: ${pattern}`,
    timestamp: new Date(),
  });
}));

// Database health check
router.get('/db/health', asyncHandler(async (req: Request, res: Response) => {
  const result = await query('SELECT NOW() as time, version() as version');
  
  res.json({
    success: true,
    data: result.length > 0 ? result[0] : null,
    timestamp: new Date(),
  });
}));

export default router;