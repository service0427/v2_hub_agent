import { Server as SocketServer } from 'socket.io';
import { Agent, AgentTask, Platform } from '../types';
import { EnhancedAgent, AgentHost, ChromeInstance, AllocationStrategy, AgentPoolStatus } from '../types/agent';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

class EnhancedAgentManager extends EventEmitter {
  private agents: Map<string, EnhancedAgent> = new Map();
  private hostMap: Map<string, AgentHost> = new Map();  // IP별 호스트 관리
  private tasks: Map<string, AgentTask> = new Map();
  private io: SocketServer | null = null;
  
  // 할당 전략 상태
  private allocationStrategy: AllocationStrategy = {
    type: 'sequential',
    lastAllocatedHost: undefined,
    lastAllocatedInstance: undefined
  };

  // 설정
  private readonly INSTANCES_PER_HOST = 4;
  private readonly HOST_IPS = [
    '10.0.1.1', '10.0.1.2', '10.0.1.3', '10.0.1.4', '10.0.1.5',
    '10.0.1.6', '10.0.1.7', '10.0.1.8', '10.0.1.9', '10.0.1.10'
  ];

  constructor() {
    super();
    this.initializeHosts();
  }

  // 호스트 초기화
  private initializeHosts() {
    this.HOST_IPS.forEach(ip => {
      const host: AgentHost = {
        ip,
        hostId: ip,
        chromeInstances: Array.from({ length: this.INSTANCES_PER_HOST }, (_, i) => ({
          instanceId: i + 1,
          isBusy: false
        })),
        maxInstances: this.INSTANCES_PER_HOST,
        activeCount: 0
      };
      this.hostMap.set(ip, host);
    });
  }

  setSocketServer(io: SocketServer) {
    this.io = io;
  }

  // 에이전트 등록 (IP와 인스턴스 정보 포함)
  registerAgent(agent: Agent, ip: string, instanceId: number) {
    const host = this.hostMap.get(ip);
    if (!host) {
      logger.error(`Unknown host IP: ${ip}`);
      return;
    }

    const enhancedAgent: EnhancedAgent = {
      ...agent,
      host,
      currentInstance: instanceId
    };

    this.agents.set(agent.socketId!, enhancedAgent);
    
    // 해당 인스턴스를 사용 가능으로 표시
    const instance = host.chromeInstances.find(i => i.instanceId === instanceId);
    if (instance) {
      instance.isBusy = false;
      instance.lastUsed = new Date();
    }

    this.emit('agent:registered', enhancedAgent);
    logger.info(`Agent registered: ${ip}:${instanceId}`);
  }

  // 순차적 할당 알고리즘
  private getNextAvailableInstance(): { host: AgentHost; instance: ChromeInstance } | null {
    const hosts = Array.from(this.hostMap.values());
    
    // 마지막 할당 정보 가져오기
    let startHostIndex = 0;
    let startInstanceIndex = 0;
    
    if (this.allocationStrategy.lastAllocatedHost) {
      const lastHostIndex = hosts.findIndex(h => h.ip === this.allocationStrategy.lastAllocatedHost);
      if (lastHostIndex >= 0) {
        startHostIndex = lastHostIndex;
        startInstanceIndex = (this.allocationStrategy.lastAllocatedInstance || 0) % this.INSTANCES_PER_HOST;
      }
    }

    // 순차적으로 다음 사용 가능한 인스턴스 찾기
    for (let i = 0; i < hosts.length * this.INSTANCES_PER_HOST; i++) {
      const hostIndex = Math.floor((startHostIndex * this.INSTANCES_PER_HOST + startInstanceIndex + i) / this.INSTANCES_PER_HOST) % hosts.length;
      const instanceIndex = (startInstanceIndex + i) % this.INSTANCES_PER_HOST;
      
      const host = hosts[hostIndex];
      const instance = host.chromeInstances[instanceIndex];
      
      if (!instance.isBusy) {
        // 다음 할당을 위해 상태 업데이트
        this.allocationStrategy.lastAllocatedHost = host.ip;
        this.allocationStrategy.lastAllocatedInstance = instanceIndex + 1;
        
        return { host, instance };
      }
    }
    
    return null;
  }

