import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { AppError } from './errorHandler';
import { ApiKey, ApiKeyModel, ApiKeyRecord } from '../models/ApiKey';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKey?: string;
      apiKeyRecord?: ApiKeyRecord;
    }
  }
}

export const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;

  if (!apiKey) {
    throw new AppError('API key required', 401);
  }

  if (apiKey !== config.api.key) {
    throw new AppError('Invalid API key', 401);
  }

  req.apiKey = apiKey;
  next();
};

// Optional auth middleware (for endpoints that work with or without auth)
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;

  if (apiKey) {
    if (apiKey === config.api.key) {
      req.apiKey = apiKey;
    }
  }

  next();
};

// Public API key authentication (uses v2_api_keys table)
export const authenticatePublicApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  try {
    // Get API key from URL parameter 'key' (like ?key=xxx)
    const apiKey = req.query.key as string;

    if (!apiKey) {
      return next(new AppError('API key required', 401));
    }

    // Get API key record from v2_api_keys table
    const apiKeyRecord = await ApiKeyModel.findByKey(apiKey);
    
    if (!apiKeyRecord) {
      return next(new AppError('Invalid API key', 401));
    }

    // Check rate limits
    const [hourlyOk, dailyOk] = await Promise.all([
      ApiKeyModel.checkRateLimit(apiKeyRecord.id, apiKeyRecord.rateLimit),
      ApiKeyModel.checkDailyLimit(apiKeyRecord.id, apiKeyRecord.dailyLimit)
    ]);

    if (!hourlyOk) {
      return next(new AppError(`Rate limit exceeded. Maximum ${apiKeyRecord.rateLimit} requests per hour`, 429));
    }

    if (!dailyOk) {
      return next(new AppError(`Daily limit exceeded. Maximum ${apiKeyRecord.dailyLimit} requests per day`, 429));
    }

    // Store API key info in request
    req.apiKey = apiKey;
    req.apiKeyRecord = apiKeyRecord;

    // Log usage after response is sent
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      ApiKeyModel.logUsage({
        apiKeyId: apiKeyRecord.id,
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        responseTimeMs: responseTime,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestParams: {
          query: req.query,
          body: req.body,
          params: req.params
        }
      });
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError('Authentication failed', 401));
  }
};