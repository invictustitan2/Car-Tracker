/**
 * Unload Module API Client
 * 
 * Isolated API client for unload endpoints.
 * See docs/unload/UNLOAD_API_CONTRACT.md
 */

const getEnv = (key) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch { /* ignore */ }
  try {
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // eslint-disable-next-line no-undef
      return process.env[key];
    }
  } catch { /* ignore */ }
  return '';
};

const API_BASE_URL = getEnv('VITE_API_URL') || 'http://localhost:8787';
const API_KEY = getEnv('VITE_API_KEY') || '';

async function unloadRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY && { 'X-API-Key': API_KEY }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.details || `HTTP ${response.status}`);
  }

  return await response.json();
}

export const unloadApi = {
  /**
   * Get door board state
   */
  async getDoors(shiftId = null) {
    const params = shiftId ? `?shift_id=${shiftId}` : '';
    return unloadRequest(`/api/unload/doors${params}`);
  },

  /**
   * Verify doors (bulk update at shift start)
   */
  async verifyDoors(userId, doors) {
    return unloadRequest('/api/unload/verify', {
      method: 'POST',
      body: JSON.stringify({ userId, doors }),
    });
  },

  /**
   * Get visit details
   */
  async getVisit(visitId) {
    return unloadRequest(`/api/unload/visits/${visitId}`);
  },

  /**
   * Get visit events
   */
  async getVisitEvents(visitId) {
    return unloadRequest(`/api/unload/visits/${visitId}/events`);
  },

  /**
   * Perform action on visit
   */
  async visitAction(visitId, action, userId, extraData = {}) {
    return unloadRequest(`/api/unload/visits/${visitId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, userId, ...extraData }),
    });
  },

  /**
   * Start unloading
   */
  async start(visitId, userId) {
    return this.visitAction(visitId, 'START', userId);
  },

  /**
   * Update progress with delta
   */
  async progressDelta(visitId, userId, delta) {
    return this.visitAction(visitId, 'PROGRESS_DELTA', userId, { delta });
  },

  /**
   * Finish unloading
   */
  async finish(visitId, userId) {
    return this.visitAction(visitId, 'FINISH', userId);
  },

  /**
   * Depart trailer
   */
  async depart(visitId, userId, nextDoorState = 'EMPTY') {
    return this.visitAction(visitId, 'DEPART', userId, { nextDoorState });
  },

  /**
   * Fix initial percent
   */
  async fixInitialPercent(visitId, userId, newInitialPercent, reason) {
    return this.visitAction(visitId, 'FIX_INITIAL_PERCENT', userId, {
      newInitialPercent,
      reason,
    });
  },
};
