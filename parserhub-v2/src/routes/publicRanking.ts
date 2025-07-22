import { Router, Request, Response } from 'express';
import { authenticatePublicApiKey } from '../middleware/auth';
import { validatePlatform } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { rankingService } from '../services/rankingService';
import { workflowService } from '../services/workflowService';
import { PublicRankingRequest, WorkflowRequest } from '../types';

const router = Router();

// Apply public API authentication (wraps async middleware)
router.use(asyncHandler(authenticatePublicApiKey));

// Get product ranking (public API)
router.get('/:platform',
  validatePlatform,
  asyncHandler(async (req: Request, res: Response) => {
    const { platform } = req.params;
    const { keyword, code, realtime } = req.query;

    if (!keyword || typeof keyword !== 'string') {
      throw new AppError('Keyword parameter is required', 400);
    }

    if (!code || typeof code !== 'string') {
      throw new AppError('Product code parameter is required', 400);
    }

    const request: PublicRankingRequest = {
      platform: platform as any,
      keyword,
      code,
      realtime: realtime === 'true',
    };

    // First, check cache
    let result = await rankingService.getRanking({
      platform: request.platform,
      keyword: request.keyword,
      code: request.code,
    });

    // If not found in cache and realtime is requested
    if (!result.success && request.realtime) {
      // Execute workflow to get fresh data
      const workflowRequest: WorkflowRequest = {
        platform: request.platform,
        workflow: 'search',
        params: {
          keyword: request.keyword,
          pages: 1, // Only crawl first page for public API
          ignoreCache: true,
        },
      };

      const workflowResult = await workflowService.executeWorkflow(workflowRequest);
      
      if (workflowResult.success) {
        // Wait a bit for the data to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try again from cache
        result = await rankingService.getRanking({
          platform: request.platform,
          keyword: request.keyword,
          code: request.code,
        });
      }
    }

    res.json(result);
  })
);

// Get ranking history
router.get('/:platform/history',
  validatePlatform,
  asyncHandler(async (req: Request, res: Response) => {
    const { platform } = req.params;
    const { keyword, code, days } = req.query;

    if (!keyword || typeof keyword !== 'string') {
      throw new AppError('Keyword parameter is required', 400);
    }

    if (!code || typeof code !== 'string') {
      throw new AppError('Product code parameter is required', 400);
    }

    const daysNum = days ? parseInt(days as string, 10) : 7;
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      throw new AppError('Days must be between 1 and 365', 400);
    }

    const history = await rankingService.getRankingHistory(
      platform as any,
      keyword,
      code,
      daysNum
    );

    res.json({
      success: true,
      data: history,
      timestamp: new Date(),
    });
  })
);

// Get top competitors
router.get('/:platform/competitors',
  validatePlatform,
  asyncHandler(async (req: Request, res: Response) => {
    const { platform } = req.params;
    const { keyword, limit } = req.query;

    if (!keyword || typeof keyword !== 'string') {
      throw new AppError('Keyword parameter is required', 400);
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 10;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new AppError('Limit must be between 1 and 100', 400);
    }

    const competitors = await rankingService.getTopCompetitors(
      platform as any,
      keyword,
      limitNum
    );

    res.json({
      success: true,
      data: competitors,
      timestamp: new Date(),
    });
  })
);

export default router;