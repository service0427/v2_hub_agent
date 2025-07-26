#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 기본 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
cd "$PROJECT_ROOT"

# logs 디렉토리가 없으면 생성
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo -e "${YELLOW}logs 디렉토리를 생성했습니다.${NC}"
fi

# 환경 변수 로드
if [ -f .env ]; then
    export $(cat .env | sed 's/#.*//g' | xargs)
fi

# 함수들
show_header() {
    clear
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}              웹 크롤러 에이전트 관리 도구${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
}

check_agent_status() {
    local port=$1
    local instance=$((port - 3000))
    
    # PID 파일이 있는지 확인
    if [ -f "logs/agent_${instance}.pid" ]; then
        local pid=$(cat "logs/agent_${instance}.pid")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${GREEN}실행중${NC} (PID: $pid)"
            return 0
        fi
    fi
    
    # 로그 파일에서 최근 활동 확인
    if [ -f "logs/agent_${instance}.log" ]; then
        # 최근 60초 이내의 로그가 있는지 확인
        local last_log_time=$(stat -c %Y "logs/agent_${instance}.log" 2>/dev/null || echo 0)
        local current_time=$(date +%s)
        local time_diff=$((current_time - last_log_time))
        
        if [ $time_diff -lt 60 ] && grep -q "Agent registered successfully" "logs/agent_${instance}.log"; then
            # 프로세스 찾기
            local pid=$(ps aux | grep -v grep | grep "node src/index.js" | awk 'NR=='$instance' {print $2}')
            if [ ! -z "$pid" ]; then
                echo -e "${GREEN}실행중${NC} (PID: $pid)"
                echo $pid > "logs/agent_${instance}.pid"
                return 0
            fi
        fi
    fi
    
    echo -e "${RED}정지됨${NC}"
    return 1
}

show_status() {
    show_header
    echo -e "${YELLOW}에이전트 상태:${NC}"
    echo "────────────────────────────────────────"
    
    for port in 3001 3002 3003 3004; do
        echo -n "포트 $port 에이전트: "
        check_agent_status $port
    done
    
    echo
    echo -e "${YELLOW}시스템 리소스:${NC}"
    echo "────────────────────────────────────────"
    
    # Memory usage
    local mem_usage=$(ps aux | grep "node.*index.js" | grep -v grep | awk '{sum += $6} END {print sum/1024}')
    echo "총 메모리 사용량: ${mem_usage:-0} MB"
    
    # Chrome processes
    local chrome_count=$(pgrep -f "chrome|chromium" | wc -l)
    echo "Chrome 프로세스: $chrome_count"
    
    # Log sizes
    local log_size=$(du -sh logs 2>/dev/null | cut -f1)
    echo "로그 디렉토리 크기: ${log_size:-0}"
}

