# ParserHub v2 Hub & Agent

이 저장소는 ParserHub v2 시스템의 Hub와 Agent를 포함합니다.

## 구성

- `parserhub-v2/`: 중앙 허브 서버
- `agent-v2/`: 크롤러 에이전트
- `install-quick.sh`: 자동 설치 스크립트

## 빠른 시작 (에이전트 배포)

### 단일 에이전트 설치

```bash
curl -s https://raw.githubusercontent.com/service0427/v2_hub_agent/main/install-quick.sh | bash -s -- --key YOUR_API_KEY
```

### 다중 에이전트 설치 (4개 인스턴스)

```bash
curl -s https://raw.githubusercontent.com/service0427/v2_hub_agent/main/install-quick.sh | bash -s -- --key YOUR_API_KEY --instances 4
```

### 커스텀 설정으로 설치

```bash
curl -s https://raw.githubusercontent.com/service0427/v2_hub_agent/main/install-quick.sh | bash -s -- \
  --hub http://your-hub-url:8447 \
  --key YOUR_API_KEY \
  --instances 2 \
  --ip 192.168.1.100 \
  --dir /opt/crawler-agent
```

## 설치 옵션

- `--hub URL`: Hub 서버 URL (기본값: http://mkt.techb.kr:8447)
- `--key KEY`: API 인증 키 (필수)
- `--instances N`: 에이전트 인스턴스 수 (1-4, 기본값: 1)
- `--ip IP`: 호스트 IP 주소 (자동 감지)
- `--dir DIR`: 설치 디렉토리 (기본값: ~/crawler-agent-v2)

## 설치 후 사용법

### 1. 연결 테스트

```bash
cd ~/crawler-agent-v2/agent-v2
./test-connection.sh
```

### 2. 에이전트 실행

단일 인스턴스:
```bash
./start.sh
```

다중 인스턴스:
```bash
./start.sh 4  # 4개 인스턴스 실행
```

### 3. Systemd 서비스 (다중 인스턴스)

```bash
# 서비스 시작
sudo systemctl start crawler-agent-v2@1
sudo systemctl start crawler-agent-v2@2

# 부팅 시 자동 시작
sudo systemctl enable crawler-agent-v2@1
sudo systemctl enable crawler-agent-v2@2

# 상태 확인
sudo systemctl status crawler-agent-v2@*
```

### 4. 로그 확인

```bash
# 실시간 로그
tail -f logs/agent_1.log

# 모든 인스턴스 로그
tail -f logs/agent_*.log
```

### 5. 에이전트 중지

```bash
./stop.sh
```

## 시스템 요구사항

- Ubuntu 20.04 이상
- Node.js 18.x 이상 (자동 설치됨)
- 메모리: 인스턴스당 최소 1GB
- 디스크: 최소 2GB 여유 공간

## 에이전트 아키텍처

### 특징
- **헤드리스 모드**: GUI 없는 서버 환경 지원
- **다중 인스턴스**: 단일 서버에서 최대 4개 인스턴스 실행
- **자동 재연결**: 네트워크 문제 시 자동 재연결
- **순차 할당**: IP와 인스턴스 기반 작업 분배

### 지원 플랫폼
- 쿠팡 (coupang)
- 네이버 스토어 (naver_store)
- 네이버 가격비교 (naver_compare)

## 문제 해결

### 1. 브라우저 실행 오류

```bash
# Playwright 의존성 재설치
sudo npx playwright install-deps chromium
```

### 2. 권한 오류

```bash
# 설치 디렉토리 권한 확인
sudo chown -R $USER:$USER ~/crawler-agent-v2
```

### 3. 포트 충돌

기본 포트 (3001-3004)가 사용 중인 경우:
```bash
# .env 파일 수정
nano ~/crawler-agent-v2/agent-v2/.env
# AGENT_PORT를 다른 값으로 변경
```

## 대량 배포

여러 서버에 동시 배포 시:

```bash
# servers.txt 파일에 서버 목록 작성
# 192.168.1.101
# 192.168.1.102
# 192.168.1.103

# 배포 스크립트
while read server; do
  echo "Deploying to $server..."
  ssh user@$server "curl -s https://raw.githubusercontent.com/service0427/v2_hub_agent/main/install-quick.sh | bash -s -- --key YOUR_KEY --instances 4 --ip $server"
done < servers.txt
```

## 보안 주의사항

- API 키는 안전하게 보관하세요
- 프로덕션 환경에서는 환경 변수로 API 키를 관리하세요
- 방화벽에서 Hub 서버로의 아웃바운드 연결만 허용하세요

## 라이선스

MIT License