# Monitoring Keywords 자동 등록 기능

## 개요
API를 통해 검색된 키워드가 자동으로 `v2_monitoring_keywords` 테이블에 등록되어 스케줄러가 주기적으로 크롤링할 수 있습니다.

## 구현된 기능

### 1. 자동 등록이 적용된 API
- **Search API**: `/api/v2/search/{platform}`
- **Workflow API**: `/api/v2/workflows/{platform}/execute`
- **Public Ranking API**: `/api/v2/public/ranking/{platform}`

### 2. 등록 규칙
- **우선순위(priority)**: 2 (중간)
- **크롤링 주기(interval_hours)**: 1시간
- **활성화 상태(is_active)**: true
- **중복 처리**: ON CONFLICT로 기존 키워드가 있으면 업데이트

### 3. 구현 코드 위치
- `src/services/searchService.ts`: Search API 처리
- `src/services/workflowService.ts`: Workflow API 처리
- `src/services/rankingService.ts`: Public Ranking API 처리

## 사용 예시

### API 호출시 자동 등록
```bash
# Search API
curl -X POST -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"노트북","limit":10}' \
  "http://localhost:8447/api/v2/search/coupang"

# Workflow API
curl -X POST -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workflow":"search","params":{"keyword":"마우스","limit":10}}' \
  "http://localhost:8447/api/v2/workflows/naver_store/execute"
```

### 등록된 키워드 확인
```sql
SELECT keyword, platform, interval_hours, is_active, last_crawled_at 
FROM v2_monitoring_keywords 
ORDER BY created_at DESC;
```

## 스케줄러 동작
- 등록된 키워드는 `interval_hours`에 설정된 주기마다 자동 크롤링
- `is_active = true`인 키워드만 크롤링 대상
- 크롤링 완료시 `last_crawled_at` 업데이트

## 주의사항
- 동일 플랫폼에 같은 키워드는 중복 등록 불가 (UNIQUE 제약)
- 기본 주기는 1시간이며, 필요시 수동으로 변경 가능
- 비활성화하려면 `is_active = false`로 업데이트