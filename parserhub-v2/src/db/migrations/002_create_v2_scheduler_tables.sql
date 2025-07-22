-- v2_monitoring_keywords: 모니터링할 키워드 목록
CREATE TABLE IF NOT EXISTS v2_monitoring_keywords (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  priority INTEGER DEFAULT 1, -- 1: high, 2: medium, 3: low
  interval_hours INTEGER DEFAULT 1, -- 크롤링 주기 (시간)
  is_active BOOLEAN DEFAULT true,
  last_crawled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(keyword, platform)
);

-- v2_scheduler_logs: 스케줄러 실행 로그
CREATE TABLE IF NOT EXISTS v2_scheduler_logs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(100) NOT NULL, -- 'ranking_crawl', 'cache_cleanup', etc.
  status VARCHAR(50) NOT NULL, -- 'started', 'completed', 'failed'
  details JSONB,
  error_message TEXT,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- v2_scheduler_jobs: 실행 대기 중인 작업 큐
CREATE TABLE IF NOT EXISTS v2_scheduler_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(100) NOT NULL,
  platform VARCHAR(50),
  keyword VARCHAR(255),
  priority INTEGER DEFAULT 2,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_v2_monitoring_keywords_active ON v2_monitoring_keywords(is_active, platform);
CREATE INDEX idx_v2_monitoring_keywords_last_crawled ON v2_monitoring_keywords(last_crawled_at);
CREATE INDEX idx_v2_scheduler_logs_job_type ON v2_scheduler_logs(job_type, created_at);
CREATE INDEX idx_v2_scheduler_logs_status ON v2_scheduler_logs(status);
CREATE INDEX idx_v2_scheduler_jobs_status ON v2_scheduler_jobs(status, scheduled_at);
CREATE INDEX idx_v2_scheduler_jobs_platform_keyword ON v2_scheduler_jobs(platform, keyword);

-- 샘플 모니터링 키워드 추가
INSERT INTO v2_monitoring_keywords (keyword, platform, priority, interval_hours) VALUES
  ('노트북', 'coupang', 1, 1),
  ('laptop', 'coupang', 1, 1),
  ('맥북', 'naver_store', 1, 1),
  ('아이패드', 'naver_store', 2, 2),
  ('갤럭시탭', 'naver_compare', 2, 2)
ON CONFLICT (keyword, platform) DO NOTHING;