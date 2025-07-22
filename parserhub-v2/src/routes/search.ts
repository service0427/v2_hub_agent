import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { searchService } from '../services/searchService';
import { Platform } from '../types';

const router = Router();

// Debug middleware
router.use((req, res, next) => {
  console.log(`Search router: ${req.method} ${req.path}`);
  next();
});

// Apply authentication
router.use(authenticateApiKey);

// Search products
router.post('/:platform',
  asyncHandler(async (req: Request, res: Response) => {
    const platform = req.params.platform as Platform;
    const { keyword, limit = 10 } = req.body;

    // Validate platform
    const validPlatforms: Platform[] = ['coupang', 'naver_store', 'naver_compare'];
    if (!validPlatforms.includes(platform)) {
      throw new AppError('Invalid platform', 400);
    }

    if (!keyword || typeof keyword !== 'string') {
      throw new AppError('Keyword is required', 400);
    }

    const result = await searchService.search(platform, keyword, limit);
    
    res.json({
      success: true,
      cached: false,
      data: result,
      timestamp: new Date(),
    });
  })
);


export default router;