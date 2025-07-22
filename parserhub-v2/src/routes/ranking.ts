import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { validatePlatform, validateRankingRequest } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { rankingService } from '../services/rankingService';
import { RankingRequest } from '../types';

const router = Router();

// Apply authentication to all ranking routes
router.use(authenticateApiKey);

// Get product ranking
router.get('/:platform', 
  validatePlatform,
  validateRankingRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { platform } = req.params;
    const { keyword, code, limit } = req.query;

    const request: RankingRequest = {
      platform: platform as any,
      keyword: keyword as string,
      code: code as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
    };

    const result = await rankingService.getRanking(request);
    res.json(result);
  })
);

// Batch ranking check
router.post('/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const { requests } = req.body;

    if (!Array.isArray(requests)) {
      throw new AppError('Requests must be an array', 400);
    }

    if (requests.length > 20) {
      throw new AppError('Maximum 20 requests allowed per batch', 400);
    }

    const results = await Promise.all(
      requests.map(request => rankingService.getRanking(request))
    );

    res.json({
      success: true,
      data: results,
      timestamp: new Date(),
    });
  })
);

// Clear ranking cache
router.delete('/cache/:platform',
  validatePlatform,
  asyncHandler(async (req: Request, res: Response) => {
    const { platform } = req.params;
    const { keyword } = req.query;

    await rankingService.clearCache(platform as any, keyword as string);

    res.json({
      success: true,
      message: 'Cache cleared',
      timestamp: new Date(),
    });
  })
);

export default router;