import { query } from '../db/pool';
import { SchedulerLog } from '../types';

export class SchedulerLogModel {
  static async createLog(
    jobType: string,
    status: 'started' | 'completed' | 'failed',
    details?: any,
    errorMessage?: string
  ): Promise<SchedulerLog> {
    const result = await query<any>(`
      INSERT INTO v2_scheduler_logs (job_type, status, details, error_message, started_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING 
        id,
        job_type as "jobType",
        status,
        details,
        error_message as "errorMessage",
        started_at as "startedAt",
        completed_at as "completedAt",
        created_at as "createdAt"
    `, [jobType, status, JSON.stringify(details), errorMessage]);

    const row = result[0];
    return {
      ...row,
      details: row.details, // PostgreSQL already returns parsed JSON
      startedAt: new Date(row.startedAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      createdAt: new Date(row.createdAt),
    };
  }

  static async updateLog(
    id: number,
    status: 'completed' | 'failed',
    details?: any,
    errorMessage?: string
  ): Promise<void> {
    await query(`
      UPDATE v2_scheduler_logs
      SET 
        status = $2,
        details = COALESCE($3::jsonb, details),
        error_message = COALESCE($4, error_message),
        completed_at = NOW()
      WHERE id = $1
    `, [id, status, details ? JSON.stringify(details) : null, errorMessage]);
  }

  static async getRecentLogs(limit: number = 100): Promise<SchedulerLog[]> {
    const result = await query<any>(`
      SELECT 
        id,
        job_type as "jobType",
        status,
        details,
        error_message as "errorMessage",
        started_at as "startedAt",
        completed_at as "completedAt",
        created_at as "createdAt"
      FROM v2_scheduler_logs
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    return result.map(row => ({
      ...row,
      details: row.details,
      startedAt: new Date(row.startedAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      createdAt: new Date(row.createdAt),
    }));
  }

  static async getLogsByJobType(jobType: string, limit: number = 50): Promise<SchedulerLog[]> {
    const result = await query<any>(`
      SELECT 
        id,
        job_type as "jobType",
        status,
        details,
        error_message as "errorMessage",
        started_at as "startedAt",
        completed_at as "completedAt",
        created_at as "createdAt"
      FROM v2_scheduler_logs
      WHERE job_type = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [jobType, limit]);

    return result.map(row => ({
      ...row,
      details: row.details,
      startedAt: new Date(row.startedAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      createdAt: new Date(row.createdAt),
    }));
  }

  static async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
    const result = await query<any>(`
      DELETE FROM v2_scheduler_logs
      WHERE created_at < NOW() - INTERVAL '1 day' * $1
      RETURNING id
    `, [daysToKeep]);

    return result.length;
  }
}