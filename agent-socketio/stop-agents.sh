#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Stopping all crawler agents..."

# PID 파일로 정지
for i in {1..4}; do
    if [ -f "logs/agent_$i.pid" ]; then
        PID=$(cat logs/agent_$i.pid)
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID
            echo -e "Agent $i (PID: $PID) ${GREEN}stopped${NC}"
        fi
        rm -f logs/agent_$i.pid
    fi
done

# 남은 프로세스 정리
pkill -f "node src/index.js" 2>/dev/null

echo -e "${GREEN}All agents stopped.${NC}"