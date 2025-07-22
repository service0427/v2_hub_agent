import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { Platform } from '../types';

// Validate platform parameter
export const validatePlatform = (req: Request, res: Response, next: NextFunction) => {
  const { platform } = req.params;
  const validPlatforms: Platform[] = ['coupang', 'naver_store', 'naver_compare'];

  if (!platform || !validPlatforms.includes(platform as Platform)) {
    throw new AppError('Invalid platform. Must be one of: coupang, naver_store, naver_compare', 400);
  }

  next();
};

// Validate ranking request
export const validateRankingRequest = (req: Request, res: Response, next: NextFunction) => {
  const { keyword, code } = req.query;

  if (!keyword || typeof keyword !== 'string') {
    throw new AppError('Keyword parameter is required', 400);
  }

  if (!code || typeof code !== 'string') {
    throw new AppError('Product code parameter is required', 400);
  }

  next();
};

// Validate workflow request
export const validateWorkflowRequest = (req: Request, res: Response, next: NextFunction) => {
  const { workflow, params } = req.body;

  if (!workflow || typeof workflow !== 'string') {
    throw new AppError('Workflow name is required', 400);
  }

  if (!params || typeof params !== 'object') {
    throw new AppError('Workflow params are required', 400);
  }

  if (!params.keyword || typeof params.keyword !== 'string') {
    throw new AppError('Keyword parameter is required in params', 400);
  }

  next();
};