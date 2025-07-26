#!/bin/bash

# Crawler Agent v2 Quick Install Script
# Usage: curl -s https://raw.githubusercontent.com/service0427/v2_hub_agent/main/install-quick.sh | bash -s -- [options]

set -e

# Default values
HUB_URL="http://u24.techb.kr:8447"
API_KEY=""
INSTALL_DIR="$HOME/crawler-agent"
INSTANCES=1
HOST_IP=""
NODE_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print colored output
print_msg() {
    local color=$1
    local msg=$2
    echo -e "${color}${msg}${NC}"
}

# Function to display usage
usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  --hub URL          Hub URL (default: http://u24.techb.kr:8447)"
    echo "  --key KEY          API key for authentication"
    echo "  --instances N      Number of agent instances (1-4, default: 1)"
    echo "  --ip IP            Host IP address (auto-detected if not specified)"
    echo "  --dir DIR          Installation directory (default: ~/crawler-agent)"
    echo "  --help             Show this help message"
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --hub)
            HUB_URL="$2"
            shift 2
            ;;
        --key)
            API_KEY="$2"
            shift 2
            ;;
        --instances)
            INSTANCES="$2"
            shift 2
            ;;
        --ip)
            HOST_IP="$2"
            shift 2
            ;;
        --dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --help)
            usage
            ;;
        *)
            print_msg $RED "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate inputs
if [ -z "$API_KEY" ]; then
    print_msg $RED "Error: API key is required"
    echo "Usage: $0 --key YOUR_API_KEY [options]"
    exit 1
fi

if [ "$INSTANCES" -lt 1 ] || [ "$INSTANCES" -gt 4 ]; then
    print_msg $RED "Error: Instances must be between 1 and 4"
    exit 1
fi

# Auto-detect IP if not specified
if [ -z "$HOST_IP" ]; then
    HOST_IP=$(hostname -I | awk '{print $1}')
    print_msg $YELLOW "Auto-detected IP: $HOST_IP"
fi

print_msg $BLUE "========================================="
print_msg $BLUE "  Crawler Agent v2 Quick Installer"
print_msg $BLUE "========================================="
echo ""
print_msg $GREEN "Configuration:"
echo "  Hub URL: $HUB_URL"
echo "  Host IP: $HOST_IP"
echo "  Instances: $INSTANCES"
echo "  Install Dir: $INSTALL_DIR"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_msg $YELLOW "Node.js not found. Installing Node.js $NODE_VERSION..."
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    print_msg $GREEN "✓ Node.js installed successfully"
else
    print_msg $GREEN "✓ Node.js is already installed ($(node --version))"
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_msg $YELLOW "Git not found. Installing git..."
    sudo apt-get update
    sudo apt-get install -y git
    print_msg $GREEN "✓ Git installed successfully"
fi

# Create installation directory
print_msg $YELLOW "Creating installation directory..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Download agent from GitHub
print_msg $YELLOW "Downloading Crawler Agent..."
if [ -d "agent" ]; then
    print_msg $YELLOW "Removing existing agent directory..."
    rm -rf agent
fi

# Download using git sparse-checkout
git init temp-repo
cd temp-repo
git remote add origin https://github.com/service0427/v2_hub_agent.git
git config core.sparseCheckout true
echo "agent-socketio/*" > .git/info/sparse-checkout
git pull origin main --depth=1
mv agent-socketio agent
mv agent ..
cd ..
rm -rf temp-repo

cd agent

# Install dependencies
print_msg $YELLOW "Installing dependencies..."
npm install

# Install Playwright browsers
print_msg $YELLOW "Installing Playwright browsers..."
npx playwright install chromium

# Install system dependencies for Playwright
print_msg $YELLOW "Installing system dependencies..."
sudo npx playwright install-deps chromium || {
    print_msg $YELLOW "Trying manual dependency installation..."
    sudo apt-get update
    sudo apt-get install -y \
        libnspr4 \
        libnss3 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libatspi2.0-0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libcairo2 \
        libpango-1.0-0 \
        libasound2
}

# Create .env file
print_msg $YELLOW "Creating environment configuration..."
cat > .env << EOF
# ParserHub v2 connection settings
HUB_URL=$HUB_URL
API_KEY=$API_KEY

# Agent configuration
AGENT_PORT=3001
INSTANCE_ID=1

# Chrome browser settings
HEADLESS=false
USER_DATA_DIR=$INSTALL_DIR/agent/data/users

# Logging
LOG_LEVEL=info
EOF

# Create systemd service files for each instance
if [ "$INSTANCES" -gt 1 ]; then
    print_msg $YELLOW "Creating systemd service files for $INSTANCES instances..."
    
    for i in $(seq 1 $INSTANCES); do
        PORT=$((3000 + i))
        SERVICE_NAME="crawler-agent@$i"
        
        sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null << EOF
[Unit]
Description=Crawler Agent v2 Instance $i
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/agent
Environment="NODE_ENV=production"
Environment="HUB_URL=$HUB_URL"
Environment="API_KEY=$API_KEY"
Environment="AGENT_PORT=$PORT"
Environment="INSTANCE_ID=$i"
Environment="HEADLESS=false"
ExecStart=/usr/bin/node src/index.js $PORT $i
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    done
    
    sudo systemctl daemon-reload
    print_msg $GREEN "✓ Systemd services created"
fi

# Create logs directory
print_msg $YELLOW "Creating logs directory..."
mkdir -p logs

# Check for management scripts
print_msg $YELLOW "Setting up management scripts..."
if [ ! -f "manage.sh" ]; then
    print_msg $RED "Error: manage.sh not found in the downloaded agent"
    print_msg $YELLOW "Please check the installation manually"
    exit 1
fi

# Make scripts executable
chmod +x manage.sh
[ -f "start-agents.sh" ] && chmod +x start-agents.sh
[ -f "pm2-start.sh" ] && chmod +x pm2-start.sh

# Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash
echo "Stopping all agent instances..."
pkill -f "node src/index.js"
echo "All instances stopped"
EOF
chmod +x stop.sh

# Create test script
cat > test-connection.sh << 'EOF'
#!/bin/bash
source .env
echo "Testing connection to hub: $HUB_URL"
curl -s $HUB_URL/health | jq . || echo "Connection failed"
EOF
chmod +x test-connection.sh

print_msg $GREEN "========================================="
print_msg $GREEN "✓ Installation completed successfully!"
print_msg $GREEN "========================================="
echo ""
print_msg $BLUE "Next steps:"
echo ""
echo "1. Test connection:"
echo "   cd $INSTALL_DIR/agent"
echo "   ./test-connection.sh"
echo ""
echo "2. Start agent(s):"
echo "   ./manage.sh  # Choose option 3 for multi-agent"
echo ""
echo "3. For systemd (if multiple instances):"
echo "   sudo systemctl start crawler-agent@1"
echo "   sudo systemctl enable crawler-agent@1"
echo ""
echo "4. View logs:"
echo "   tail -f logs/agent_1.log"
echo ""
print_msg $GREEN "Installation directory: $INSTALL_DIR/agent"