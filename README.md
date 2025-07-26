# ParserHub v2 분산 크롤링 시스템

이커머스 플랫폼 상품 순위 모니터링을 위한 분산 웹 크롤링 시스템입니다.

## 🚀 주요 기능

- **실시간 상품 순위 추적**: 쿠팡, 네이버 쇼핑 등 주요 플랫폼 지원
- **분산 크롤링**: 여러 서버에 에이전트 분산 배치 가능
- **자동 모니터링**: 스케줄러를 통한 주기적 크롤링
- **RESTful API**: 간편한 데이터 조회 API 제공
- **안정적 운영**: 자동 재연결, 에러 복구, PM2 프로세스 관리 지원

## 📋 시스템 요구사항

- Ubuntu 20.04 이상
- Node.js 18.x
- PostgreSQL 12 이상
- Redis 6.x 이상
- 최소 1GB RAM (에이전트당)
- 2GB 이상 여유 디스크 공간

## 🏗️ 시스템 구성

```
v2_hub_agent/
├── parserhub-v2/      # 중앙 허브 서버
├── agent-socketio/    # 크롤링 에이전트
├── docs/              # 상세 문서
└── scripts/           # 설치 스크립트
```

### Hub (중앙 서버)
- API 서버 (포트 8445)
- Socket.io 서버 (포트 8446)
- 작업 분배 및 결과 수집
- 데이터베이스 관리

### Agent (크롤링 에이전트)
- Playwright 기반 브라우저 자동화
- Socket.io를 통한 실시간 통신
- 다중 인스턴스 지원 (서버당 최대 4개)

## 🚀 빠른 시작

### 1. 에이전트 설치 (권장)

```bash
# 단일 에이전트 설치
curl -s https://raw.githubusercontent.com/service0427/v2_hub_agent/main/install-quick.sh | bash -s -- --key YOUR_API_KEY

# 다중 에이전트 설치 (4개)
curl -s https://raw.githubusercontent.com/service0427/v2_hub_agent/main/install-quick.sh | bash -s -- --key YOUR_API_KEY --instances 4
```

### 2. 에이전트 실행

```bash
# 대화형 관리 도구 사용 (권장)
cd agent-socketio
./manage.sh

# PM2로 실행 (프로덕션 권장)
./pm2-start.sh

# 직접 실행
./start-agents.sh
```

### 3. 상태 확인

```bash
# 에이전트 상태 확인
./manage.sh  # 옵션 1 선택

# PM2 사용 시
pm2 status
pm2 monit
```

## 📡 API 사용 예제

### 상품 순위 조회

```bash
# 쿠팡 상품 순위 조회
curl "https://your-hub-url/api/v2/public/ranking/coupang?key=YOUR_API_KEY&keyword=노트북&code=123456789"

# 실시간 크롤링 요청
curl "https://your-hub-url/api/v2/public/ranking/coupang?key=YOUR_API_KEY&keyword=노트북&code=123456789&realtime=true"
```

### 응답 예시

```json
{
  "success": true,
  "data": {
    "rank": 5,
    "productId": "123456789",
    "name": "삼성 갤럭시북3",
    "price": 1590000,
    "rating": "4.5",
    "reviewCount": 1234,
    "page": 1
  },
  "keyword": "노트북",
  "code": "123456789",
  "timestamp": "2025-07-26T12:00:00.000+09:00"
}
```

## 🛠️ 고급 설정

### 환경 변수

```bash
# 에이전트 설정
HUB_URL=https://your-hub-url    # 허브 서버 URL
API_KEY=your-api-key             # API 인증 키
AGENT_PORT=3001                  # 에이전트 포트 (3001-3004)
INSTANCE_ID=1                    # 인스턴스 ID (1-4)
HEADLESS=true                    # 헤드리스 모드
LOG_LEVEL=info                   # 로그 레벨
```

### PM2 프로세스 관리

PM2를 사용하면 다음 기능이 자동으로 제공됩니다:

- **자동 재시작**: 크래시 시 자동 재시작
- **메모리 관리**: 500MB 초과 시 재시작
- **로그 관리**: 자동 로그 로테이션
- **모니터링**: CPU/메모리 실시간 모니터링

```bash
# PM2 설치
npm install -g pm2

# 에이전트 시작
./pm2-start.sh

# 시스템 재부팅 시 자동 시작
pm2 startup
pm2 save
```

## 📊 지원 플랫폼

- **쿠팡** (coupang)
  - 상품 검색 및 순위 추적
  - 가격, 평점, 리뷰수 수집
  
- **네이버 스토어** (naver_store)
  - 스마트스토어 상품 검색
  - 판매량, 스토어 정보 수집
  
- **네이버 가격비교** (naver_compare)
  - 가격비교 탭 상품 검색
  - 최저가, 판매처 정보 수집

## 🔧 문제 해결

### 에이전트 연결 문제
```bash
# 로그 확인
tail -f agent-socketio/logs/agent_*.log

# 네트워크 연결 테스트
curl -I https://your-hub-url/health
```

### 크롤링 차단 대응
- User-Agent 다양화 자동 적용
- 요청 간격 자동 조절
- 프록시 설정 가능

### 메모리 부족
```bash
# PM2 메모리 제한 조정
pm2 delete all
pm2 start ecosystem.config.js --max-memory-restart 1G
```

## 📚 상세 문서

- [API 가이드](./docs/API_V2_GUIDE.md)
- [에이전트 설정](./agent-socketio/README.md)
- [허브 서버 설정](./parserhub-v2/README.md)
- [아키텍처 설명](./docs/DISTRIBUTED_ARCHITECTURE_PRINCIPLES.md)

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🔐 보안 권고사항

- API 키는 환경 변수로 관리하세요
- 프로덕션 환경에서는 HTTPS를 사용하세요
- 방화벽에서 필요한 포트만 열어두세요
- 정기적으로 보안 업데이트를 적용하세요