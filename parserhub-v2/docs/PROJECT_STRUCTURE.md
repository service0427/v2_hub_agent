# ParserHub v2 프로젝트 구조

## 디렉토리 구조

```
parserhub-v2/
├── src/                    # 소스 코드
│   ├── api/               # API 엔드포인트 (레거시)
│   ├── routes/            # Express 라우터
│   ├── services/          # 비즈니스 로직
│   ├── models/            # 데이터베이스 모델
│   ├── socket/            # Socket.io 에이전트 관리
│   ├── middleware/        # Express 미들웨어
│   ├── config/            # 설정 파일
│   ├── db/                # 데이터베이스 관련
│   ├── types/             # TypeScript 타입 정의
│   └── utils/             # 유틸리티 함수
├── scripts/               # 유틸리티 스크립트
├── tests/                 # 테스트 파일
├── docs/                  # 추가 문서
├── docker/                # Docker 관련 파일
├── logs/                  # 로그 파일
└── dist/                  # 빌드 결과물
```

## 주요 파일

### 루트 디렉토리
- `README.md` - 프로젝트 개요
- `API_V2_GUIDE.md` - API 사용 가이드
- `quick-test.sh` - 빠른 테스트 스크립트
- `ecosystem.config.js` - PM2 설정
- `package.json` - Node.js 의존성
- `tsconfig.json` - TypeScript 설정

### 소스 코드 (src/)
- `index.ts` - 애플리케이션 진입점
- `app.ts` - Express 앱 설정

### 핵심 기능
- **에이전트 관리**: `src/socket/agentManager.ts`
- **검색 서비스**: `src/services/searchService.ts`
- **순위 서비스**: `src/services/rankingService.ts`
- **스케줄러**: `src/services/schedulerService.ts`
- **API 인증**: `src/middleware/auth.ts`

### 데이터베이스 모델
- `ApiKey.ts` - API 키 관리
- `Product.ts` - 제품 정보
- `SearchResult.ts` - 검색 결과
- `RankingHistory.ts` - 순위 이력
- `MonitoringKeyword.ts` - 모니터링 키워드

## 테스트 파일 (tests/)
- `test-api.sh` - API 엔드포인트 테스트
- `test-api-keys.sh` - API 키 인증 테스트
- `test-scheduler.sh` - 스케줄러 테스트
- 기타 테스트 스크립트들

## 문서 (docs/)
- `DEPLOYMENT.md` - 배포 가이드
- `SCHEDULER_IMPLEMENTATION.md` - 스케줄러 구현 상세
- `MONITORING_KEYWORDS_AUTO_REGISTRATION.md` - 키워드 자동 등록
- 기타 기술 문서들