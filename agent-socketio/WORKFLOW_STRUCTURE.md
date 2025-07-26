# 워크플로우 구조

## 디렉토리 구조

```
src/workflows/
├── coupang-search.js          # 쿠팡 검색 워크플로우 (프로덕션)
├── naver-shopping-store.js    # 네이버 스토어 검색 워크플로우 (프로덕션)
├── naver-shopping-compare.js  # 네이버 가격비교 워크플로우 (프로덕션)
├── logger.js                  # 워크플로우 로거 유틸리티
├── test/                      # 테스트 워크플로우
│   ├── mock-test.js          # 목 데이터 테스트
│   ├── simple-test.js        # 간단한 연결 테스트
│   └── test-webdriver.js     # 웹드라이버 기능 테스트
└── unused/                    # 미사용 워크플로우 (참고용)
    ├── github-mcp.js         # GitHub MCP 테스트 (미사용)
    ├── mcp-status.js         # MCP 상태 체크 (미사용)
    ├── sample-extract.js     # 샘플 추출 예제 (미사용)
    └── test-workflow.js      # 기본 워크플로우 테스트 (미사용)
```

## 프로덕션 워크플로우

### 1. coupang-search.js
- **용도**: 쿠팡 키워드 검색 및 상품 순위 추출
- **주요 기능**:
  - 페이지 기반 크롤링 (기본 4페이지)
  - HTTP 상태 코드 기반 차단 감지 (403, 429)
  - targetCode 지원 (특정 상품 발견 시 조기 종료)
  - 다중 ID 필드 추출 (productId, itemId, vendorItemId)

### 2. naver-shopping-store.js
- **용도**: 네이버 쇼핑 스토어 검색
- **주요 기능**:
  - 스토어별 상품 검색
  - 판매자 등급 정보 추출
  - 가격 및 리뷰 정보 수집

### 3. naver-shopping-compare.js
- **용도**: 네이버 가격비교 검색
- **주요 기능**:
  - 최저가 정보 추출
  - 판매처 수 집계
  - 상품 비교 정보 수집

## 테스트 워크플로우

### test/ 폴더
- **mock-test.js**: 네트워크 없이 목 데이터로 테스트
- **simple-test.js**: 기본 연결 및 응답 테스트
- **test-webdriver.js**: Playwright 기능 전체 테스트

## 워크플로우 매핑

`src/index.js`에서 플랫폼별 워크플로우 매핑:

```javascript
const workflowMap = {
  'coupang': 'coupang-search',
  'naver_store': 'naver-shopping-store',
  'naver_compare': 'naver-shopping-compare',
  'test': 'test/test-webdriver',
  'simple': 'test/simple-test',
  'mock': 'test/mock-test'
};
```

## 워크플로우 표준 인터페이스

모든 워크플로우는 다음 인터페이스를 따라야 합니다:

```javascript
module.exports = {
  async execute(page, params) {
    // params 구조:
    // - keyword: 검색 키워드
    // - limit: 결과 제한 (deprecated)
    // - pages: 크롤링할 페이지 수
    // - targetCode: 찾을 상품 코드 (optional)
    
    // 반환 구조:
    return {
      keyword: string,
      count: number,
      products: Array,
      blocked: boolean (optional),
      blockType: string (optional),
      error: string (optional),
      timestamp: ISO string
    };
  }
};
```

## 차단 감지 표준

차단이 감지되면 다음 형식으로 반환:

```javascript
{
  blocked: true,
  blockType: 'HTTP_403_FORBIDDEN' | 'HTTP_429_TOO_MANY_REQUESTS' | 'CAPTCHA' | 'UNKNOWN',
  error: '차단 사유 설명',
  products: [],
  count: 0,
  keyword: string,
  timestamp: ISO string
}
```