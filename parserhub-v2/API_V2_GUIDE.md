# ParserHub v2 API 가이드

## 개요

ParserHub v2는 두 가지 API 시스템을 제공합니다:

1. **공개 API** - 제품 순위 조회 전용 (v2_api_keys 테이블의 API 키 사용)
2. **관리자 API** - 워크플로우 실행 및 시스템 관리 (내부 API_KEY 사용)

## 1. 공개 API (순위 조회)

### 인증 방식
URL 파라미터로 API 키를 전달합니다:
```
?key=YOUR_API_KEY
```

### 사용 가능한 API 키
- **Default Client**: `YOUR_TEST_API_KEY` (1000/시간, 10000/일)
- **Test Client**: `YOUR_TEST_API_KEY_2` (100/시간, 1000/일)
- **Demo Client**: `YOUR_TEST_API_KEY_3` (500/시간, 5000/일)

### 엔드포인트

#### 1.1 제품 순위 조회
```
GET /api/v2/public/ranking/:platform?key=YOUR_API_KEY&keyword=KEYWORD&code=CODE
```

**URL**: `http://mkt.techb.kr:8447/api/v2/public/ranking/{platform}`

**경로 파라미터:**
- `platform`: coupang, naver_store, naver_compare

**쿼리 파라미터:**
- `key`: API 키 (필수)
- `keyword`: 검색 키워드 (필수, URL 인코딩 필요)
- `code`: 제품 코드 (필수)
- `realtime`: true일 경우 캐시 무시하고 실시간 크롤링 (선택)

**테스트 가능한 cURL 예제:**
```bash
# Default Client 키로 테스트
curl -X GET "http://mkt.techb.kr:8447/api/v2/public/ranking/coupang?key=YOUR_TEST_API_KEY&keyword=%EB%85%B8%ED%8A%B8%EB%B6%81&code=12345"

# Test Client 키로 테스트 (낮은 rate limit)
curl -X GET "http://mkt.techb.kr:8447/api/v2/public/ranking/naver_store?key=YOUR_TEST_API_KEY_2&keyword=%EB%A7%88%EC%9A%B0%EC%8A%A4&code=67890"

# Demo Client 키로 테스트
curl -X GET "http://mkt.techb.kr:8447/api/v2/public/ranking/naver_compare?key=YOUR_TEST_API_KEY_3&keyword=%ED%82%A4%EB%B3%B4%EB%93%9C&code=54321"

# 실시간 크롤링 옵션 사용
curl -X GET "http://mkt.techb.kr:8447/api/v2/public/ranking/coupang?key=YOUR_TEST_API_KEY&keyword=%EB%85%B8%ED%8A%B8%EB%B6%81&code=12345&realtime=true"
```

**응답 예시:**
```json
{
  "success": true,
  "keyword": "노트북",
  "code": "123456",
  "rank": 3,
  "product": {
    "id": "123456",
    "name": "삼성 갤럭시북3",
    "price": 1299000,
    "rating": 4.5
  },
  "rankHistory": {
    "previous": 5,
    "change": 2,
    "lastChecked": "2025-01-22T10:00:00Z"
  },
  "collectedAt": "2025-01-22T11:00:00Z",
  "fromCache": false
}
```

#### 1.2 순위 변동 이력 (아직 미구현)
```
GET /api/v2/public/ranking/:platform/history?key=YOUR_API_KEY&keyword=X&code=Y&days=7
```

**파라미터:**
- `days`: 조회 기간 (1-365)

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "date": "2025-01-22T11:00:00Z",
        "rank": 3,
        "price": 1299000
      },
      {
        "date": "2025-01-22T10:00:00Z",
        "rank": 5,
        "price": 1299000
      }
    ]
  }
}
```

#### 1.3 경쟁 제품 조회 (아직 미구현)
```
GET /api/v2/public/ranking/:platform/competitors?key=YOUR_API_KEY&keyword=X&limit=10
```

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "id": "789012",
      "name": "LG 그램 17",
      "price": 1899000,
      "rating": 4.7
    }
  ]
}
```

## 2. 관리자 API (워크플로우)

### 인증
```
X-API-Key: YOUR_API_KEY
```

### 엔드포인트

#### 2.1 워크플로우 실행
```
POST /api/v2/workflows/:platform/execute
```

**요청 본문:**
```json
{
  "workflow": "search",
  "params": {
    "keyword": "노트북",
    "pages": 3,
    "limit": 100,
    "ignoreCache": true
  }
}
```

**새로운 옵션:**
- `ignoreCache`: true일 경우 캐시를 무시하고 새로 크롤링

**응답 예시:**
```json
{
  "success": true,
  "workflowId": "550e8400-e29b-41d4-a716-446655440000",
  "platform": "coupang",
  "products": [...],
  "executionTime": 2500
}
```

## 3. 데이터 저장 전략

### 페이지 단위 저장
- 크롤링은 항상 **전체 페이지** 단위로 수행
- 쿠팡: 72개/페이지
- 네이버 스토어: 40개/페이지
- 네이버 가격비교: 20개/페이지

### 예시 시나리오
1. 사용자가 "노트북" 키워드의 3위 제품 조회
2. 시스템이 1페이지 전체(36-40개) 크롤링
3. 모든 제품을 DB와 캐시에 저장
4. 요청한 3위 제품만 반환
5. 다른 사용자가 같은 키워드의 15위 조회 시 캐시에서 즉시 반환