start_single_agent() {
    echo -e "${YELLOW}단일 에이전트 시작 중...${NC}"
    
    # 환경 변수 설정
    export DISPLAY=${DISPLAY:-:0}
    export NODE_ENV=production
    export API_KEY=${API_KEY:-test-api-key-123}
    export HUB_URL=${HUB_URL:-https://u24.techb.kr}
    export AGENT_PORT=3001
    export INSTANCE_ID=1
    export HEADLESS=false
    export LOG_LEVEL=info
    
    nohup node src/index.js > logs/agent_1.log 2>&1 &
    sleep 2
    
    if check_agent_status 3001 > /dev/null; then
        echo -e "${GREEN}✓ 에이전트가 성공적으로 시작되었습니다${NC}"
    else
        echo -e "${RED}✗ 에이전트 시작 실패${NC}"
        echo "자세한 내용은 logs/agent_1.log를 확인하세요"
    fi
}

start_multi_agents() {
    echo -e "${YELLOW}다중 에이전트 시작 중...${NC}"
    
    # 기본 환경 변수 설정
    export DISPLAY=${DISPLAY:-:0}
    export NODE_ENV=production
    export API_KEY=${API_KEY:-test-api-key-123}
    export HUB_URL=${HUB_URL:-https://u24.techb.kr}
    export HEADLESS=false
    export LOG_LEVEL=info
    
    for i in {1..4}; do
        local port=$((3000 + i))
        
        echo -n "포트 $port에서 에이전트 시작... "
        
        AGENT_PORT=$port INSTANCE_ID=$i nohup node src/index.js > logs/agent_$i.log 2>&1 &
        sleep 1
        
        if check_agent_status $port > /dev/null; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
        fi
    done
}

stop_all_agents() {
    echo -e "${YELLOW}모든 에이전트 정지 중...${NC}"
    
    # PID 파일에서 프로세스 종료
    for i in {1..4}; do
        if [ -f "logs/agent_${i}.pid" ]; then
            local pid=$(cat "logs/agent_${i}.pid")
            if ps -p $pid > /dev/null 2>&1; then
                kill $pid 2>/dev/null
                echo "에이전트 $i (PID: $pid) 종료"
            fi
            rm -f "logs/agent_${i}.pid"
        fi
    done
    
    # 남은 프로세스 정리
    pkill -f "node.*src/index.js" 2>/dev/null
    
    sleep 1
    echo -e "${GREEN}✓ 모든 에이전트가 정지되었습니다${NC}"
}

view_logs() {
    echo -e "${YELLOW}로그 보기 선택:${NC}"
    echo "1) 모든 로그 (실시간)"
    echo "2) 에이전트 1 로그"
    echo "3) 에이전트 2 로그"
    echo "4) 에이전트 3 로그"
    echo "5) 에이전트 4 로그"
    echo "6) 모든 로그 삭제"
    echo "0) 메인 메뉴로 돌아가기"
    
    read -p "선택하세요: " log_choice
    
    case $log_choice in
        1) tail -f logs/*.log ;;
        2) tail -f logs/agent_1.log ;;
        3) tail -f logs/agent_2.log ;;
        4) tail -f logs/agent_3.log ;;
        5) tail -f logs/agent_4.log ;;
        6) 
            read -p "정말로 모든 로그를 삭제하시겠습니까? (y/N): " confirm
            if [ "$confirm" = "y" ]; then
                rm -f logs/*.log
                echo -e "${GREEN}✓ 로그가 삭제되었습니다${NC}"
            fi
            ;;
        0) return ;;
        *) echo -e "${RED}잘못된 선택입니다${NC}" ;;
    esac
}

configure_agent() {
    echo -e "${YELLOW}AGENT_ID 변경:${NC}"
    echo "────────────────────────────────────────"
    
    if [ -f .env ]; then
        echo -e "${GREEN}현재 설정:${NC}"
        echo "허브 URL: $(grep HUB_URL .env | cut -d'=' -f2)"
        echo "현재 AGENT_ID: $(grep AGENT_ID .env | cut -d'=' -f2)"
        echo
        echo ".env 파일을 편집하여 AGENT_ID를 변경하세요"
        read -p "Enter키를 눌러 편집기를 열거나 Ctrl+C로 취소: "
        nano .env
        echo -e "${GREEN}✓ 설정이 업데이트되었습니다${NC}"
    else
        echo -e "${RED}.env 파일을 찾을 수 없습니다!${NC}"
        echo "설치 스크립트를 먼저 실행하세요"
    fi
}

show_menu() {
    echo
    echo -e "${YELLOW}메인 메뉴:${NC}"
    echo "────────────────────────────────────────"
    echo "1) 상태 보기"
    echo "2) 단일 에이전트 시작"
    echo "3) 다중 에이전트 시작 (4개)"
    echo "4) 모든 에이전트 정지"
    echo "5) 모든 에이전트 재시작"
    echo "6) 로그 보기"
    echo "7) AGENT_ID 변경"
    echo "0) 종료"
    echo
    read -p "선택하세요: " choice
}

install_update() {
    echo -e "${YELLOW}의존성 설치/업데이트 중...${NC}"
    npm install
    npx playwright install chromium
    echo -e "${GREEN}✓ 의존성이 업데이트되었습니다${NC}"
}

# Main loop
main() {
    while true; do
        show_header
        show_status
        show_menu
        
        case $choice in
            1) ;; # Status already shown
            2) start_single_agent ;;
            3) start_multi_agents ;;
            4) stop_all_agents ;;
            5) 
                stop_all_agents
                sleep 2
                start_multi_agents
                ;;
            6) view_logs ;;
            7) configure_agent ;;
            0) 
                echo "안녕히가세요!"
                exit 0
                ;;
            *)
                echo -e "${RED}잘못된 선택입니다${NC}"
                ;;
        esac
        
        if [ "$choice" != "0" ]; then
            echo
            read -p "계속하려면 Enter를 누르세요..."
        fi
    done
}

# Run main function
main