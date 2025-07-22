import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Agent, AgentTask } from '../types';
import { agentManager } from './agentManager';

export const setupSocketServer = (httpServer: HttpServer): SocketServer => {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    pingTimeout: config.agent.timeout,
    pingInterval: config.agent.heartbeatInterval,
  });

  // Middleware for authentication
  io.use((socket, next) => {
    const apiKey = socket.handshake.auth.apiKey || socket.handshake.headers['x-api-key'];
    
    if (!apiKey || apiKey !== config.api.key) {
      return next(new Error('Authentication failed'));
    }
    
    next();
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`Agent connected: ${socket.id}`);

    // Agent registration
    socket.on('register', (data: Partial<Agent> & { hostIp?: string; instanceId?: number }) => {
      const agent: Agent = {
        id: data.id || socket.id,
        name: data.name || 'Unknown Agent',
        status: 'online',
        lastSeen: new Date(),
        platform: data.platform,
        capabilities: data.capabilities || [],
        socketId: socket.id,
        hostIp: data.hostIp,
        instanceId: data.instanceId,
      };

      agentManager.registerAgent(agent);
      socket.emit('registered', { success: true, agent });
      
      const hostInfo = agent.hostIp && agent.instanceId ? ` at ${agent.hostIp}:${agent.instanceId}` : '';
      logger.info(`Agent registered: ${agent.id} (${agent.name})${hostInfo}`);
    });

    // Agent status update
    socket.on('status', (status: Agent['status']) => {
      agentManager.updateAgentStatus(socket.id, status);
    });

    // Task result
    socket.on('task:result', (result: { taskId: string; success: boolean; data?: any; error?: string }) => {
      logger.info(`Task result received: ${result.taskId}`);
      agentManager.handleTaskResult(result);
    });

    // Heartbeat (Socket.io handles this automatically, but agents can send custom heartbeats)
    socket.on('heartbeat', () => {
      agentManager.updateAgentHeartbeat(socket.id);
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      logger.info(`Agent disconnected: ${socket.id} (${reason})`);
      agentManager.unregisterAgent(socket.id);
    });

    // Error handler
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Attach io instance to agentManager for sending tasks
  agentManager.setSocketServer(io);

  return io;
};