## 4. 순위 추적

### 데이터 보관
- 순위 이력: 365일
- 시간별 크롤링: 하루 24회
- 순위 변동 자동 감지

### 데이터베이스 테이블
- `v2_products`: 제품 정보
- `v2_search_results`: 검색 결과
- `v2_ranking_history`: 순위 이력
- `v2_ranking_changes`: 순위 변동

## 5. API 사용량 관리

### 사용량 제한
각 API 키는 다음과 같은 제한이 있습니다:
- **시간당 제한 (Rate Limit)**
- **일일 제한 (Daily Limit)**

제한 초과 시 HTTP 429 응답을 받게 됩니다.

### 사용량 확인 (관리자 전용)
```bash
# API 키의 사용량 통계 조회
curl -X GET "http://mkt.techb.kr:8447/api/v2/api-keys/usage/YOUR_TEST_API_KEY" \
  -H "X-API-Key: YOUR_API_KEY"
```

## 6. 사용 예시

### 공개 API - 브라우저 직접 접속

URL을 브라우저에 직접 입력하여 결과를 확인할 수 있습니다:

```
# 쿠팡에서 "노트북" 검색, 제품 코드 12345 조회
http://mkt.techb.kr:8447/api/v2/public/ranking/coupang?key=YOUR_TEST_API_KEY&keyword=%EB%85%B8%ED%8A%B8%EB%B6%81&code=12345

# 네이버 스토어에서 "마우스" 검색, 제품 코드 67890 조회
http://mkt.techb.kr:8447/api/v2/public/ranking/naver_store?key=YOUR_TEST_API_KEY_2&keyword=%EB%A7%88%EC%9A%B0%EC%8A%A4&code=67890

# 네이버 가격비교에서 "키보드" 검색, 제품 코드 54321 조회
http://mkt.techb.kr:8447/api/v2/public/ranking/naver_compare?key=YOUR_TEST_API_KEY_3&keyword=%ED%82%A4%EB%B3%B4%EB%93%9C&code=54321
```

### 공개 API - cURL 명령어

```bash
# 쿠팡 - Default Client (시간당 1000회, 일일 10000회)
curl -X GET "http://mkt.techb.kr:8447/api/v2/public/ranking/coupang?key=YOUR_TEST_API_KEY&keyword=%EB%85%B8%ED%8A%B8%EB%B6%81&code=12345"

# 네이버 스토어 - Test Client (시간당 100회, 일일 1000회)
curl -X GET "http://mkt.techb.kr:8447/api/v2/public/ranking/naver_store?key=YOUR_TEST_API_KEY_2&keyword=%EB%A7%88%EC%9A%B0%EC%8A%A4&code=67890"

# 네이버 가격비교 - Demo Client (시간당 500회, 일일 5000회)
curl -X GET "http://mkt.techb.kr:8447/api/v2/public/ranking/naver_compare?key=YOUR_TEST_API_KEY_3&keyword=%ED%82%A4%EB%B3%B4%EB%93%9C&code=54321"

# 실시간 크롤링 옵션 사용 (캐시 무시)
curl -X GET "http://mkt.techb.kr:8447/api/v2/public/ranking/coupang?key=YOUR_TEST_API_KEY&keyword=%EB%85%B8%ED%8A%B8%EB%B6%81&code=12345&realtime=true"
```

### 워크플로우 API - cURL 명령어

```bash
# 쿠팡 검색 워크플로우 실행
curl -X POST "http://mkt.techb.kr:8447/api/v2/workflows/coupang/execute" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "search",
    "params": {
      "keyword": "노트북",
      "pages": 2,
      "limit": 100
    }
  }'

# 네이버 스토어 검색 (캐시 무시)
curl -X POST "http://mkt.techb.kr:8447/api/v2/workflows/naver_store/execute" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "search",
    "params": {
      "keyword": "마우스",
      "pages": 1,
      "ignoreCache": true
    }
  }'

# 네이버 가격비교 검색
curl -X POST "http://mkt.techb.kr:8447/api/v2/workflows/naver_compare/execute" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "search",
    "params": {
      "keyword": "키보드",
      "pages": 3
    }
  }'
```

### Python 예제 (참고용)
```python
import requests
import urllib.parse

# 공개 API - 순위 조회
keyword = urllib.parse.quote('노트북')
response = requests.get(
    f'http://mkt.techb.kr:8447/api/v2/public/ranking/coupang?key=YOUR_TEST_API_KEY&keyword={keyword}&code=123456'
)
print(response.json())

# 워크플로우 API - 검색 실행
headers = {'X-API-Key': 'YOUR_API_KEY'}
response = requests.post(
    'http://mkt.techb.kr:8447/api/v2/workflows/coupang/execute',
    json={
        'workflow': 'search',
        'params': {
            'keyword': '노트북',
            'pages': 2,
            'ignoreCache': True
        }
    },
    headers=headers
)
print(response.json())
```

## 7. 주의사항

1. **URL 인코딩**: 한글 키워드는 반드시 URL 인코딩
2. **Rate Limiting**: API 키별로 설정된 제한 적용
3. **캐시 TTL**: 1시간
4. **API 키 형식**: MD5 해시 형식 (32자)

## 8. 에러 코드

- `400`: 잘못된 요청 (파라미터 누락 등)
- `401`: 인증 실패 (잘못된 API 키)
- `404`: 리소스를 찾을 수 없음
- `429`: Rate limit 초과
- `500`: 서버 오류