  // 작업 할당 (개선된 버전)
  async assignTask(task: AgentTask): Promise<boolean> {
    // 다음 사용 가능한 인스턴스 찾기
    const allocation = this.getNextAvailableInstance();
    if (!allocation) {
      logger.error('No available instances for task assignment');
      return false;
    }

    const { host, instance } = allocation;
    
    // 해당 호스트의 에이전트 찾기
    const agent = Array.from(this.agents.values()).find(a => 
      a.host.ip === host.ip && 
      a.currentInstance === instance.instanceId &&
      a.status === 'online'
    );

    if (!agent || !agent.socketId) {
      logger.error(`No online agent for ${host.ip}:${instance.instanceId}`);
      return false;
    }

    // 인스턴스를 사용 중으로 표시
    instance.isBusy = true;
    instance.currentTaskId = task.id;
    host.activeCount++;

    // 에이전트 상태 업데이트
    agent.status = 'busy';
    
    // 작업 저장
    task.agentId = agent.id;
    task.status = 'processing';
    this.tasks.set(task.id, task);

    // 작업 전송
    if (this.io) {
      this.io.to(agent.socketId).emit('task:assign', task);
      logger.info(`Task ${task.id} assigned to ${host.ip}:${instance.instanceId}`);
      return true;
    }

    return false;
  }

  // 작업 완료 처리
  handleTaskResult(result: { taskId: string; success: boolean; data?: any; error?: string }) {
    const task = this.tasks.get(result.taskId);
    if (!task) {
      logger.error(`Task not found: ${result.taskId}`);
      return;
    }

    // 작업 업데이트
    task.status = result.success ? 'completed' : 'failed';
    task.result = result.data;
    task.error = result.error;
    task.completedAt = new Date();

    // 에이전트와 인스턴스 상태 업데이트
    if (task.agentId) {
      const agent = Array.from(this.agents.values()).find(a => a.id === task.agentId);
      if (agent) {
        agent.status = 'online';
        
        // 인스턴스 해제
        const instance = agent.host.chromeInstances.find(i => i.currentTaskId === task.id);
        if (instance) {
          instance.isBusy = false;
          instance.currentTaskId = undefined;
          instance.lastUsed = new Date();
          agent.host.activeCount--;
        }
      }
    }

    this.emit('task:completed', task);
    logger.info(`Task ${task.id} completed with status: ${task.status}`);
  }

  // 에이전트 풀 상태 조회
  getPoolStatus(): AgentPoolStatus {
    const hostStatus = new Map<string, { ip: string; available: number[]; busy: number[] }>();
    
    let totalInstances = 0;
    let availableInstances = 0;
    let busyInstances = 0;

    this.hostMap.forEach((host, ip) => {
      const available: number[] = [];
      const busy: number[] = [];
      
      host.chromeInstances.forEach(instance => {
        totalInstances++;
        if (instance.isBusy) {
          busy.push(instance.instanceId);
          busyInstances++;
        } else {
          available.push(instance.instanceId);
          availableInstances++;
        }
      });

      hostStatus.set(ip, { ip, available, busy });
    });

    return {
      totalHosts: this.hostMap.size,
      totalInstances,
      availableInstances,
      busyInstances,
      hostStatus
    };
  }

  // 특정 호스트의 상태 조회
  getHostStatus(ip: string): AgentHost | undefined {
    return this.hostMap.get(ip);
  }

  // 모든 온라인 에이전트 조회
  getOnlineAgents(platform?: Platform): EnhancedAgent[] {
    const agents = Array.from(this.agents.values()).filter(agent => agent.status === 'online');
    
    if (platform) {
      return agents.filter(agent => agent.platform === platform);
    }
    
    return agents;
  }

  // 디버그 정보 출력
  debugAllocation() {
    console.log('\n=== Agent Pool Status ===');
    this.hostMap.forEach((host, ip) => {
      console.log(`\nHost ${ip}:`);
      host.chromeInstances.forEach(instance => {
        const status = instance.isBusy ? 'BUSY' : 'AVAILABLE';
        const taskInfo = instance.currentTaskId ? ` (Task: ${instance.currentTaskId})` : '';
        console.log(`  Instance ${instance.instanceId}: ${status}${taskInfo}`);
      });
    });
    console.log(`\nLast allocation: ${this.allocationStrategy.lastAllocatedHost}:${this.allocationStrategy.lastAllocatedInstance}`);
  }
}

export const enhancedAgentManager = new EnhancedAgentManager();