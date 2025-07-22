import { v4 as uuidv4 } from 'uuid';
import { WorkflowRequest, WorkflowResult, AgentTask, Platform } from '../types';
import { agentManager } from '../socket/agentManager';
import { logger } from '../utils/logger';
import { config } from '../config';
import { sampleDataService } from './sampleDataService';
import { getCache, setCache } from '../db/redis';
import { rankingService } from './rankingService';
import { MonitoringKeywordModel } from '../models/MonitoringKeyword';

interface WorkflowStatus {
  workflowId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalTasks: number;
  completedTasks: number;
  result?: WorkflowResult;
}

class WorkflowService {
  private workflows = new Map<string, WorkflowStatus>();
  
  // Available workflows per platform
  private platformWorkflows: Record<Platform, string[]> = {
    coupang: ['search', 'category', 'bestseller'],
    naver_store: ['search', 'store', 'category'],
    naver_compare: ['search', 'catalog', 'category'],
  };

  async executeWorkflow(request: WorkflowRequest): Promise<WorkflowResult> {
    const workflowId = uuidv4();
    const startTime = Date.now();

    try {
      // Validate workflow exists for platform
      if (!this.platformWorkflows[request.platform]?.includes(request.workflow)) {
        return {
          success: false,
          workflowId,
          platform: request.platform,
          error: `Invalid workflow '${request.workflow}' for platform '${request.platform}'`,
        };
      }

      // Initialize workflow status
      const status: WorkflowStatus = {
        workflowId,
        status: 'pending',
        progress: 0,
        totalTasks: 1,
        completedTasks: 0,
      };
      this.workflows.set(workflowId, status);

      // In dev mode, use sample data
      if (config.devMode) {
        status.status = 'processing';
        
        // Check cache first if not ignoring
        if (!request.params.ignoreCache) {
          const cacheKey = `workflow:${request.platform}:${request.workflow}:${request.params.keyword}`;
          const cached = await getCache<WorkflowResult>(cacheKey);
          if (cached) {
            return {
              ...cached,
              workflowId,
              executionTime: Date.now() - startTime,
            };
          }
        }
        
        // Simulate workflow execution
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const products = sampleDataService.getProducts(
          request.platform,
          request.params.keyword,
          request.params.limit || 50
        );

        // Save to database
        await rankingService.saveSearchResults(
          request.platform,
          request.params.keyword,
          1, // page number
          products.slice(0, request.params.limit || 50)
        );

        // 자동으로 monitoring_keywords에 추가 (기본 1시간 주기)
        if (request.params.keyword) {
          try {
            await MonitoringKeywordModel.create(
              request.params.keyword,
              request.platform,
              2,  // priority: 2 (medium)
              1   // interval_hours: 1시간
            );
            logger.info(`Added keyword "${request.params.keyword}" to monitoring for platform ${request.platform}`);
          } catch (error) {
            // 이미 존재하는 경우 무시 (ON CONFLICT로 처리됨)
            logger.debug(`Keyword "${request.params.keyword}" already exists in monitoring for platform ${request.platform}`);
          }
        }

        const result: WorkflowResult = {
          success: true,
          workflowId,
          platform: request.platform,
          products,
          executionTime: Date.now() - startTime,
        };

        // Cache the result
        if (!request.params.ignoreCache) {
          const cacheKey = `workflow:${request.platform}:${request.workflow}:${request.params.keyword}`;
          await setCache(cacheKey, result, 300); // 5 minutes cache
        }

        status.status = 'completed';
        status.progress = 100;
        status.completedTasks = 1;
        status.result = result;

        return result;
      }

      // In production, create and assign task to agent
      const task: AgentTask = {
        id: uuidv4(),
        type: 'crawl',
        platform: request.platform,
        params: {
          workflow: request.workflow,
          ...request.params,
        },
        status: 'pending',
        createdAt: new Date(),
      };

      // Try to assign task to available agent
      const assigned = await agentManager.assignTask(task);
      
      if (!assigned) {
        status.status = 'failed';
        return {
          success: false,
          workflowId,
          platform: request.platform,
          error: 'No available agents for this platform',
        };
      }

      // Listen for task completion
      agentManager.once('task:completed', (completedTask) => {
        if (completedTask.id === task.id) {
          status.status = completedTask.status === 'completed' ? 'completed' : 'failed';
          status.progress = 100;
          status.completedTasks = 1;
          
          if (completedTask.status === 'completed') {
            status.result = {
              success: true,
              workflowId,
              platform: request.platform,
              products: completedTask.result?.products || [],
              executionTime: Date.now() - startTime,
            };
          } else {
            status.result = {
              success: false,
              workflowId,
              platform: request.platform,
              error: completedTask.error || 'Task failed',
            };
          }
        }
      });

      // Return initial response
      return {
        success: true,
        workflowId,
        platform: request.platform,
        products: [],
        executionTime: 0,
      };

    } catch (error) {
      logger.error('Workflow execution error:', error);
      
      const errorResult: WorkflowResult = {
        success: false,
        workflowId,
        platform: request.platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      const status = this.workflows.get(workflowId);
      if (status) {
        status.status = 'failed';
        status.result = errorResult;
      }

      return errorResult;
    }
  }

  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus | null> {
    return this.workflows.get(workflowId) || null;
  }

  getAvailableWorkflows(platform: Platform): string[] {
    return this.platformWorkflows[platform] || [];
  }

  // Cleanup old workflows
  cleanupWorkflows(olderThanHours: number = 24) {
    const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [id, workflow] of this.workflows) {
      if (workflow.status === 'completed' || workflow.status === 'failed') {
        // Assuming workflow was created at approximately workflowId timestamp
        const workflowTime = parseInt(id.split('-')[0], 16);
        if (workflowTime < cutoffTime) {
          this.workflows.delete(id);
          cleaned++;
        }
      }
    }

    logger.info(`Cleaned up ${cleaned} old workflows`);
    return cleaned;
  }
}

export const workflowService = new WorkflowService();