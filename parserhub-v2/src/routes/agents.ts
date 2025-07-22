import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { agentManager } from '../socket/agentManager';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Apply authentication
router.use(authenticateApiKey);

// Get all agents
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, platform } = req.query;
  
  let agents = agentManager.getAllAgents();
  
  if (status) {
    agents = agents.filter(agent => agent.status === status);
  }
  
  if (platform) {
    agents = agents.filter(agent => agent.platform === platform);
  }

  res.json({
    success: true,
    data: agents,
    count: agents.length,
    timestamp: new Date(),
  });
}));

// Get specific agent
router.get('/:agentId', asyncHandler(async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const agent = agentManager.getAgent(agentId);

  if (!agent) {
    throw new AppError('Agent not found', 404);
  }

  res.json({
    success: true,
    data: agent,
    timestamp: new Date(),
  });
}));

// Get agent tasks
router.get('/:agentId/tasks', asyncHandler(async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { status } = req.query;

  const tasks = agentManager.getTasks(status as any);
  const agentTasks = tasks.filter(task => task.agentId === agentId);

  res.json({
    success: true,
    data: agentTasks,
    count: agentTasks.length,
    timestamp: new Date(),
  });
}));

// Get all tasks
router.get('/tasks/all', asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;
  const tasks = agentManager.getTasks(status as any);

  res.json({
    success: true,
    data: tasks,
    count: tasks.length,
    timestamp: new Date(),
  });
}));

// Cleanup old tasks
router.post('/tasks/cleanup', asyncHandler(async (req: Request, res: Response) => {
  const { hours = 24 } = req.body;
  const cleaned = agentManager.cleanupTasks(hours);

  res.json({
    success: true,
    message: `Cleaned up ${cleaned} old tasks`,
    timestamp: new Date(),
  });
}));

// Get agent pool status
router.get('/pool/status', asyncHandler(async (req: Request, res: Response) => {
  const poolStatus = agentManager.getPoolStatus();
  
  res.json({
    success: true,
    data: poolStatus,
    timestamp: new Date(),
  });
}));

// Get specific host status
router.get('/host/:ip', asyncHandler(async (req: Request, res: Response) => {
  const { ip } = req.params;
  const hostStatus = agentManager.getHostStatus(ip);
  
  if (!hostStatus) {
    throw new AppError('Host not found', 404);
  }
  
  res.json({
    success: true,
    data: hostStatus,
    timestamp: new Date(),
  });
}));

// Debug allocation
router.get('/debug/allocation', asyncHandler(async (req: Request, res: Response) => {
  agentManager.debugAllocation();
  
  res.json({
    success: true,
    message: 'Debug information printed to console',
    timestamp: new Date(),
  });
}));

export default router;