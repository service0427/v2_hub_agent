require('dotenv').config();
const { chromium } = require('playwright');
const io = require('socket.io-client');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration
const HUB_URL = process.env.HUB_URL || 'https://mkt.techb.kr:8447';
const API_KEY = process.env.API_KEY || 'YOUR_API_KEY';
const AGENT_PORT = process.env.AGENT_PORT || process.argv[2] || 3001;
const INSTANCE_ID = process.env.INSTANCE_ID || process.argv[3] || '1';
const USER_DATA_DIR = process.env.USER_DATA_DIR || path.join(__dirname, '../data/users');

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(__dirname, '../logs/agent.log') })
  ]
});

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Global variables
let browser;
let context;
let socket;
let isConnected = false;
let agentInfo = {
  hostIp: getLocalIP(),
  instanceId: parseInt(INSTANCE_ID),
  port: parseInt(AGENT_PORT),
  status: 'initializing',
  browserInfo: null,
  capabilities: ['search', 'extract', 'navigate']
};

// Initialize browser
async function initBrowser() {
  try {
    const userDataPath = path.join(USER_DATA_DIR, `user_${AGENT_PORT}`);
    
    // Ensure user data directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    const isHeadless = process.env.HEADLESS === 'true';
    
    const launchArgs = [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ];
    
    // Only add window position/size for non-headless mode
    if (!isHeadless) {
      const screenWidth = 1920;
      const screenHeight = 1080;
      const windowWidth = Math.floor(screenWidth / 2);
      const windowHeight = Math.floor(screenHeight / 2);
      
      let windowX = 0;
      let windowY = 0;
      
      switch (parseInt(INSTANCE_ID)) {
        case 1: windowX = 0; windowY = 0; break;
        case 2: windowX = windowWidth; windowY = 0; break;
        case 3: windowX = 0; windowY = windowHeight; break;
        case 4: windowX = windowWidth; windowY = windowHeight; break;
        default:
          const position = (parseInt(INSTANCE_ID) - 1) % 4;
          windowX = (position % 2) * windowWidth;
          windowY = Math.floor(position / 2) * windowHeight;
      }
      
      launchArgs.push(`--window-position=${windowX},${windowY}`);
      launchArgs.push(`--window-size=${windowWidth},${windowHeight}`);
      logger.info(`Initializing browser at position (${windowX}, ${windowY})`);
    } else {
      logger.info('Initializing browser in headless mode');
    }
    
    browser = await chromium.launch({
      headless: isHeadless,
      args: launchArgs
    });
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }, // Standard viewport for headless
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul'
    });
    
    // Create initial page
    const page = await context.newPage();
    await page.goto('https://www.google.com');
    
    // Update browser info
    agentInfo.browserInfo = {
      name: 'chromium',
      version: browser.version(),
      userDataPath: userDataPath
    };
    
    agentInfo.status = 'ready';
    logger.info('Browser initialized successfully', agentInfo);
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize browser:', error);
    agentInfo.status = 'error';
    return false;
  }
}

