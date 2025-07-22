import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { MonitoringKeywordModel } from '../models/MonitoringKeyword';
import { SchedulerLogModel } from '../models/SchedulerLog';
import { workflowService } from './workflowService';
import { rankingService } from './rankingService';
import { cacheService } from './cacheService';
import { config } from '../config';
import { WorkflowRequest, MonitoringKeyword } from '../types';

export class SchedulerService {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;
  private concurrentJobs = 0;
  private maxConcurrentJobs: number;

  constructor() {
    this.maxConcurrentJobs = config.scheduler?.maxConcurrentJobs || 3;
  }

  async start(): Promise<void> {
    if (!config.scheduler?.enabled) {
      logger.info('Scheduler is disabled in configuration');
      return;
    }

    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduler service');

    // Schedule ranking crawl job
    this.scheduleRankingCrawl();

    // Schedule cache cleanup job
    this.scheduleCacheCleanup();

    // Schedule log cleanup job
    this.scheduleLogCleanup();

    logger.info('Scheduler service started successfully');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping scheduler service');

    // Stop all scheduled tasks
    this.tasks.forEach((task, name) => {
      task.stop();
      logger.info(`Stopped scheduled task: ${name}`);
    });

    this.tasks.clear();
    this.isRunning = false;

    logger.info('Scheduler service stopped');
  }

  private scheduleRankingCrawl(): void {
    const cronExpression = config.scheduler?.rankingCrawlSchedule || '0 * * * *'; // Every hour by default

    const task = cron.schedule(cronExpression, async () => {
      await this.runRankingCrawl();
    });
    
    task.start(); // Explicitly start the task

    this.tasks.set('ranking-crawl', task);
    logger.info(`Scheduled ranking crawl with expression: ${cronExpression}`);
  }

  private scheduleCacheCleanup(): void {
    const cronExpression = '0 0 * * *'; // Daily at midnight

    const task = cron.schedule(cronExpression, async () => {
      await this.runCacheCleanup();
    });
    
    task.start(); // Explicitly start the task

    this.tasks.set('cache-cleanup', task);
    logger.info(`Scheduled cache cleanup with expression: ${cronExpression}`);
  }

  private scheduleLogCleanup(): void {
    const cronExpression = '0 2 * * 0'; // Weekly on Sunday at 2 AM

    const task = cron.schedule(cronExpression, async () => {
      await this.runLogCleanup();
    });
    
    task.start(); // Explicitly start the task

    this.tasks.set('log-cleanup', task);
    logger.info(`Scheduled log cleanup with expression: ${cronExpression}`);
  }

  private async runRankingCrawl(): Promise<void> {
    const logEntry = await SchedulerLogModel.createLog(
      'ranking_crawl',
      'started',
      { startTime: new Date() }
    );

    try {
      logger.info('Starting scheduled ranking crawl');

      // Get keywords due for crawl
      const keywords = await MonitoringKeywordModel.findDueForCrawl();
      logger.info(`Found ${keywords.length} keywords due for crawl`);

      const results = {
        total: keywords.length,
        successful: 0,
        failed: 0,
        errors: [] as any[]
      };

      // Process keywords with concurrency limit
      const batches = this.createBatches(keywords, this.maxConcurrentJobs);

      for (const batch of batches) {
        await Promise.all(
          batch.map(async (keyword) => {
            try {
              await this.crawlKeyword(keyword);
              results.successful++;
            } catch (error) {
              results.failed++;
              results.errors.push({
                keyword: keyword.keyword,
                platform: keyword.platform,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
              logger.error(`Failed to crawl keyword ${keyword.keyword} on ${keyword.platform}:`, error);
            }
          })
        );
      }

      await SchedulerLogModel.updateLog(
        logEntry.id,
        'completed',
        results
      );

      logger.info(`Ranking crawl completed: ${results.successful} successful, ${results.failed} failed`);
    } catch (error) {
      await SchedulerLogModel.updateLog(
        logEntry.id,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      logger.error('Ranking crawl failed:', error);
    }
  }

  private async crawlKeyword(keyword: MonitoringKeyword): Promise<void> {
    logger.info(`Crawling keyword: ${keyword.keyword} on ${keyword.platform}`);

    // Execute workflow with ignoreCache to get fresh data
    const workflowRequest: WorkflowRequest = {
      platform: keyword.platform,
      workflow: 'search',
      params: {
        keyword: keyword.keyword,
        pages: 1,
        ignoreCache: true
      }
    };

    const result = await workflowService.executeWorkflow(workflowRequest);

    if (result.success && result.products) {
      // Save search results to database
      await rankingService.saveSearchResults(
        keyword.platform,
        keyword.keyword,
        1,
        result.products
      );

      // Update last crawled timestamp
      await MonitoringKeywordModel.updateLastCrawled(keyword.id);

      logger.info(`Successfully crawled ${result.products.length} products for ${keyword.keyword}`);
    } else {
      throw new Error(result.error || 'Failed to crawl keyword');
    }
  }

  private async runCacheCleanup(): Promise<void> {
    const logEntry = await SchedulerLogModel.createLog(
      'cache_cleanup',
      'started'
    );

    try {
      logger.info('Starting cache cleanup');

      // Clear expired cache entries
      const patterns = ['ranking:*', 'search:*'];
      let totalCleared = 0;

      for (const pattern of patterns) {
        const cleared = await cacheService.clearPattern(pattern);
        totalCleared += cleared;
      }

      await SchedulerLogModel.updateLog(
        logEntry.id,
        'completed',
        { entriesCleared: totalCleared }
      );

      logger.info(`Cache cleanup completed: ${totalCleared} entries cleared`);
    } catch (error) {
      await SchedulerLogModel.updateLog(
        logEntry.id,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      logger.error('Cache cleanup failed:', error);
    }
  }

  private async runLogCleanup(): Promise<void> {
    const logEntry = await SchedulerLogModel.createLog(
      'log_cleanup',
      'started'
    );

    try {
      logger.info('Starting log cleanup');

      // Clean up old scheduler logs (keep 30 days)
      const deletedCount = await SchedulerLogModel.cleanupOldLogs(30);

      await SchedulerLogModel.updateLog(
        logEntry.id,
        'completed',
        { deletedLogs: deletedCount }
      );

      logger.info(`Log cleanup completed: ${deletedCount} old logs deleted`);
    } catch (error) {
      await SchedulerLogModel.updateLog(
        logEntry.id,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      logger.error('Log cleanup failed:', error);
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  // Manual trigger methods for testing
  async triggerRankingCrawl(): Promise<void> {
    logger.info('Manually triggering ranking crawl');
    await this.runRankingCrawl();
  }

  async triggerCacheCleanup(): Promise<void> {
    logger.info('Manually triggering cache cleanup');
    await this.runCacheCleanup();
  }

  async triggerLogCleanup(): Promise<void> {
    logger.info('Manually triggering log cleanup');
    await this.runLogCleanup();
  }
}

export const schedulerService = new SchedulerService();