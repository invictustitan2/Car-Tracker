import { Server as MockWebSocketServer } from 'mock-socket';

/**
 * Mock WebSocket Server for Testing
 * Provides a realistic WebSocket server that tests can connect to
 */

const WS_URL = 'ws://localhost:8787/api/ws';

let mockServer = null;

/**
 * Start a mock WebSocket server for testing
 */
export function startMockWebSocketServer() {
  if (mockServer) {
    return mockServer;
  }

  mockServer = new MockWebSocketServer(WS_URL);

  // Handle connections
  mockServer.on('connection', (socket) => {
    console.log('[Mock WS] Client connected');

    // Send welcome message
    socket.send(JSON.stringify({
      type: 'connected',
      userId: 'test-user',
      activeUsers: 1,
    }));

    // Handle incoming messages
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('[Mock WS] Received:', message);

        // Echo back for testing
        if (message.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error) {
        console.error('[Mock WS] Error parsing message:', error);
      }
    });

    socket.on('close', () => {
      console.log('[Mock WS] Client disconnected');
    });
  });

  return mockServer;
}

/**
 * Stop the mock WebSocket server
 */
export function stopMockWebSocketServer() {
  if (mockServer) {
    mockServer.close();
    mockServer = null;
  }
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcastMessage(message) {
  if (!mockServer) {
    throw new Error('Mock WebSocket server is not running');
  }

  mockServer.clients().forEach((client) => {
    client.send(JSON.stringify(message));
  });
}

/**
 * Simulate a car update broadcast
 */
export function broadcastCarUpdate(car) {
  broadcastMessage({
    type: 'car_updated',
    car,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Simulate a shift started broadcast
 */
export function broadcastShiftStarted(shift) {
  broadcastMessage({
    type: 'shift_started',
    shift,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Simulate active users update
 */
export function broadcastActiveUsers(count) {
  broadcastMessage({
    type: 'active_users_updated',
    activeUsers: count,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get the number of connected clients
 */
export function getConnectedClients() {
  if (!mockServer) {
    return 0;
  }
  return mockServer.clients().length;
}
