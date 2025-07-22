require('dotenv').config();
const io = require('socket.io-client');

const HUB_URL = process.env.HUB_URL || 'http://mkt.techb.kr:8447';
const API_KEY = process.env.API_KEY || 'YOUR_API_KEY';

console.log('Testing connection to hub:', HUB_URL);

const socket = io(HUB_URL, {
  auth: {
    apiKey: API_KEY
  },
  transports: ['websocket'],
  reconnection: false,
  timeout: 5000,
  rejectUnauthorized: false
});

socket.on('connect', () => {
  console.log('✓ Connected to hub successfully');
  console.log('Socket ID:', socket.id);
  
  // Test registration
  console.log('Sending test registration...');
  socket.emit('register', {
    id: 'test-agent',
    name: 'Test Agent',
    hostIp: '127.0.0.1',
    instanceId: 1,
    platform: 'all',
    capabilities: ['search', 'extract']
  });
});

socket.on('registered', (data) => {
  console.log('✓ Registration successful:', data);
  
  // Test heartbeat
  console.log('Sending heartbeat...');
  socket.emit('heartbeat');
  socket.emit('status', 'online');
  
  setTimeout(() => {
    console.log('Test completed successfully');
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

socket.on('connect_error', (error) => {
  console.error('✗ Connection failed:', error.message);
  process.exit(1);
});

socket.on('error', (error) => {
  console.error('✗ Socket error:', error);
  process.exit(1);
});

setTimeout(() => {
  console.error('✗ Connection timeout');
  process.exit(1);
}, 10000);