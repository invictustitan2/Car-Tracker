/**
 * WebSocket Service for Real-time Updates
 * Handles connection, reconnection, and message broadcasting
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectInterval = null;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.messageHandlers = new Map();
    this.isConnecting = false;
    this.isManualClose = false;
    this.pingInterval = null;
  }

  /**
   * Connect to WebSocket server
   */
  connect(url, userId, sessionToken) {
    // Force disconnect if connecting or connected with different params (simplified: just force disconnect if called)
    // But we want to avoid reconnecting if already connected to same endpoint
    
    if (this.isConnecting) {
      console.log('WebSocket is connecting, aborting previous connection');
      this.disconnect();
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.isConnecting = true;
    this.isManualClose = false;

    try {
      // Use session token for authentication if provided
      const wsUrl = sessionToken 
        ? `${url}?token=${encodeURIComponent(sessionToken)}`
        : `${url}?userId=${encodeURIComponent(userId)}`;
      console.log('Connecting to WebSocket:', wsUrl.replace(/token=[^&]+/, 'token=***'));
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectDelay = 1000; // Reset reconnect delay
        
        // Start ping interval to keep connection alive
        this.startPingInterval();
        
        // Notify handlers
        this.emit('connected', { timestamp: new Date().toISOString() });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message:', data);
          
          // Emit event to registered handlers
          this.emit(data.type, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', { error });
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnecting = false;
        this.stopPingInterval();
        
        this.emit('disconnected', { 
          code: event.code, 
          reason: event.reason,
          wasClean: event.wasClean 
        });

        // Reconnect if not manually closed
        if (!this.isManualClose) {
          this.scheduleReconnect(url, userId);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect(url, userId);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect(url, userId) {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
    }

    console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
    
    this.reconnectInterval = setTimeout(() => {
      this.connect(url, userId);
      
      // Increase delay for next reconnection (exponential backoff)
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  /**
   * Start ping interval to keep connection alive
   */
  startPingInterval() {
    this.stopPingInterval();
    
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Send message through WebSocket
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    console.warn('WebSocket not connected, cannot send:', data);
    return false;
  }

  /**
   * Subscribe to specific event types
   */
  subscribe(events) {
    this.send({
      type: 'subscribe',
      events,
    });
  }

  /**
   * Register event handler
   */
  on(eventType, handler) {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, []);
    }
    this.messageHandlers.get(eventType).push(handler);
  }

  /**
   * Unregister event handler
   */
  off(eventType, handler) {
    if (!this.messageHandlers.has(eventType)) return;
    
    const handlers = this.messageHandlers.get(eventType);
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Emit event to all registered handlers
   */
  emit(eventType, data) {
    if (!this.messageHandlers.has(eventType)) return;
    
    const handlers = this.messageHandlers.get(eventType);
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${eventType} handler:`, error);
      }
    });
  }

  /**
   * Close WebSocket connection
   */
  disconnect() {
    this.isManualClose = true;
    
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
export default wsService;
