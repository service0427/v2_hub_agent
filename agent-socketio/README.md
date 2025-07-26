# Crawler Agent (Socket.io)

분산 웹 크롤링을 위한 Socket.io 기반 에이전트입니다.

## 특징

- Socket.io를 통한 실시간 허브 연결
- Playwright 기반 브라우저 자동화
- 다중 인스턴스 지원 (4개 동시 실행)
- 플랫폼별 워크플로우 (쿠팡, 네이버)
- 자동 재연결 및 에러 복구

## 빠른 시작

### 단일 에이전트 실행
```bash
# 기본 설정으로 실행
AGENT_PORT=3001 INSTANCE_ID=1 HEADLESS=true node src/index.js

# GUI 모드로 실행
AGENT_PORT=3001 INSTANCE_ID=1 HEADLESS=false node src/index.js
```

### 다중 에이전트 실행
```bash
# 관리 스크립트 사용
./manage.sh

# 또는 직접 실행
./start-agents.sh

# PM2 사용 (권장 - 자동 재시작 지원)
./pm2-start.sh
```

## 환경 설정

### 필수 환경 변수
- `HUB_URL`: 허브 서버 URL (기본: https://u24.techb.kr)
- `API_KEY`: API 인증 키 (기본: test-api-key-123)
- `AGENT_PORT`: 에이전트 포트 (3001-3004)
- `INSTANCE_ID`: 인스턴스 ID (1-4)
- `HEADLESS`: 헤드리스 모드 (true/false)

### 옵션 환경 변수
- `LOG_LEVEL`: 로그 레벨 (info/debug/error)
- `DISPLAY`: X11 디스플레이 (GUI 모드용)

## 워크플로우

지원하는 플랫폼:
- `coupang`: 쿠팡 상품 검색
- `naver_store`: 네이버 쇼핑 스토어
- `naver_compare`: 네이버 가격비교

자세한 내용은 [WORKFLOW_STRUCTURE.md](./WORKFLOW_STRUCTURE.md) 참조

## 디렉토리 구조

```
agent-socketio/
├── src/
│   ├── index.js              # 메인 에이전트 코드
│   └── workflows/            # 플랫폼별 워크플로우
├── logs/                     # 로그 파일
├── data/users/              # 브라우저 사용자 데이터
├── manage.sh                # 관리 스크립트
└── package.json
```

## 문제 해결

### 브라우저 페이지 생성 오류
첫 요청 시 발생할 수 있으며, 자동으로 복구됩니다.

### 차단 감지
HTTP 403/429 상태 코드로 차단을 감지하며, 적절한 에러 메시지를 반환합니다.

### 로그 확인
```bash
# 실시간 로그 보기
tail -f logs/agent_*.log

# 특정 에이전트 로그
tail -f logs/agent_1.log

# PM2 로그 확인
pm2 logs
```

## 자동 재시작 및 모니터링

### PM2를 통한 프로세스 관리 (권장)
PM2를 사용하면 다음 기능들이 자동으로 제공됩니다:
- **자동 재시작**: 크래시 시 자동으로 재시작
- **메모리 관리**: 500MB 초과 시 자동 재시작
- **로그 관리**: 자동 로그 로테이션
- **모니터링**: CPU, 메모리 사용량 실시간 확인

```bash
# PM2 설치
npm install -g pm2

# 에이전트 시작
./pm2-start.sh

# 상태 확인
pm2 status

# 실시간 모니터링
pm2 monit
```

### Socket.io 재연결
- 네트워크 문제 시 5초 간격으로 자동 재연결
- 무한 재시도로 안정적인 연결 유지
- 30초마다 heartbeat로 연결 상태 확인