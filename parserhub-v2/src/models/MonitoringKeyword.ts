import { query } from '../db/pool';
import { MonitoringKeyword, Platform } from '../types';

export class MonitoringKeywordModel {
  static async findAll(isActive = true): Promise<MonitoringKeyword[]> {
    const result = await query<any>(`
      SELECT 
        id,
        keyword,
        platform,
        priority,
        interval_hours as "intervalHours",
        is_active as "isActive",
        last_crawled_at as "lastCrawledAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM v2_monitoring_keywords
      WHERE is_active = $1
      ORDER BY priority ASC, keyword ASC
    `, [isActive]);

    return result.map(row => ({
      ...row,
      lastCrawledAt: row.lastCrawledAt ? new Date(row.lastCrawledAt) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }));
  }

  static async findDueForCrawl(): Promise<MonitoringKeyword[]> {
    const result = await query<any>(`
      SELECT 
        id,
        keyword,
        platform,
        priority,
        interval_hours as "intervalHours",
        is_active as "isActive",
        last_crawled_at as "lastCrawledAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM v2_monitoring_keywords
      WHERE is_active = true
      AND (
        last_crawled_at IS NULL 
        OR last_crawled_at < NOW() - INTERVAL '1 hour' * interval_hours
      )
      ORDER BY priority ASC, last_crawled_at ASC NULLS FIRST
    `);

    return result.map(row => ({
      ...row,
      lastCrawledAt: row.lastCrawledAt ? new Date(row.lastCrawledAt) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }));
  }

  static async updateLastCrawled(id: number): Promise<void> {
    await query(`
      UPDATE v2_monitoring_keywords
      SET 
        last_crawled_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
  }

  static async create(
    keyword: string,
    platform: Platform,
    priority: number = 2,
    intervalHours: number = 1
  ): Promise<MonitoringKeyword> {
    const result = await query<any>(`
      INSERT INTO v2_monitoring_keywords (keyword, platform, priority, interval_hours)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (keyword, platform) 
      DO UPDATE SET 
        priority = EXCLUDED.priority,
        interval_hours = EXCLUDED.interval_hours,
        updated_at = CURRENT_TIMESTAMP
      RETURNING 
        id,
        keyword,
        platform,
        priority,
        interval_hours as "intervalHours",
        is_active as "isActive",
        last_crawled_at as "lastCrawledAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [keyword, platform, priority, intervalHours]);

    const row = result[0];
    return {
      ...row,
      lastCrawledAt: row.lastCrawledAt ? new Date(row.lastCrawledAt) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  static async deactivate(id: number): Promise<void> {
    await query(`
      UPDATE v2_monitoring_keywords
      SET 
        is_active = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
  }
}