# Crawler Agent v2

ParserHub v2와 호환되는 새로운 크롤러 에이전트입니다.

## 주요 특징

- Socket.io를 통한 실시간 통신
- IP:인스턴스 기반 에이전트 식별
- Playwright 기반 브라우저 자동화
- 다중 플랫폼 지원 (쿠팡, 네이버 스토어, 네이버 가격비교)

## 설치

```bash
npm install
cp .env.example .env
# .env 파일을 수정하여 Hub URL과 API 키 설정
```

## 실행

### 단일 에이전트 실행
```bash
node src/index.js 3001 1  # 포트 3001, 인스턴스 ID 1
```

### 관리 도구 사용
```bash
./scripts/manage.sh
```

## 환경 변수

- `HUB_URL`: ParserHub v2 서버 URL (기본값: https://mkt.techb.kr:8447)
- `API_KEY`: 인증용 API 키
- `AGENT_PORT`: 에이전트 포트 (기본값: 3001)
- `INSTANCE_ID`: 인스턴스 ID (1-4)
- `HEADLESS`: 헤드리스 모드 (기본값: false)

## 아키텍처

### 에이전트 구조
- `src/index.js`: 메인 에이전트 서버
- `src/workflows/`: 플랫폼별 워크플로우 모듈
- `scripts/manage.sh`: 에이전트 관리 도구

### 통신 프로토콜
1. Socket.io 연결 (WebSocket)
2. API 키 인증
3. 에이전트 등록 (`register` 이벤트)
4. 하트비트 전송 (10초마다)
5. 태스크 수신 및 실행
6. 결과 전송

### 지원 태스크 타입
- `workflow`: 워크플로우 실행
- `navigate`: URL 이동
- `extract`: 데이터 추출

## 워크플로우

### 쿠팡 검색
```javascript
{
  type: "workflow",
  data: {
    platform: "coupang",
    workflow: "search",
    params: {
      keyword: "노트북",
      pages: 2,
      limit: 100
    }
  }
}
```

### 네이버 스토어 검색
```javascript
{
  type: "workflow",
  data: {
    platform: "naver_store",
    workflow: "search",
    params: {
      keyword: "마우스",
      pages: 1
    }
  }
}
```

## 개발 노트

- 기존 crawler-agent와 달리 Socket.io 기반으로 구현
- parserhub-v2의 에이전트 관리 시스템과 완벽 호환
- IP와 인스턴스 ID로 에이전트 식별 (순차 할당 지원)