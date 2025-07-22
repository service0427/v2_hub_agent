import { Server as SocketServer } from 'socket.io';
import { Agent, AgentTask, Platform } from '../types';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

interface HostInstance {
  ip: string;
  instanceId: number;
  isBusy: boolean;
  agentSocketId?: string;
  currentTaskId?: string;
  lastUsed?: Date;
}

interface AllocationState {
  lastAllocatedIp?: string;
  lastAllocatedInstance?: number;
  allocationSequence: string[];  // 할당 순서 추적
}

class AgentManager extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, AgentTask> = new Map();
  private io: SocketServer | null = null;
  
  // 호스트 인스턴스 관리
  private hostInstances: Map<string, HostInstance> = new Map();  // key: "ip:instance"
  private allocationState: AllocationState = {
    allocationSequence: []
  };
  
  // 설정
  private readonly INSTANCES_PER_HOST = 4;
  private readonly HOST_IPS = [
    '10.0.1.1', '10.0.1.2', '10.0.1.3', '10.0.1.4', '10.0.1.5',
    '10.0.1.6', '10.0.1.7', '10.0.1.8', '10.0.1.9', '10.0.1.10'
  ];

  constructor() {
    super();
    this.initializeHostInstances();
  }

  // 호스트 인스턴스 초기화
  private initializeHostInstances() {
    this.HOST_IPS.forEach(ip => {
      for (let instanceId = 1; instanceId <= this.INSTANCES_PER_HOST; instanceId++) {
        const key = `${ip}:${instanceId}`;
        this.hostInstances.set(key, {
          ip,
          instanceId,
          isBusy: false,
          lastUsed: new Date()
        });
      }
    });
    logger.info(`Initialized ${this.hostInstances.size} host instances`);
  }

  setSocketServer(io: SocketServer) {
    this.io = io;
  }

  registerAgent(agent: Agent) {
    // 호스트 정보 추가
    if (agent.hostIp && agent.instanceId) {
      const hostKey = `${agent.hostIp}:${agent.instanceId}`;
      agent.hostKey = hostKey;
      
      // 호스트 인스턴스 업데이트
      const hostInstance = this.hostInstances.get(hostKey);
      if (hostInstance) {
        hostInstance.agentSocketId = agent.socketId;
        hostInstance.isBusy = false;  // 등록 시점에는 사용 가능
        logger.info(`Agent registered at ${hostKey}`);
      }
    }
    
    this.agents.set(agent.socketId!, agent);
    this.emit('agent:registered', agent);
  }

  unregisterAgent(socketId: string) {
    const agent = this.agents.get(socketId);
    if (agent) {
      agent.status = 'offline';
      
      // 호스트 인스턴스 정리
      if (agent.hostKey) {
        const hostInstance = this.hostInstances.get(agent.hostKey);
        if (hostInstance) {
          hostInstance.agentSocketId = undefined;
          hostInstance.isBusy = false;
          hostInstance.currentTaskId = undefined;
        }
      }
      
      this.agents.delete(socketId);
      this.emit('agent:unregistered', agent);
    }
  }

  updateAgentStatus(socketId: string, status: Agent['status']) {
    const agent = this.agents.get(socketId);
    if (agent) {
      agent.status = status;
      agent.lastSeen = new Date();
      this.emit('agent:status', agent);
    }
  }

  updateAgentHeartbeat(socketId: string) {
    const agent = this.agents.get(socketId);
    if (agent) {
      agent.lastSeen = new Date();
    }
  }

  getOnlineAgents(platform?: Platform): Agent[] {
    const agents = Array.from(this.agents.values()).filter(agent => agent.status === 'online');
    
    if (platform) {
      return agents.filter(agent => agent.platform === platform);
    }
    
    return agents;
  }

  getAvailableAgents(platform?: Platform): Agent[] {
    return this.getOnlineAgents(platform).filter(agent => agent.status === 'online');
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgent(agentId: string): Agent | undefined {
    return Array.from(this.agents.values()).find(agent => agent.id === agentId);
  }

  // 다음 사용 가능한 호스트 인스턴스 찾기 (순차적 할당)
  private getNextAvailableHostInstance(): HostInstance | null {
    const ipCount = this.HOST_IPS.length;
    const instanceCount = this.INSTANCES_PER_HOST;
    
    // 마지막 할당 위치 계산
    let startIpIndex = 0;
    let startInstanceIndex = 0;
    
    if (this.allocationState.lastAllocatedIp && this.allocationState.lastAllocatedInstance) {
      const lastIpIndex = this.HOST_IPS.indexOf(this.allocationState.lastAllocatedIp);
      if (lastIpIndex >= 0) {
        // 다음 위치 계산: 1-1, 2-1, 3-1, ..., 10-1, 1-2, 2-2, ...
        startInstanceIndex = this.allocationState.lastAllocatedInstance - 1;
        startIpIndex = (lastIpIndex + 1) % ipCount;
        
        // 모든 IP를 순회했으면 다음 인스턴스로
        if (startIpIndex === 0) {
          startInstanceIndex = (startInstanceIndex + 1) % instanceCount;
        }
      }
    }
    
    // 순차적으로 사용 가능한 인스턴스 찾기
    for (let i = 0; i < ipCount * instanceCount; i++) {
      const totalIndex = (startIpIndex + startInstanceIndex * ipCount + i) % (ipCount * instanceCount);
      const ipIndex = totalIndex % ipCount;
      const instanceIndex = Math.floor(totalIndex / ipCount);
      
      const ip = this.HOST_IPS[ipIndex];
      const instanceId = instanceIndex + 1;
      const hostKey = `${ip}:${instanceId}`;
      
      const hostInstance = this.hostInstances.get(hostKey);
      if (hostInstance && !hostInstance.isBusy && hostInstance.agentSocketId) {
        // 할당 상태 업데이트
        this.allocationState.lastAllocatedIp = ip;
        this.allocationState.lastAllocatedInstance = instanceId;
        this.allocationState.allocationSequence.push(hostKey);
        
        logger.debug(`Next allocation: ${hostKey}`);
        return hostInstance;
      }
    }
    
    return null;
  }

  async assignTask(task: AgentTask, preferredAgentId?: string): Promise<boolean> {
    let agent: Agent | undefined;
    let hostInstance: HostInstance | null = null;

    if (preferredAgentId) {
      agent = this.getAgent(preferredAgentId);
      if (!agent || agent.status !== 'online') {
        agent = undefined;
      }
    }

    if (!agent) {
      // 순차적 할당으로 다음 호스트 인스턴스 찾기
      hostInstance = this.getNextAvailableHostInstance();
      if (!hostInstance || !hostInstance.agentSocketId) {
        logger.error(`No available host instances for platform: ${task.platform}`);
        return false;
      }
      
      // 해당 호스트의 에이전트 찾기
      agent = this.agents.get(hostInstance.agentSocketId);
      if (!agent || agent.status !== 'online') {
        logger.error(`Agent not available for host instance: ${hostInstance.ip}:${hostInstance.instanceId}`);
        return false;
      }
    }

    if (!agent || !agent.socketId) {
      return false;
    }

    // 호스트 인스턴스 상태 업데이트
    if (agent.hostKey) {
      const instance = this.hostInstances.get(agent.hostKey);
      if (instance) {
        instance.isBusy = true;
        instance.currentTaskId = task.id;
      }
    }

    // Update agent status
    agent.status = 'busy';
    
    // Store task
    task.agentId = agent.id;
    task.status = 'processing';
    this.tasks.set(task.id, task);

    // Send task to agent
    if (this.io) {
      this.io.to(agent.socketId).emit('task:assign', task);
      logger.info(`Task ${task.id} assigned to agent ${agent.id} at ${agent.hostKey}`);
      return true;
    }

    return false;
  }

  handleTaskResult(result: { taskId: string; success: boolean; data?: any; error?: string }) {
    const task = this.tasks.get(result.taskId);
    if (!task) {
      logger.error(`Task not found: ${result.taskId}`);
      return;
    }

    // Update task
    task.status = result.success ? 'completed' : 'failed';
    task.result = result.data;
    task.error = result.error;
    task.completedAt = new Date();

    // Update agent status
    if (task.agentId) {
      const agent = this.getAgent(task.agentId);
      if (agent) {
        agent.status = 'online';
        
        // 호스트 인스턴스 해제
        if (agent.hostKey) {
          const hostInstance = this.hostInstances.get(agent.hostKey);
          if (hostInstance) {
            hostInstance.isBusy = false;
            hostInstance.currentTaskId = undefined;
            hostInstance.lastUsed = new Date();
            logger.debug(`Released host instance: ${agent.hostKey}`);
          }
        }
      }
    }

    this.emit('task:completed', task);
    logger.info(`Task ${task.id} completed with status: ${task.status}`);
  }

  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  getTasks(status?: AgentTask['status']): AgentTask[] {
    const tasks = Array.from(this.tasks.values());
    
    if (status) {
      return tasks.filter(task => task.status === status);
    }
    
    return tasks;
  }

  // Cleanup old tasks
  cleanupTasks(olderThanHours: number = 24) {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [taskId, task] of this.tasks) {
      if (task.completedAt && task.completedAt < cutoffTime) {
        this.tasks.delete(taskId);
        cleaned++;
      }
    }

    logger.info(`Cleaned up ${cleaned} old tasks`);
    return cleaned;
  }

  // 호스트 풀 상태 조회
  getPoolStatus() {
    const status = {
      totalHosts: this.HOST_IPS.length,
      totalInstances: this.hostInstances.size,
      availableInstances: 0,
      busyInstances: 0,
      hostDetails: [] as Array<{
        ip: string;
        instances: Array<{
          id: number;
          status: 'available' | 'busy' | 'offline';
          currentTask?: string;
          lastUsed?: Date;
        }>;
      }>,
      allocationSequence: this.allocationState.allocationSequence.slice(-20) // 최근 20개
    };

    // IP별로 그룹화
    const hostMap = new Map<string, typeof status.hostDetails[0]>();
    
    this.hostInstances.forEach((instance, key) => {
      if (!hostMap.has(instance.ip)) {
        hostMap.set(instance.ip, {
          ip: instance.ip,
          instances: []
        });
      }
      
      const host = hostMap.get(instance.ip)!;
      const instanceStatus = instance.isBusy ? 'busy' : 
                           instance.agentSocketId ? 'available' : 'offline';
      
      host.instances.push({
        id: instance.instanceId,
        status: instanceStatus,
        currentTask: instance.currentTaskId,
        lastUsed: instance.lastUsed
      });

      if (instanceStatus === 'available') status.availableInstances++;
      else if (instanceStatus === 'busy') status.busyInstances++;
    });

    status.hostDetails = Array.from(hostMap.values()).sort((a, b) => a.ip.localeCompare(b.ip));
    
    return status;
  }

  // 특정 호스트의 상태 조회
  getHostStatus(ip: string) {
    const instances = [];
    
    for (let i = 1; i <= this.INSTANCES_PER_HOST; i++) {
      const key = `${ip}:${i}`;
      const instance = this.hostInstances.get(key);
      if (instance) {
        instances.push({
          instanceId: i,
          isBusy: instance.isBusy,
          hasAgent: !!instance.agentSocketId,
          currentTaskId: instance.currentTaskId,
          lastUsed: instance.lastUsed
        });
      }
    }
    
    return { ip, instances };
  }

  // 디버그 정보 출력
  debugAllocation() {
    console.log('\n=== Agent Pool Allocation Status ===');
    console.log(`Total Hosts: ${this.HOST_IPS.length}`);
    console.log(`Instances per Host: ${this.INSTANCES_PER_HOST}`);
    console.log(`Last Allocation: ${this.allocationState.lastAllocatedIp}:${this.allocationState.lastAllocatedInstance}`);
    
    const poolStatus = this.getPoolStatus();
    console.log(`\nAvailable: ${poolStatus.availableInstances}/${poolStatus.totalInstances}`);
    console.log(`Busy: ${poolStatus.busyInstances}/${poolStatus.totalInstances}`);
    
    console.log('\nHost Details:');
    poolStatus.hostDetails.forEach(host => {
      console.log(`\n${host.ip}:`);
      host.instances.forEach(inst => {
        const taskInfo = inst.currentTask ? ` (Task: ${inst.currentTask})` : '';
        console.log(`  Instance ${inst.id}: ${inst.status.toUpperCase()}${taskInfo}`);
      });
    });
    
    console.log('\nRecent Allocations:');
    poolStatus.allocationSequence.forEach((key, i) => {
      console.log(`  ${i + 1}. ${key}`);
    });
  }
}

export const agentManager = new AgentManager();