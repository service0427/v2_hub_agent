import { Router, Request, Response } from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { searchService } from '../services/searchService';

const router = Router();

// Debug middleware
router.use((req, res, next) => {
  console.log(`Legacy workflow router: ${req.method} ${req.path}`);
  next();
});

// Apply authentication
router.use(authenticateApiKey);

// Test endpoint
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Legacy workflow router is working!' });
});

// Legacy Coupang endpoint
router.post('/coupang-search', asyncHandler(async (req: Request, res: Response) => {
  const { keyword, limit = 10 } = req.body;

  if (!keyword) {
    throw new AppError('Keyword is required', 400);
  }

  const result = await searchService.search('coupang', keyword, limit);
  
  res.json({
    success: true,
    cached: false,
    data: result,
    timestamp: new Date(),
  });
}));

// Legacy Naver Store endpoint
router.post('/naver-store-search', asyncHandler(async (req: Request, res: Response) => {
  const { keyword, limit = 10 } = req.body;

  if (!keyword) {
    throw new AppError('Keyword is required', 400);
  }

  const result = await searchService.search('naver_store', keyword, limit);
  
  res.json({
    success: true,
    cached: false,
    data: result,
    timestamp: new Date(),
  });
}));

// Legacy Naver Compare endpoint
router.post('/naver-compare-search', asyncHandler(async (req: Request, res: Response) => {
  const { keyword, limit = 10 } = req.body;

  if (!keyword) {
    throw new AppError('Keyword is required', 400);
  }

  const result = await searchService.search('naver_compare', keyword, limit);
  
  res.json({
    success: true,
    cached: false,
    data: result,
    timestamp: new Date(),
  });
}));

// Catch-all for debugging
router.all('*', (req: Request, res: Response) => {
  console.log(`Legacy workflow catch-all: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: `Legacy endpoint not found: ${req.path}`,
    timestamp: new Date(),
  });
});

export default router;