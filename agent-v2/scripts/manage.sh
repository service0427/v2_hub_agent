#!/bin/bash

# Agent v2 Management Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
DATA_DIR="$PROJECT_DIR/data"

# Create necessary directories
mkdir -p "$LOG_DIR" "$DATA_DIR/users"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display header
display_header() {
    clear
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    Crawler Agent v2 Management Tool    ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Function to check if agent is running
check_agent() {
    local port=$1
    if lsof -i:$port > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Agent on port $port is running"
        return 0
    else
        echo -e "${RED}✗${NC} Agent on port $port is not running"
        return 1
    fi
}

# Function to start agent
start_agent() {
    local port=$1
    local instance=$2
    
    echo -e "${YELLOW}Starting agent on port $port (instance $instance)...${NC}"
    
    cd "$PROJECT_DIR"
    nohup node src/index.js $port $instance > "$LOG_DIR/agent_${port}.log" 2>&1 &
    
    sleep 2
    
    if check_agent $port > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Agent started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start agent${NC}"
    fi
}

# Function to stop agent
stop_agent() {
    local port=$1
    
    echo -e "${YELLOW}Stopping agent on port $port...${NC}"
    
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        kill -TERM $pid
        sleep 2
        
        # Force kill if still running
        if lsof -i:$port > /dev/null 2>&1; then
            kill -9 $pid
        fi
        
        echo -e "${GREEN}✓ Agent stopped${NC}"
    else
        echo -e "${YELLOW}Agent not running${NC}"
    fi
}

# Function to show status
show_status() {
    display_header
    echo "Agent Status:"
    echo "-------------"
    
    for port in 3001 3002 3003 3004; do
        check_agent $port
    done
    
    echo ""
    echo "Hub Connection:"
    echo "---------------"
    
    if [ -f "$PROJECT_DIR/.env" ]; then
        source "$PROJECT_DIR/.env"
        echo "Hub URL: $HUB_URL"
        
        # Test hub connection
        if curl -s -k "$HUB_URL/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Hub is reachable${NC}"
        else
            echo -e "${RED}✗ Hub is not reachable${NC}"
        fi
    else
        echo -e "${RED}✗ .env file not found${NC}"
    fi
}

# Function to start multiple agents
start_multiple() {
    display_header
    echo "Starting multiple agents..."
    echo ""
    
    local count=0
    read -p "How many agents to start? (1-4): " count
    
    if [[ ! "$count" =~ ^[1-4]$ ]]; then
        echo -e "${RED}Invalid number. Please enter 1-4.${NC}"
        return
    fi
    
    for ((i=1; i<=count; i++)); do
        local port=$((3000 + i))
        start_agent $port $i
    done
}

# Function to stop all agents
stop_all() {
    display_header
    echo "Stopping all agents..."
    echo ""
    
    for port in 3001 3002 3003 3004; do
        if lsof -i:$port > /dev/null 2>&1; then
            stop_agent $port
        fi
    done
}

# Function to view logs
view_logs() {
    display_header
    echo "Available logs:"
    echo "---------------"
    
    local logs=()
    local i=1
    
    for log in "$LOG_DIR"/*.log; do
        if [ -f "$log" ]; then
            logs+=("$log")
            echo "$i) $(basename "$log")"
            ((i++))
        fi
    done
    
    if [ ${#logs[@]} -eq 0 ]; then
        echo "No logs found"
        return
    fi
    
    echo ""
    read -p "Select log to view (number): " selection
    
    if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le ${#logs[@]} ]; then
        tail -f "${logs[$((selection-1))]}"
    else
        echo -e "${RED}Invalid selection${NC}"
    fi
}

# Main menu
main_menu() {
    while true; do
        display_header
        echo "Select an option:"
        echo "----------------"
        echo "1) Show agent status"
        echo "2) Start single agent"
        echo "3) Start multiple agents"
        echo "4) Stop single agent"
        echo "5) Stop all agents"
        echo "6) View logs"
        echo "7) Setup environment"
        echo "0) Exit"
        echo ""
        
        read -p "Enter your choice: " choice
        
        case $choice in
            1)
                show_status
                ;;
            2)
                display_header
                read -p "Enter port (3001-3004): " port
                read -p "Enter instance ID (1-4): " instance
                start_agent $port $instance
                ;;
            3)
                start_multiple
                ;;
            4)
                display_header
                read -p "Enter port to stop (3001-3004): " port
                stop_agent $port
                ;;
            5)
                stop_all
                ;;
            6)
                view_logs
                ;;
            7)
                display_header
                if [ ! -f "$PROJECT_DIR/.env" ]; then
                    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
                    echo -e "${GREEN}✓ Created .env file from example${NC}"
                    echo "Please edit .env file with your settings"
                else
                    echo ".env file already exists"
                fi
                
                # Install dependencies
                read -p "Install npm dependencies? (y/n): " install
                if [ "$install" = "y" ]; then
                    cd "$PROJECT_DIR"
                    npm install
                fi
                ;;
            0)
                echo "Exiting..."
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option${NC}"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Start the menu
main_menu