#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting crawler agents with PM2...${NC}"

# PM2가 설치되어 있는지 확인
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}PM2가 설치되어 있지 않습니다.${NC}"
    echo "설치하려면: npm install -g pm2"
    exit 1
fi

# 기존 PM2 프로세스 정지
pm2 delete crawler-agent-1 crawler-agent-2 crawler-agent-3 crawler-agent-4 2>/dev/null

# PM2로 에이전트 시작
pm2 start ecosystem.config.js

# 상태 표시
pm2 status

echo -e "${GREEN}✓ 모든 에이전트가 PM2로 시작되었습니다.${NC}"
echo ""
echo "유용한 PM2 명령어:"
echo "  pm2 status         - 상태 확인"
echo "  pm2 logs           - 모든 로그 보기"
echo "  pm2 logs 0         - 특정 에이전트 로그"
echo "  pm2 restart all    - 모두 재시작"
echo "  pm2 stop all       - 모두 정지"
echo "  pm2 monit          - 실시간 모니터링"