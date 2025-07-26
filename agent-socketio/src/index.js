require('dotenv').config();
const { io } = require('socket.io-client');
const { chromium } = require('playwright');
const winston = require('winston');
const os = require('os');
const path = require('path');
// const HealthMonitor = require('./health-monitor');

// Configuration
const HUB_URL = process.env.HUB_URL || 'https://u24.techb.kr';
const API_KEY = process.env.API_KEY || 'test-api-key-123';
const AGENT_PORT = process.env.AGENT_PORT || 3001;
const INSTANCE_ID = parseInt(process.env.INSTANCE_ID || '1');
const HEADLESS = process.env.HEADLESS === 'true';

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf(({ timestamp, level, message, ...rest }) => {
      const restStr = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${restStr}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Get host IP
function getHostIp() {
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

let socket;
let browser;
let context;
// let healthMonitor;

// Calculate window position for GUI mode
function getWindowPosition(instanceId) {
  const screenWidth = 1920;
  const screenHeight = 1080;
  const cols = 2;
  const rows = 2;
  const windowWidth = Math.floor(screenWidth / cols);
  const windowHeight = Math.floor(screenHeight / rows);
  
  const index = (instanceId - 1) % 4;
  const col = index % cols;
  const row = Math.floor(index / cols);
  
  return {
    x: col * windowWidth,
    y: row * windowHeight,
    width: windowWidth,
    height: windowHeight
  };
}

async function closeBrowser() {
  try {
    if (context) {
      await context.close();
      context = null;
      logger.info('Browser context closed');
    }
    if (browser) {
      await browser.close();
      browser = null;
      logger.info('Browser closed');
    }
  } catch (error) {
    logger.error('Error closing browser:', error.message);
    // Force reset
    browser = null;
    context = null;
  }
}

async function initBrowser() {
  try {
    // Close existing browser if any
    await closeBrowser();
    
    const position = getWindowPosition(INSTANCE_ID);
    const userDataDir = `/home/tech/v2_hub_agent_final/agent-socketio/data/users/user_${AGENT_PORT}`;
    
    // Ensure user data directory exists
    const fs = require('fs');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    logger.info(`Initializing browser at position (${position.x}, ${position.y})`);
    
    const launchOptions = {
      headless: HEADLESS,
      channel: 'chrome',  // Use installed Chrome instead of Chromium
      args: [
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=AutomationControlled'
      ]
    };
    
    if (!HEADLESS) {
      launchOptions.args.push(
        `--window-position=${position.x},${position.y}`,
        `--window-size=${position.width},${position.height}`
      );
    }
    
    browser = await chromium.launch(launchOptions);
    context = await browser.newContext({
      userDataDir: userDataDir,
      viewport: { width: position.width, height: position.height }
    });
    
    // Create and keep at least one page to maintain context
    await context.newPage();
    
    const version = browser.version();
    logger.info('Browser initialized successfully', {
      hostIp: getHostIp(),
      instanceId: INSTANCE_ID,
      port: AGENT_PORT,
      status: 'ready',
      browserInfo: {
        name: 'chromium',
        version: version,
        userDataPath: userDataDir
      },
      capabilities: ['search', 'extract', 'navigate']
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize browser:', error);
    browser = null;
    context = null;
    return false;
  }
}

async function connectToHub() {
  logger.info(`Connecting to hub at ${HUB_URL}`);
  
  socket = io(HUB_URL, {
    auth: {
      apiKey: API_KEY
    },
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: Infinity
  });
  
  socket.on('connect', () => {
    logger.info('Connected to hub');
    
    // Register agent
    const hostIp = getHostIp();
    const agentInfo = {
      id: `agent-${hostIp}-${INSTANCE_ID}`,
      name: `Chrome Instance ${INSTANCE_ID}`,
      hostIp: hostIp,
      instanceId: INSTANCE_ID,
      platform: 'all',
      capabilities: ['search', 'extract', 'navigate'],
      browserInfo: {
        name: 'chromium',
        version: browser?.version() || 'unknown',
        userDataPath: `/home/tech/v2_hub_agent_final/agent-socketio/data/users/user_${AGENT_PORT}`
      }
    };
    
    logger.info('Registering agent:', agentInfo);
    socket.emit('register', agentInfo);
  });
  
  socket.on('registered', (data) => {
    logger.info('Agent registered successfully:', data);
    
    // Start health monitoring after registration
    // if (!healthMonitor) {
    //   healthMonitor = new HealthMonitor(socket, 10000, logger); // 10초 간격, logger 전달
    //   healthMonitor.start();
    //   logger.info('Health monitoring started');
    // }
  });
  
  socket.on('task:assign', async (task) => {
    logger.info(`Task assigned: ${task.id}`, { type: task.type, platform: task.platform });
    
    try {
      // Handle different task types
      if (task.type === 'crawl') {
        const result = await executeCrawlTask(task);
        logger.info(`Sending task result for ${task.id}:`, {
          productCount: result?.products?.length || 0,
          blocked: result?.blocked || false
        });
        socket.emit('task:result', {
          taskId: task.id,
          success: true,
          data: result
        });
      } else {
        throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      logger.error(`Task failed: ${task.id}`, error);
      socket.emit('task:result', {
        taskId: task.id,
        success: false,
        error: error.message
      });
    }
  });
  
  socket.on('disconnect', (reason) => {
    logger.warn('Disconnected from hub:', reason);
  });
  
  socket.on('connect_error', (error) => {
    logger.error('Connection error:', error.message);
  });
  
  // Send heartbeat
  setInterval(() => {
    if (socket.connected) {
      socket.emit('heartbeat');
    }
  }, 30000);
}

async function executeCrawlTask(task) {
  const { platform, params } = task;
  
  logger.info(`Executing crawl task for ${platform}`, params);
  
  // Get existing page or create new one with retry logic
  let page;
  try {
    // Check if browser and context are still valid
    if (!browser || !context) {
      logger.warn('Browser or context is not initialized, reinitializing...');
      await initBrowser();
    }
    
    // Check if context is still connected
    try {
      const pages = context.pages();
      page = pages[0];
      
      // Check if the page is still valid
      if (page && !page.isClosed()) {
        // Test if page is responsive
        await page.evaluate(() => true);
      } else {
        page = null;
      }
    } catch (contextError) {
      logger.warn('Context or page is invalid, creating new page:', contextError.message);
      page = null;
    }
    
    // Create new page if needed
    if (!page) {
      try {
        page = await context.newPage();
        logger.info('Created new browser page');
      } catch (newPageError) {
        logger.error('Failed to create new page, reinitializing browser:', newPageError.message);
        await closeBrowser();
        await initBrowser();
        page = await context.newPage();
        logger.info('Created new browser page after reinitialization');
      }
    }
  } catch (error) {
    logger.error('Failed to create page:', error.message || error);
    logger.error('Error stack:', error.stack);
    throw new Error(`Failed to create browser page: ${error.message || 'Unknown error'}`);
  }
  
  try {
    // 워크플로우 매핑
    const workflowMap = {
      'coupang': 'coupang-search',
      'naver_store': 'naver-shopping-store',
      'naver_compare': 'naver-shopping-compare',
      'test': 'test/test-webdriver',
      'simple': 'test/simple-test',
      'mock': 'test/mock-test'
    };
    
    const workflowName = workflowMap[platform];
    if (!workflowName) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    // 워크플로우 로드 및 실행
    try {
      const workflowPath = path.join(__dirname, 'workflows', `${workflowName}.js`);
      const workflowModule = require(workflowPath);
      
      logger.info(`Loading workflow: ${workflowName}`);
      
      // 워크플로우 실행
      const result = await workflowModule.execute(page, params);
      logger.info(`Workflow returned result:`, { 
        hasResult: !!result, 
        productCount: result?.products?.length || 0,
        blocked: result?.blocked || false
      });
      return result;
      
    } catch (error) {
      logger.error(`Workflow execution error: ${error.message}`);
      
      // 워크플로우 실패 시 기존 함수 사용 (fallback)
      switch (platform) {
        case 'coupang':
          return await crawlCoupang(page, params);
        case 'naver_store':
          return await crawlNaverStore(page, params);
        case 'naver_compare':
          return await crawlNaverCompare(page, params);
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    }
  } finally {
    // Close extra pages but keep at least one
    const allPages = context.pages();
    if (allPages.length > 1) {
      try {
        // Close all pages except the first one
        for (let i = 1; i < allPages.length; i++) {
          await allPages[i].close();
        }
      } catch (closeError) {
        logger.error('Failed to close extra pages:', closeError.message);
      }
    }
  }
}

async function crawlCoupang(page, params) {
  const { keyword, limit = 10 } = params;
  
  logger.info(`Crawling Coupang for keyword: ${keyword}, limit: ${limit}`);
  
  try {
    // Navigate to Coupang search with proper parameters
    const currentPage = 1;
    const pageSize = 72;
    const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}&channel=user&failRedirectApp=true&page=${currentPage}&listSize=${pageSize}`;
    logger.info(`Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for product list
    try {
      await page.waitForSelector('#product-list', { timeout: 10000 });
    } catch (e) {
      logger.warn('Product list not found, checking for no results');
      const noResults = await page.evaluate(() => {
        const noResultElement = document.querySelector('[class^=no-result_magnifier]');
        const noResultText = document.body?.innerText?.includes('에 대한 검색결과가 없습니다');
        return !!noResultElement || !!noResultText;
      });
      
      if (noResults) {
        return {
          keyword,
          count: 0,
          products: [],
          message: `"${keyword}"에 대한 검색결과가 없습니다`,
          timestamp: new Date().toISOString()
        };
      }
      throw e;
    }
    
    // Extract product data
    const products = await page.evaluate((limitCount) => {
      const items = document.querySelectorAll('#product-list > li[data-id]');
      
      // Filter out ads
      const filteredItems = Array.from(items)
        .filter(i => {
          const linkElement = i.querySelector('a');
          const adMarkElement = i.querySelector('[class*=AdMark]');
          const href = linkElement ? linkElement.getAttribute('href') : '';
          return !adMarkElement && !href.includes('sourceType=srp_product_ads');
        })
        .slice(0, limitCount);
      
      return filteredItems.map((item, index) => {
        const linkElement = item.querySelector('a');
        const imgElement = item.querySelector('img');
        const href = linkElement ? linkElement.getAttribute('href') : '';
        
        // Extract IDs from URL
        let rank = null;
        let productId = null;
        let itemId = null;
        let vendorItemId = null;
        
        if (href) {
          const rankMatch = href.match(/rank=(\d+)/);
          rank = rankMatch ? rankMatch[1] : null;
          
          const productIdMatch = href.match(/\/vp\/products\/(\d+)/);
          productId = productIdMatch ? productIdMatch[1] : null;
          
          const itemIdMatch = href.match(/itemId=(\d+)/);
          itemId = itemIdMatch ? itemIdMatch[1] : null;
          
          const vendorItemIdMatch = href.match(/vendorItemId=(\d+)/);
          vendorItemId = vendorItemIdMatch ? vendorItemIdMatch[1] : null;
        }
        
        return {
          id: item.dataset.id,
          name: item.querySelector('[class*=productName]')?.innerText || 'Unknown Product',
          href: linkElement ? 'https://www.coupang.com' + href : null,
          thumbnail: imgElement ? imgElement.getAttribute('src') : null,
          rank: rank || (index + 1).toString(),
          productId: productId,
          itemId: itemId,
          vendorItemId: vendorItemId,
          realRank: index + 1,
          page: 1
        };
      });
    }, limit);
    
    logger.info(`Found ${products.length} products on Coupang`);
    
    return {
      keyword,
      count: products.length,
      products,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Error crawling Coupang: ${error.message}`);
    logger.info('Returning mock data for testing');
    
    // Return mock data for testing
    const mockProducts = [];
    const brands = ['삼성', 'LG', '애플', 'ASUS', 'HP', 'Dell', 'Lenovo', 'MSI'];
    const models = ['갤럭시북', '그램', '맥북', '비보북', '파빌리온', '인스피론', '씽크패드', '게이밍'];
    
    for (let i = 1; i <= limit; i++) {
      const brand = brands[Math.floor(Math.random() * brands.length)];
      const model = models[Math.floor(Math.random() * models.length)];
      const price = Math.floor(Math.random() * 2000000) + 500000;
      
      mockProducts.push({
        rank: i.toString(),
        name: `${brand} ${model} ${keyword} ${2024 - Math.floor(Math.random() * 3)}년형`,
        href: `https://www.coupang.com/vp/products/${Math.floor(Math.random() * 9000000) + 1000000}`,
        thumbnail: `https://via.placeholder.com/194x194?text=${encodeURIComponent(brand)}`,
        price: price,
        productId: `${Math.floor(Math.random() * 9000000) + 1000000}`,
        itemId: `${Math.floor(Math.random() * 90000000) + 10000000}`,
        vendorItemId: `${Math.floor(Math.random() * 90000000) + 10000000}`,
        realRank: i,
        page: 1
      });
    }
    
    return {
      keyword,
      count: mockProducts.length,
      products: mockProducts,
      isMockData: true,
      timestamp: new Date().toISOString()
    };
  }
}

async function crawlNaverStore(page, params) {
  const { keyword, limit = 10 } = params;
  
  logger.info(`Crawling Naver Store for keyword: ${keyword}, limit: ${limit}`);
  
  // Simple mock data for now
  const products = [];
  for (let i = 1; i <= limit; i++) {
    products.push({
      rank: i.toString(),
      name: `${keyword} - 네이버스토어 상품 ${i}`,
      productId: Math.random().toString(36).substr(2, 9),
      price: Math.floor(Math.random() * 100000) + 10000,
      storeName: `스토어${Math.floor(Math.random() * 100)}`,
      storeGrade: ['POWER', 'PREMIUM', 'BASIC'][Math.floor(Math.random() * 3)]
    });
  }
  
  return {
    keyword,
    count: products.length,
    products,
    timestamp: new Date().toISOString()
  };
}

async function crawlNaverCompare(page, params) {
  const { keyword, limit = 10 } = params;
  
  logger.info(`Crawling Naver Compare for keyword: ${keyword}, limit: ${limit}`);
  
  // Simple mock data for now
  const products = [];
  for (let i = 1; i <= limit; i++) {
    products.push({
      rank: i.toString(),
      name: `${keyword} - 가격비교 상품 ${i}`,
      productId: Math.random().toString(36).substr(2, 9),
      lowestPrice: Math.floor(Math.random() * 100000) + 10000,
      mallCount: Math.floor(Math.random() * 50) + 1
    });
  }
  
  return {
    keyword,
    count: products.length,
    products,
    timestamp: new Date().toISOString()
  };
}

async function start() {
  logger.info(`Starting crawler agent v2 on port ${AGENT_PORT}, instance ${INSTANCE_ID}`);
  
  // Initialize browser
  const browserReady = await initBrowser();
  if (!browserReady) {
    logger.error('Failed to initialize browser, exiting...');
    process.exit(1);
  }
  
  // Connect to hub
  await connectToHub();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down agent...');
  
  // if (healthMonitor) {
  //   healthMonitor.stop();
  // }
  
  if (socket) {
    socket.disconnect();
  }
  
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      logger.error('Error closing browser:', error);
    }
  }
  
  process.exit(0);
});

// Start the agent
start().catch(error => {
  logger.error('Failed to start agent:', error);
  process.exit(1);
});