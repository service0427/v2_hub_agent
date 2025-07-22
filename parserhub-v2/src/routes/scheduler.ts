import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { schedulerService } from '../services/schedulerService';
import { MonitoringKeywordModel } from '../models/MonitoringKeyword';
import { SchedulerLogModel } from '../models/SchedulerLog';
import { Platform } from '../types';

const router = Router();

// Apply admin authentication
router.use(authenticateApiKey);

// Get scheduler status
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const logs = await SchedulerLogModel.getRecentLogs(10);
  const keywords = await MonitoringKeywordModel.findAll();

  res.json({
    success: true,
    data: {
      enabled: process.env.SCHEDULER_ENABLED === 'true',
      activeKeywords: keywords.filter(k => k.isActive).length,
      totalKeywords: keywords.length,
      recentLogs: logs,
    },
    timestamp: new Date(),
  });
}));

// Get monitoring keywords
router.get('/keywords', asyncHandler(async (req: Request, res: Response) => {
  const keywords = await MonitoringKeywordModel.findAll(true);

  res.json({
    success: true,
    data: keywords,
    count: keywords.length,
    timestamp: new Date(),
  });
}));

// Add new monitoring keyword
router.post('/keywords', asyncHandler(async (req: Request, res: Response) => {
  const { keyword, platform, priority, intervalHours } = req.body;

  if (!keyword || !platform) {
    throw new AppError('Keyword and platform are required', 400);
  }

  const validPlatforms: Platform[] = ['coupang', 'naver_store', 'naver_compare'];
  if (!validPlatforms.includes(platform)) {
    throw new AppError('Invalid platform', 400);
  }

  const newKeyword = await MonitoringKeywordModel.create(
    keyword,
    platform,
    priority || 2,
    intervalHours || 1
  );

  res.json({
    success: true,
    data: newKeyword,
    message: 'Monitoring keyword added successfully',
    timestamp: new Date(),
  });
}));

// Deactivate monitoring keyword
router.delete('/keywords/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    throw new AppError('Invalid keyword ID', 400);
  }

  await MonitoringKeywordModel.deactivate(id);

  res.json({
    success: true,
    message: 'Monitoring keyword deactivated',
    timestamp: new Date(),
  });
}));

// Get scheduler logs
router.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const jobType = req.query.jobType as string;

  const logs = jobType
    ? await SchedulerLogModel.getLogsByJobType(jobType, limit)
    : await SchedulerLogModel.getRecentLogs(limit);

  res.json({
    success: true,
    data: logs,
    count: logs.length,
    timestamp: new Date(),
  });
}));

// Manually trigger ranking crawl
router.post('/trigger/ranking-crawl', asyncHandler(async (req: Request, res: Response) => {
  // Start async operation
  schedulerService.triggerRankingCrawl().catch(error => {
    console.error('Manual ranking crawl failed:', error);
  });

  res.json({
    success: true,
    message: 'Ranking crawl triggered',
    timestamp: new Date(),
  });
}));

// Manually trigger cache cleanup
router.post('/trigger/cache-cleanup', asyncHandler(async (req: Request, res: Response) => {
  // Start async operation
  schedulerService.triggerCacheCleanup().catch(error => {
    console.error('Manual cache cleanup failed:', error);
  });

  res.json({
    success: true,
    message: 'Cache cleanup triggered',
    timestamp: new Date(),
  });
}));

// Manually trigger log cleanup
router.post('/trigger/log-cleanup', asyncHandler(async (req: Request, res: Response) => {
  // Start async operation
  schedulerService.triggerLogCleanup().catch(error => {
    console.error('Manual log cleanup failed:', error);
  });

  res.json({
    success: true,
    message: 'Log cleanup triggered',
    timestamp: new Date(),
  });
}));

// Get keywords due for crawl
router.get('/keywords/due', asyncHandler(async (req: Request, res: Response) => {
  const keywords = await MonitoringKeywordModel.findDueForCrawl();

  res.json({
    success: true,
    data: keywords,
    count: keywords.length,
    timestamp: new Date(),
  });
}));

export default router;