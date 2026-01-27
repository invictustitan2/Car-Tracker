import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Unmock WebSocketService for this test file
vi.unmock('./services/WebSocketService.js');

describe('WebSocketService', () => {
  let MockWebSocket;

  beforeEach(() => {
    // Create a proper WebSocket mock
    MockWebSocket = vi.fn(function (url) {
      this.url = url;
      this.readyState = 1; // OPEN
      this.send = vi.fn();
      this.close = vi.fn();

      // Simulate async connection
      queueMicrotask(() => {
        if (this.onopen) {
          this.onopen({ target: this });
        }
      });
    });

    // Replace global WebSocket
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects and emits connected event', async () => {
    const { wsService } = await import('./services/WebSocketService.js');

    const onConnected = vi.fn();
    wsService.on('connected', onConnected);

    wsService.connect('wss://test.example/ws', 'user-123');

    // Wait for microtask queue (using setTimeout as setImmediate is Node-only)
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(MockWebSocket).toHaveBeenCalledWith(expect.stringContaining('wss://test.example/ws'));
    expect(onConnected).toHaveBeenCalledWith(expect.objectContaining({
      timestamp: expect.any(String)
    }));
  });
});


