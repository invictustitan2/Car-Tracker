import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server.js';
import { loadState, saveState } from './storage/trackerStorage.js';

// Set test environment variables
import.meta.env.VITE_API_KEY = 'test-api-key';
import.meta.env.VITE_API_URL = 'http://localhost:8787';

// Establish API mocking before all tests using MSW
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => {
  server.resetHandlers();
});

// Clean up after the tests are finished
afterAll(() => {
  server.close();
});

// Mock WebSocket service
vi.mock('./services/WebSocketService.js', () => ({
  default: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    send: vi.fn(),
    isConnected: vi.fn(() => false),
  },
  wsService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    send: vi.fn(),
    isConnected: vi.fn(() => false),
  },
}));

// Mock Notification service
vi.mock('./services/NotificationService.js', () => ({
  default: {
    isSupported: vi.fn(() => false),
    getPermission: vi.fn(() => 'default'),
    requestPermission: vi.fn(),
    registerServiceWorker: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getSubscription: vi.fn(() => null),
    showNotification: vi.fn(),
    initialize: vi.fn(() => Promise.resolve(false)),
  },
  notificationService: {
    isSupported: vi.fn(() => false),
    getPermission: vi.fn(() => 'default'),
    requestPermission: vi.fn(),
    registerServiceWorker: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getSubscription: vi.fn(() => null),
    showNotification: vi.fn(),
    initialize: vi.fn(() => Promise.resolve(false)),
  },
}));

// Provide a basic matchMedia mock for components that use it for theme detection
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => { },
    removeEventListener: () => { },
    addListener: () => { },
    removeListener: () => { },
    dispatchEvent: () => false,
  });
}

// Mock ResizeObserver for Recharts
window.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Recharts module completely
vi.mock('recharts', () => {
  const MockComponent = ({ children }) => <div className="recharts-mock">{children}</div>;
  return {
    ResponsiveContainer: MockComponent,
    BarChart: MockComponent,
    Bar: MockComponent,
    LineChart: MockComponent,
    Line: MockComponent,
    PieChart: MockComponent,
    Pie: MockComponent,
    XAxis: MockComponent,
    YAxis: MockComponent,
    CartesianGrid: MockComponent,
    Tooltip: MockComponent,
    Legend: MockComponent,
    Cell: MockComponent,
  };
});

// Mock API Client with local snapshot behavior so tests can rely on seeded data
vi.mock('./api/apiClient.js', () => {
  const getSnapshot = () => loadState();

  const writeSnapshot = (next) => {
    const current = getSnapshot();
    saveState({
      ...current,
      ...next,
    });
  };

  return {
    carsApi: {
      getAll: vi.fn().mockImplementation(async () => {
        const state = getSnapshot();
        return { cars: state.cars ?? [] };
      }),
      get: vi.fn().mockImplementation(async (id) => {
        const state = getSnapshot();
        const car = (state.cars ?? []).find(c => c.id === id) ?? null;
        return { car };
      }),
      create: vi.fn().mockImplementation(async (newCar) => {
        const state = getSnapshot();
        const car = {
          ...newCar,
          id: newCar.id ?? String(Date.now()),
        };
        const cars = [...(state.cars ?? []), car];
        writeSnapshot({ cars });
        return { car };
      }),
      update: vi.fn().mockImplementation(async (id, updates, version) => {
        const state = getSnapshot();
        const cars = (state.cars ?? []).map(car => car.id === id ? { ...car, ...updates, version } : car);
        const updated = cars.find(car => car.id === id) ?? null;
        writeSnapshot({ cars });
        return { car: updated };
      }),
      delete: vi.fn().mockImplementation(async (id) => {
        const state = getSnapshot();
        const cars = (state.cars ?? []).filter(car => car.id !== id);
        writeSnapshot({ cars });
        return { success: true };
      }),
      reset: vi.fn().mockImplementation(async () => {
        const state = getSnapshot();
        const cars = (state.cars ?? []).map(car => ({
          ...car,
          arrived: false,
          empty: false,
          late: false,
        }));
        writeSnapshot({ cars });
        return { success: true, cars };
      }),
    },
    syncApi: {
      getState: vi.fn().mockImplementation(async () => getSnapshot()),
    },
    sessionsApi: {
      start: vi.fn().mockResolvedValue({ sessionId: 'test-session' }),
      heartbeat: vi.fn().mockResolvedValue({ ok: true }),
      end: vi.fn().mockResolvedValue({ ok: true }),
    },
    usageApi: {
      submit: vi.fn().mockResolvedValue({ success: true }),
    },
    shiftsApi: {
      start: vi.fn().mockResolvedValue({ success: true }),
      end: vi.fn().mockResolvedValue({ success: true }),
    },
    auditApi: {
      getLogs: vi.fn().mockResolvedValue({ logs: [] }),
    },
  };
});

// Mock OfflineQueueService
vi.mock('./services/OfflineQueueService.js', () => {
  return {
    default: class MockOfflineQueueManager {
      constructor() {
        this.subscribe = vi.fn(() => () => { });
        this.getPendingCount = vi.fn().mockResolvedValue(0);
        this.queue = vi.fn().mockResolvedValue(1);
        this.sync = vi.fn().mockResolvedValue({ processed: 0, failed: 0 });
      }
    },
  };
});
