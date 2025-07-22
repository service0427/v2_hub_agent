// Platform types
export type Platform = 'coupang' | 'naver_store' | 'naver_compare';

// Product interface
export interface Product {
  id: string;
  productId?: string;
  vendorItemId?: string;
  itemId?: string;
  nvMid?: string;
  name: string;
  href: string;
  thumbnail?: string;
  price?: number;
  rating?: number;
  rank?: number;
  page?: number;
}

// Ranking request/response interfaces
export interface RankingRequest {
  platform: Platform;
  keyword: string;
  code: string;
  limit?: number;
}

export interface RankingResponse {
  success: boolean;
  keyword?: string;
  code?: string;
  rank?: number;
  product?: Product;
  rankHistory?: {
    previous: number;
    change: number;
    lastChecked: Date;
  };
  collectedAt?: Date;
  fromCache?: boolean;
  error?: string;
  message?: string;
}

// Agent interfaces
export interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  lastSeen: Date;
  platform?: Platform;
  capabilities?: string[];
  socketId?: string;
  // 새로 추가된 필드들
  hostIp?: string;
  instanceId?: number;  // 1-4
  hostKey?: string;     // "ip:instance" 형식 (예: "10.0.1.1:2")
}

export interface AgentTask {
  id: string;
  type: 'crawl' | 'search' | 'ranking';
  platform: Platform;
  params: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  agentId?: string;
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Workflow interfaces
export interface WorkflowRequest {
  platform: Platform;
  workflow: string;
  params: {
    keyword: string;
    pages?: number;
    limit?: number;
    ignoreCache?: boolean;
  };
}

export interface WorkflowResult {
  success: boolean;
  workflowId: string;
  platform: Platform;
  products?: Product[];
  error?: string;
  executionTime?: number;
}

// Cache interfaces
export interface CacheEntry {
  key: string;
  data: any;
  createdAt: Date;
  ttl: number;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

// Ranking History interfaces
export interface RankingHistory {
  id?: number;
  productId: number;
  keyword: string;
  rank: number;
  page: number;
  price?: number;
  rating?: number;
  reviewCount?: number;
  crawledAt: Date;
}

export interface RankingChange {
  id?: number;
  productId: number;
  keyword: string;
  previousRank?: number;
  currentRank: number;
  rankChange?: number;
  changedAt: Date;
}

export interface SearchResult {
  id?: number;
  platform: Platform;
  keyword: string;
  pageNumber: number;
  totalResults?: number;
  crawledAt: Date;
}

export interface DetailedRankingResponse extends RankingResponse {
  history?: Array<{
    date: Date;
    rank: number;
    price?: number;
  }>;
  competitors?: Array<{
    rank: number;
    product: Product;
  }>;
}

// Public API interfaces
export interface PublicRankingRequest {
  platform: Platform;
  keyword: string;
  code: string;
  realtime?: boolean;
}

// Scheduler types
export interface MonitoringKeyword {
  id: number;
  keyword: string;
  platform: Platform;
  priority: number;
  intervalHours: number;
  isActive: boolean;
  lastCrawledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerJob {
  id: number;
  jobType: string;
  platform?: Platform;
  keyword?: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerLog {
  id: number;
  jobType: string;
  status: 'started' | 'completed' | 'failed';
  details?: any;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

// Redis types
export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}