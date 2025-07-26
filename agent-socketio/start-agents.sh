#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 기본 환경 변수 설정
export DISPLAY=${DISPLAY:-:0}
export NODE_ENV=production
export API_KEY=${API_KEY:-test-api-key-123}
export HUB_URL=${HUB_URL:-https://u24.techb.kr}
export HEADLESS=${HEADLESS:-true}
export LOG_LEVEL=${LOG_LEVEL:-info}

# logs 디렉토리 생성
mkdir -p logs

echo "Starting 4 crawler agents..."

# 4개의 에이전트 시작
for i in {1..4}; do
    PORT=$((3000 + i))
    
    echo -n "Starting agent on port $PORT... "
    
    AGENT_PORT=$PORT INSTANCE_ID=$i nohup node src/index.js > logs/agent_$i.log 2>&1 &
    PID=$!
    echo $PID > logs/agent_$i.pid
    
    sleep 1
    
    if ps -p $PID > /dev/null; then
        echo -e "${GREEN}✓${NC} (PID: $PID)"
    else
        echo -e "${RED}✗${NC}"
    fi
done

echo "All agents started. Check logs/ directory for output."
echo "To stop all agents, run: pkill -f 'node src/index.js'"