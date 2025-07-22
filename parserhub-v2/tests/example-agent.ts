import { io, Socket } from 'socket.io-client';

// Example agent implementation
class ExampleAgent {
  private socket: Socket;
  private agentId: string;
  private platform: string;

  constructor(platform: string = 'coupang') {
    this.agentId = `agent-${Date.now()}`;
    this.platform = platform;
    
    // Connect to ParserHub v2 Socket.io server
    this.socket = io('http://mkt.techb.kr:8445', {
      auth: {
        apiKey: 'YOUR_API_KEY'
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to ParserHub v2');
      this.register();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Registration confirmation
    this.socket.on('registered', (data) => {
      console.log('Agent registered:', data);
    });

    // Task assignment
    this.socket.on('task:assign', async (task) => {
      console.log('Task received:', task);
      await this.processTask(task);
    });
  }

  private register() {
    this.socket.emit('register', {
      id: this.agentId,
      name: `Example ${this.platform} Agent`,
      platform: this.platform,
      capabilities: ['search', 'crawl', 'ranking'],
    });
  }

  private async processTask(task: any) {
    console.log(`Processing task ${task.id} of type ${task.type}`);
    
    try {
      // Update status to processing
      this.socket.emit('status', 'busy');

      // Simulate task processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Example result based on task type
      let result;
      if (task.type === 'crawl' && task.params.workflow === 'search') {
        result = {
          products: [
            {
              id: '123456',
              productId: '123456',
              vendorItemId: '98765432',
              name: `${task.params.keyword} Sample Product`,
              href: 'https://example.com/product/123456',
              price: 29900,
              rank: 1,
              page: 1,
            }
          ]
        };
      } else {
        result = { message: 'Task completed successfully' };
      }

      // Send result
      this.socket.emit('task:result', {
        taskId: task.id,
        success: true,
        data: result,
      });

      // Update status back to online
      this.socket.emit('status', 'online');
      
    } catch (error) {
      console.error('Task processing error:', error);
      
      this.socket.emit('task:result', {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.socket.emit('status', 'online');
    }
  }

  // Send periodic heartbeat (optional, Socket.io handles this automatically)
  startHeartbeat() {
    setInterval(() => {
      this.socket.emit('heartbeat');
    }, 30000);
  }
}

// Start example agent
const agent = new ExampleAgent('coupang');
agent.startHeartbeat();

console.log('Example agent started. Press Ctrl+C to stop.');