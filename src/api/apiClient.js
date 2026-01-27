/**
 * API Client for UPS Package Car Tracker
 * * Communicates with Cloudflare Worker API for real-time data sync
 */

// Helper to resolve environment variables in both Browser (Vite) and Node (Playwright) environments
const getEnv = (key) => {
  // Try Vite/Browser first
  try {
    // Explicitly check for VITE_API_KEY to allow static replacement by Vite
    if (key === 'VITE_API_KEY' && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      return import.meta.env.VITE_API_KEY;
    }
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
    // eslint-disable-next-line no-unused-vars
  } catch (e) { /* ignore */ }

  // Try Node.js/Process next
  try {
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // eslint-disable-next-line no-undef
      return process.env[key];
    }
    // eslint-disable-next-line no-unused-vars
  } catch (e) { /* ignore */ }

  return '';
};

const API_BASE_URL = getEnv('VITE_API_URL') || 'http://localhost:8787';
const API_KEY = getEnv('VITE_API_KEY') || '';

console.log('[ApiClient] Initialized. BaseURL:', API_BASE_URL, 'API_KEY present:', !!API_KEY);


/**
 * Generic API request helper
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY && { 'X-API-Key': API_KEY }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Car API methods
 */
export const carsApi = {
  async getAll() { return apiRequest('/api/cars'); },
  async get(carId) { return apiRequest(`/api/cars/${carId}`); },
  async create(carData) {
    return apiRequest('/api/cars', {
      method: 'POST',
      body: JSON.stringify(carData),
    });
  },
  async update(carId, updates, expectedVersion) {
    return apiRequest(`/api/cars/${carId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, expectedVersion }),
    });
  },
  async delete(carId, userId) {
    return apiRequest(`/api/cars/${carId}?userId=${userId}`, { method: 'DELETE' });
  },
  async reset() { return apiRequest('/api/cars/reset', { method: 'POST' }); },
};

/**
 * Sync API methods
 */
export const syncApi = {
  async getChanges(since = null) {
    const params = since ? `?since=${encodeURIComponent(since)}` : '';
    return apiRequest(`/api/sync/changes${params}`);
  },
};

/**
 * Shifts API methods
 */
export const shiftsApi = {
  async getRecent(limit = 10) { return apiRequest(`/api/shifts?limit=${limit}`); },
  async start(userId, notes = '') {
    return apiRequest('/api/shifts', {
      method: 'POST',
      body: JSON.stringify({ action: 'start', userId, notes }),
    });
  },
  async end(userId, notes = '') {
    return apiRequest('/api/shifts', {
      method: 'POST',
      body: JSON.stringify({ action: 'end', userId, notes }),
    });
  },
};

/**
 * Audit API methods
 */
export const auditApi = {
  async getLogs(carId = null, limit = 50) {
    const params = new URLSearchParams();
    if (carId) params.append('carId', carId);
    params.append('limit', limit.toString());
    return apiRequest(`/api/audit?${params}`);
  },
};

/**
 * Sessions API methods
 */
export const sessionsApi = {
  async start(userId, deviceInfo = '') {
    return apiRequest('/api/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ userId, deviceInfo }),
    });
  },
  async heartbeat(sessionId) {
    return apiRequest(`/api/sessions/${sessionId}/heartbeat`, { method: 'PUT' });
  },
  async end(sessionId) {
    return apiRequest(`/api/sessions/${sessionId}/end`, { method: 'POST' });
  },
  async getActiveCount() { return apiRequest('/api/sessions/active'); },
};

/**
 * Usage API methods
 */
export const usageApi = {
  async submit(userId, events) {
    return apiRequest('/api/usage', {
      method: 'POST',
      body: JSON.stringify({ userId, events }),
    });
  },
  async getStats(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/api/usage/stats?${query}`);
  },
};

/**
 * Health check
 */
export async function healthCheck() {
  return apiRequest('/api/health');
}

export class SyncManager {
  constructor(onUpdate, pollingInterval = 5000) {
    this.onUpdate = onUpdate;
    this.pollingInterval = pollingInterval;
    this.lastSync = null;
    this.isPolling = false;
    this.pollTimeout = null;
  }
  start() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.poll();
  }
  stop() {
    this.isPolling = false;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
  }
  async poll() {
    if (!this.isPolling) return;
    try {
      const { cars, timestamp } = await syncApi.getChanges(this.lastSync);
      if (cars.length > 0) {
        this.onUpdate(cars);
      }
      this.lastSync = timestamp;
    } catch (error) {
      console.error('Sync poll failed:', error);
    }
    this.pollTimeout = setTimeout(() => this.poll(), this.pollingInterval);
  }
  async sync() {
    try {
      const { cars, timestamp } = await syncApi.getChanges(this.lastSync);
      if (cars.length > 0) {
        this.onUpdate(cars);
      }
      this.lastSync = timestamp;
      return cars;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }
}

export class OptimisticUpdateManager {
  constructor() { this.pendingUpdates = new Map(); }
  add(carId, update) {
    this.pendingUpdates.set(carId, { ...update, timestamp: Date.now() });
  }
  confirm(carId) { this.pendingUpdates.delete(carId); }
  reject(carId) {
    const update = this.pendingUpdates.get(carId);
    this.pendingUpdates.delete(carId);
    return update;
  }
  get(carId) { return this.pendingUpdates.get(carId); }
  has(carId) { return this.pendingUpdates.has(carId); }
  clear() { this.pendingUpdates.clear(); }
  getAll() {
    return Array.from(this.pendingUpdates.entries()).map(([carId, update]) => ({
      carId, ...update,
    }));
  }
}
