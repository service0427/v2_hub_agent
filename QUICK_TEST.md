# 빠른 테스트 명령어

## 1. 가장 간단한 설치 (기본 Hub 사용)

```bash
curl -s https://raw.githubusercontent.com/service0427/v2_hub_agent/main/install-quick.sh | bash -s -- --key YOUR_API_KEY
```

## 2. 설치 후 테스트

```bash
cd ~/crawler-agent-v2/agent-v2
./start.sh
```

## 3. 로그 확인

```bash
tail -f ~/crawler-agent-v2/agent-v2/logs/agent_1.log
```

## 4. 다중 인스턴스 (4개) 설치

```bash
curl -s https://raw.githubusercontent.com/service0427/v2_hub_agent/main/install-quick.sh | bash -s -- --key YOUR_API_KEY --instances 4
```

## 5. 커스텀 Hub URL 사용

```bash
curl -s https://raw.githubusercontent.com/service0427/v2_hub_agent/main/install-quick.sh | bash -s -- --hub http://your-hub:8447 --key YOUR_API_KEY
```