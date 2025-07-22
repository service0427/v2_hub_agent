import { query } from '../db/pool';
import { logger } from '../utils/logger';

export interface ApiKeyRecord {
  id: number;
  apiKey: string;
  clientName: string;
  clientEmail?: string;
  isActive: boolean;
  rateLimit: number;
  dailyLimit: number;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  metadata?: any;
}

export interface ApiUsageRecord {
  id?: number;
  apiKeyId: number;
  endpoint: string;
  method: string;
  statusCode?: number;
  responseTimeMs?: number;
  ipAddress?: string;
  userAgent?: string;
  requestParams?: any;
  createdAt?: Date;
}

export class ApiKey {
  // Legacy method for backward compatibility
  static async validate(key: string): Promise<boolean> {
    const result = await query<{ is_active: boolean }>(
      `SELECT is_active FROM v2_api_keys WHERE api_key = $1 AND is_active = true`,
      [key]
    );

    return result.length > 0 && result[0].is_active;
  }

  // Legacy method for backward compatibility
  static async getByKey(key: string): Promise<any | null> {
    const result = await query<any>(
      `SELECT * FROM v2_api_keys WHERE api_key = $1`,
      [key]
    );

    return result.length > 0 ? result[0] : null;
  }

  // Legacy method for backward compatibility
  static async incrementUsage(key: string): Promise<void> {
    await query(
      `UPDATE v2_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE api_key = $1`,
      [key]
    );
  }
}

export class ApiKeyModel {
  static async findByKey(apiKey: string): Promise<ApiKeyRecord | null> {
    try {
      logger.debug(`Looking up API key: ${apiKey.substring(0, 10)}...`);
      
      const result = await query<any>(
        `SELECT 
          id,
          api_key as "apiKey",
          client_name as "clientName",
          client_email as "clientEmail",
          is_active as "isActive",
          rate_limit as "rateLimit",
          daily_limit as "dailyLimit",
          created_at as "createdAt",
          updated_at as "updatedAt",
          last_used_at as "lastUsedAt",
          metadata
         FROM v2_api_keys 
         WHERE api_key = $1 AND is_active = true`,
        [apiKey]
      );

      if (result.length === 0) {
        logger.debug('API key not found or inactive');
        return null;
      }

      // Update last used timestamp
      await query(
        `UPDATE v2_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [result[0].id]
      );

      logger.debug(`Found API key for client: ${result[0].clientName}`);
      return result[0];
    } catch (error) {
      logger.error('Error finding API key:', error);
      return null;
    }
  }

  static async logUsage(usage: ApiUsageRecord): Promise<void> {
    try {
      await query(
        `INSERT INTO v2_api_usage 
         (api_key_id, endpoint, method, status_code, response_time_ms, 
          ip_address, user_agent, request_params)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          usage.apiKeyId,
          usage.endpoint,
          usage.method,
          usage.statusCode,
          usage.responseTimeMs,
          usage.ipAddress,
          usage.userAgent,
          JSON.stringify(usage.requestParams || {})
        ]
      );

      // Update daily usage stats
      await this.updateDailyUsage(usage);
    } catch (error) {
      logger.error('Error logging API usage:', error);
    }
  }

  private static async updateDailyUsage(usage: ApiUsageRecord): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const isSuccess = usage.statusCode && usage.statusCode >= 200 && usage.statusCode < 300;

    await query(
      `INSERT INTO v2_api_usage_daily 
       (api_key_id, usage_date, total_requests, successful_requests, failed_requests, 
        total_response_time_ms, unique_endpoints)
       VALUES ($1, $2, 1, $3, $4, $5, $6::jsonb)
       ON CONFLICT (api_key_id, usage_date) 
       DO UPDATE SET
         total_requests = v2_api_usage_daily.total_requests + 1,
         successful_requests = v2_api_usage_daily.successful_requests + $3,
         failed_requests = v2_api_usage_daily.failed_requests + $4,
         total_response_time_ms = v2_api_usage_daily.total_response_time_ms + $5,
         unique_endpoints = CASE 
           WHEN v2_api_usage_daily.unique_endpoints::jsonb ? $7 THEN 
             v2_api_usage_daily.unique_endpoints
           ELSE 
             v2_api_usage_daily.unique_endpoints::jsonb || to_jsonb($7)
         END,
         updated_at = CURRENT_TIMESTAMP`,
      [
        usage.apiKeyId,
        today,
        isSuccess ? 1 : 0,
        isSuccess ? 0 : 1,
        usage.responseTimeMs || 0,
        JSON.stringify([usage.endpoint]),
        usage.endpoint
      ]
    );
  }

  static async checkRateLimit(apiKeyId: number, rateLimit: number): Promise<boolean> {
    try {
      // Check hourly rate limit
      const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM v2_api_usage 
         WHERE api_key_id = $1 
         AND created_at >= NOW() - INTERVAL '1 hour'`,
        [apiKeyId]
      );

      const hourlyCount = parseInt(result[0].count);
      return hourlyCount < rateLimit;
    } catch (error) {
      logger.error('Error checking rate limit:', error);
      return true; // Allow on error
    }
  }

  static async checkDailyLimit(apiKeyId: number, dailyLimit: number): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await query<{ total_requests: number }>(
        `SELECT COALESCE(total_requests, 0) as total_requests
         FROM v2_api_usage_daily
         WHERE api_key_id = $1 AND usage_date = $2`,
        [apiKeyId, today]
      );

      const dailyCount = result.length > 0 ? result[0].total_requests : 0;
      return dailyCount < dailyLimit;
    } catch (error) {
      logger.error('Error checking daily limit:', error);
      return true; // Allow on error
    }
  }

  static async getUsageStats(apiKeyId: number, days: number = 7): Promise<any> {
    try {
      const stats = await query(
        `SELECT 
          usage_date,
          total_requests,
          successful_requests,
          failed_requests,
          total_response_time_ms,
          unique_endpoints
         FROM v2_api_usage_daily
         WHERE api_key_id = $1 
         AND usage_date >= CURRENT_DATE - INTERVAL '${days} days'
         ORDER BY usage_date DESC`,
        [apiKeyId]
      );

      return stats;
    } catch (error) {
      logger.error('Error getting usage stats:', error);
      return [];
    }
  }
}