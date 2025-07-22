import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateApiKey } from '../middleware/auth';
import { ApiKeyModel } from '../models/ApiKey';
import { query } from '../db/pool';

const router = Router();

// Get API key usage stats
router.get('/usage/:apiKey', authenticateApiKey, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { apiKey } = req.params;
  const days = parseInt(req.query.days as string) || 7;

  // Get API key record
  const apiKeyRecord = await ApiKeyModel.findByKey(apiKey);
  if (!apiKeyRecord) {
    res.status(404).json({
      success: false,
      error: 'API key not found'
    });
    return;
  }

  // Get usage stats
  const stats = await ApiKeyModel.getUsageStats(apiKeyRecord.id, days);

  // Get current hour and day usage
  const [hourlyUsage, dailyUsage] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM v2_api_usage 
       WHERE api_key_id = $1 
       AND created_at >= NOW() - INTERVAL '1 hour'`,
      [apiKeyRecord.id]
    ),
    query<{ total_requests: number }>(
      `SELECT COALESCE(total_requests, 0) as total_requests
       FROM v2_api_usage_daily
       WHERE api_key_id = $1 AND usage_date = CURRENT_DATE`,
      [apiKeyRecord.id]
    )
  ]);

  const currentHourUsage = parseInt(hourlyUsage[0].count);
  const currentDayUsage = dailyUsage.length > 0 ? dailyUsage[0].total_requests : 0;

  res.json({
    success: true,
    data: {
      apiKey: {
        clientName: apiKeyRecord.clientName,
        clientEmail: apiKeyRecord.clientEmail,
        rateLimit: apiKeyRecord.rateLimit,
        dailyLimit: apiKeyRecord.dailyLimit,
        createdAt: apiKeyRecord.createdAt,
        lastUsedAt: apiKeyRecord.lastUsedAt
      },
      currentUsage: {
        hourly: {
          used: currentHourUsage,
          limit: apiKeyRecord.rateLimit,
          remaining: Math.max(0, apiKeyRecord.rateLimit - currentHourUsage)
        },
        daily: {
          used: currentDayUsage,
          limit: apiKeyRecord.dailyLimit,
          remaining: Math.max(0, apiKeyRecord.dailyLimit - currentDayUsage)
        }
      },
      history: stats
    }
  });
}));

// Get all API keys (admin only)
router.get('/list', authenticateApiKey, asyncHandler(async (req: Request, res: Response) => {
  const apiKeys = await query(
    `SELECT 
      id,
      api_key as "apiKey",
      client_name as "clientName",
      client_email as "clientEmail",
      is_active as "isActive",
      rate_limit as "rateLimit",
      daily_limit as "dailyLimit",
      created_at as "createdAt",
      last_used_at as "lastUsedAt"
     FROM v2_api_keys
     ORDER BY created_at DESC`
  );

  res.json({
    success: true,
    data: apiKeys
  });
}));

// Create new API key (admin only)
router.post('/create', authenticateApiKey, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { clientName, clientEmail, rateLimit = 1000, dailyLimit = 10000 } = req.body;

  if (!clientName) {
    res.status(400).json({
      success: false,
      error: 'Client name is required'
    });
    return;
  }

  // Generate API key
  const apiKey = 'sk_live_' + Array.from({ length: 64 }, () => 
    'abcdef0123456789'[Math.floor(Math.random() * 16)]
  ).join('');

  const result = await query<{ id: number }>(
    `INSERT INTO v2_api_keys 
     (api_key, client_name, client_email, rate_limit, daily_limit)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [apiKey, clientName, clientEmail, rateLimit, dailyLimit]
  );

  res.json({
    success: true,
    data: {
      id: result[0].id,
      apiKey,
      clientName,
      clientEmail,
      rateLimit,
      dailyLimit
    }
  });
}));

// Update API key (admin only)
router.put('/:apiKey', authenticateApiKey, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { apiKey } = req.params;
  const { isActive, rateLimit, dailyLimit } = req.body;

  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (isActive !== undefined) {
    updates.push(`is_active = $${paramCount++}`);
    values.push(isActive);
  }
  if (rateLimit !== undefined) {
    updates.push(`rate_limit = $${paramCount++}`);
    values.push(rateLimit);
  }
  if (dailyLimit !== undefined) {
    updates.push(`daily_limit = $${paramCount++}`);
    values.push(dailyLimit);
  }

  if (updates.length === 0) {
    res.status(400).json({
      success: false,
      error: 'No updates provided'
    });
    return;
  }

  values.push(apiKey);
  const updateQuery = `
    UPDATE v2_api_keys 
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE api_key = $${paramCount}
  `;

  await query(updateQuery, values);

  res.json({
    success: true,
    message: 'API key updated successfully'
  });
}));

export default router;