# ParserHub v2 외부 접근 설정 가이드

## 1. 환경 설정

### .env 파일 생성 및 수정
```bash
cd /home/techb/ParserHub/parserhub-v2
cp .env.example .env
```

`.env` 파일에서 다음 항목 확인:
```env
DB_HOST=mkt.techb.kr  # localhost가 아닌 외부 도메인
```

## 2. 방화벽 설정

### 포트 열기
```bash
# 방화벽 설정 스크립트 실행
./setup-firewall.sh

# 또는 수동으로
sudo ufw allow 8445/tcp comment 'ParserHub v2 API'
sudo ufw allow 8446/tcp comment 'ParserHub v2 Socket.io'
```

### 열린 포트 확인
```bash
sudo ufw status
netstat -tulpn | grep -E '8445|8446'
```

## 3. Docker 실행

```bash
# 빌드 및 실행
npm run docker:build
npm run docker:up

# 로그 확인
npm run docker:logs
```

## 4. 외부 접근 테스트

### 로컬에서 테스트
```bash
# 헬스 체크
curl http://mkt.techb.kr:8445/health

# API 테스트
./test-api.sh
```

### 외부 컴퓨터에서 테스트
```bash
# 다른 컴퓨터에서 실행
curl http://mkt.techb.kr:8445/health

# API 키를 포함한 요청
curl -H "X-API-Key: YOUR_API_KEY" \
  http://mkt.techb.kr:8445/api/v2/ranking/coupang?keyword=노트북&code=123456
```

## 5. 에이전트 연결

에이전트는 다음과 같이 연결합니다:
```typescript
const socket = io('http://mkt.techb.kr:8446', {
  auth: {
    apiKey: 'your-api-key'
  }
});
```

## 6. 문제 해결

### 연결이 안 될 때
1. 방화벽 확인: `sudo ufw status`
2. Docker 실행 확인: `docker ps`
3. 로그 확인: `npm run docker:logs`
4. 포트 사용 확인: `netstat -tulpn | grep -E '8445|8446'`

### CORS 에러가 날 때
- `.env`의 `CORS_ORIGIN=*` 확인
- 브라우저 개발자 도구에서 네트워크 탭 확인

## 7. 보안 권장사항

### 프로덕션 환경에서는:
1. API 키를 주기적으로 변경
2. Rate limiting 설정 강화
3. HTTPS 설정 (nginx reverse proxy 사용)
4. IP 화이트리스트 적용 (필요시)

### HTTPS 설정 예시 (nginx)
```nginx
server {
    listen 443 ssl;
    server_name mkt.techb.kr;
    
    ssl_certificate /etc/letsencrypt/live/mkt.techb.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mkt.techb.kr/privkey.pem;
    
    location /api/v2/ {
        proxy_pass http://localhost:8445;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /socket.io/ {
        proxy_pass http://localhost:8446;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 8. 모니터링

### 실시간 로그
```bash
# Docker 로그
npm run docker:logs

# 특정 컨테이너만
docker logs -f parserhub-v2-api
```

### 시스템 상태
```bash
# API로 확인
curl -H "X-API-Key: YOUR_API_KEY" \
  http://mkt.techb.kr:8445/api/v2/admin/stats
```