// Connect to hub via Socket.io
function connectToHub() {
  logger.info(`Connecting to hub at ${HUB_URL}`);
  
  socket = io(HUB_URL, {
    auth: {
      apiKey: API_KEY
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    rejectUnauthorized: false // For self-signed certificates
  });
  
  // Connection events
  socket.on('connect', () => {
    logger.info('Connected to hub');
    isConnected = true;
    registerAgent();
  });
  
  socket.on('disconnect', (reason) => {
    logger.warn('Disconnected from hub:', reason);
    isConnected = false;
    agentInfo.status = 'disconnected';
  });
  
  socket.on('connect_error', (error) => {
    logger.error('Connection error:', error.message);
  });
  
  // Hub events
  socket.on('registered', (data) => {
    logger.info('Agent registered successfully:', data);
    agentInfo.status = 'online';
    startHeartbeat();
  });
  
  socket.on('task:execute', async (task) => {
    logger.info('Received task execution request:', task);
    await executeTask(task);
  });
  
  socket.on('command', async (data) => {
    logger.info('Received command:', data);
    await handleCommand(data);
  });
}

// Register agent with hub
function registerAgent() {
  const registrationData = {
    id: `agent-${agentInfo.hostIp}-${agentInfo.instanceId}`,
    name: `Chrome Instance ${agentInfo.instanceId}`,
    hostIp: agentInfo.hostIp,
    instanceId: agentInfo.instanceId,
    platform: 'all', // Agent can handle all platforms
    capabilities: agentInfo.capabilities,
    browserInfo: agentInfo.browserInfo
  };
  
  logger.info('Registering agent:', registrationData);
  socket.emit('register', registrationData);
}

// Start heartbeat
function startHeartbeat() {
  setInterval(() => {
    if (isConnected) {
      socket.emit('heartbeat');
      socket.emit('status', agentInfo.status);
    }
  }, 10000); // Every 10 seconds
}

// Execute task
async function executeTask(task) {
  const { id: taskId, type, data } = task;
  
  try {
    agentInfo.status = 'busy';
    socket.emit('status', 'busy');
    
    let result;
    
    switch (type) {
      case 'workflow':
        result = await executeWorkflow(data);
        break;
        
      case 'navigate':
        result = await navigateToUrl(data);
        break;
        
      case 'extract':
        result = await extractData(data);
        break;
        
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
    
    // Send results back to hub
    socket.emit('task:result', {
      taskId,
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Task ${taskId} completed successfully`);
    
  } catch (error) {
    logger.error(`Task ${taskId} failed:`, error);
    
    socket.emit('task:result', {
      taskId,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    agentInfo.status = 'online';
    socket.emit('status', 'online');
  }
}

// Execute workflow
async function executeWorkflow(data) {
  const { platform, workflow, params } = data;
  
  try {
    // Load workflow module
    const workflowPath = path.join(__dirname, 'workflows', `${platform}-${workflow}.js`);
    
    if (!fs.existsSync(workflowPath)) {
      throw new Error(`Workflow not found: ${platform}-${workflow}`);
    }
    
    const workflowModule = require(workflowPath);
    
    // Execute workflow
    const page = context.pages()[0] || await context.newPage();
    const result = await workflowModule.execute(page, params);
    
    return result;
    
  } catch (error) {
    logger.error('Workflow execution failed:', error);
    throw error;
  }
}

// Navigate to URL
async function navigateToUrl(data) {
  const { url, waitUntil = 'networkidle' } = data;
  
  const page = context.pages()[0] || await context.newPage();
  await page.goto(url, { waitUntil, timeout: 30000 });
  
  return {
    url: page.url(),
    title: await page.title()
  };
}

// Extract data from page
async function extractData(data) {
  const { selector, type = 'text' } = data;
  
  const page = context.pages()[0];
  if (!page) {
    throw new Error('No active page');
  }
  
  switch (type) {
    case 'text':
      return await page.textContent(selector);
    case 'html':
      return await page.innerHTML(selector);
    case 'attribute':
      return await page.getAttribute(selector, data.attribute);
    default:
      throw new Error(`Unknown extract type: ${type}`);
  }
}

// Handle commands from hub
async function handleCommand(data) {
  const { command, params } = data;
  
  try {
    switch (command) {
      case 'restart':
        logger.info('Restarting browser...');
        await closeBrowser();
        await initBrowser();
        break;
        
      case 'status':
        socket.emit('agent:status', agentInfo);
        break;
        
      case 'shutdown':
        logger.info('Shutting down agent...');
        await shutdown();
        break;
        
      default:
        logger.warn('Unknown command:', command);
    }
  } catch (error) {
    logger.error('Command execution failed:', error);
  }
}

// Close browser
async function closeBrowser() {
  try {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
    browser = null;
    context = null;
    logger.info('Browser closed');
  } catch (error) {
    logger.error('Error closing browser:', error);
  }
}

// Shutdown agent
async function shutdown() {
  logger.info('Shutting down agent...');
  
  if (socket) {
    socket.disconnect();
  }
  
  await closeBrowser();
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

// Handle process signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start agent
async function start() {
  logger.info(`Starting crawler agent v2 on port ${AGENT_PORT}, instance ${INSTANCE_ID}`);
  
  // Initialize browser
  const browserReady = await initBrowser();
  if (!browserReady) {
    logger.error('Failed to initialize browser, exiting...');
    process.exit(1);
  }
  
  // Connect to hub
  connectToHub();
}

// Start the agent
start();