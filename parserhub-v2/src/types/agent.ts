import { Platform } from './index';

// 개선된 Agent 타입 정의
export interface ChromeInstance {
  instanceId: number;  // 1-4
  isBusy: boolean;
  currentTaskId?: string;
  lastUsed?: Date;
}

export interface AgentHost {
  ip: string;
  hostId: string;  // IP + instance 조합 (예: "192.168.1.1:1")
  chromeInstances: ChromeInstance[];
  maxInstances: number;  // 기본값 4
  activeCount: number;
}

export interface EnhancedAgent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  lastSeen: Date;
  platform?: Platform;
  capabilities?: string[];
  socketId?: string;
  
  // 새로운 필드들
  host: AgentHost;
  currentInstance?: number;  // 현재 사용 중인 크롬 인스턴스
}

// 작업 할당 전략
export interface AllocationStrategy {
  type: 'round-robin' | 'least-used' | 'sequential';
  lastAllocatedHost?: string;
  lastAllocatedInstance?: number;
}

// 에이전트 풀 상태
export interface AgentPoolStatus {
  totalHosts: number;
  totalInstances: number;
  availableInstances: number;
  busyInstances: number;
  hostStatus: Map<string, {
    ip: string;
    available: number[];
    busy: number[];
  }>;
}