/**
 * Offline Mutation Queue Service
 * Handles queueing of mutations when offline and syncing when back online
 * Uses IndexedDB for persistent storage and Background Sync API
 */

const DB_NAME = 'ups-tracker-offline';
const DB_VERSION = 2; // Bumped for config store
const QUEUE_STORE = 'mutation-queue';
const CONFIG_STORE = 'config';

/**
 * Initialize IndexedDB for offline queue
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create mutation queue store
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
      
      // Create config store for API key etc.
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Store API key for service worker access
 */
async function storeApiKey(apiKey) {
  const db = await initDB();
  const tx = db.transaction(CONFIG_STORE, 'readwrite');
  const store = tx.objectStore(CONFIG_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.put({ key: 'apiKey', value: apiKey });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add mutation to offline queue
 */
async function queueMutation(mutation) {
  const db = await initDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);

  const item = {
    ...mutation,
    timestamp: Date.now(),
    status: 'pending',
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const request = store.add(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending mutations from queue
 */
async function getPendingMutations() {
  const db = await initDB();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const store = tx.objectStore(QUEUE_STORE);
  const index = store.index('status');

  return new Promise((resolve, reject) => {
    const request = index.getAll('pending');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark mutation as completed
 */
async function completeMutation(id) {
  const db = await initDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark mutation as failed and increment retry count
 */
async function failMutation(id, error, status = null) {
  const db = await initDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const mutation = getRequest.result;
      if (mutation) {
        mutation.retries = (mutation.retries || 0) + 1;
        mutation.lastError = error;
        mutation.lastAttempt = Date.now();

        if (status) {
          mutation.status = status;
        } else if (mutation.retries >= 3) {
          // Mark as failed after 3 retries if no specific status provided
          mutation.status = 'failed';
        }

        const putRequest = store.put(mutation);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Get count of pending mutations
 */
async function getPendingCount() {
  const db = await initDB();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const store = tx.objectStore(QUEUE_STORE);
  const index = store.index('status');

  return new Promise((resolve, reject) => {
    const request = index.count('pending');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all failed mutations
 */
async function clearFailedMutations() {
  const db = await initDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);
  const index = store.index('status');

  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.only('failed'));
    const toDelete = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        toDelete.push(cursor.primaryKey);
        cursor.continue();
      } else {
        // Delete all failed mutations
        Promise.all(toDelete.map((key) => {
          return new Promise((res, rej) => {
            const delRequest = store.delete(key);
            delRequest.onsuccess = () => res();
            delRequest.onerror = () => rej(delRequest.error);
          });
        })).then(resolve).catch(reject);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Process offline queue and sync to server
 */
async function processQueue(apiClient) {
  const mutations = await getPendingMutations();

  if (mutations.length === 0) {
    return { processed: 0, failed: 0 };
  }

  console.log(`Processing ${mutations.length} offline mutations`);

  let processed = 0;
  let failed = 0;

  for (const mutation of mutations) {
    try {
      // Execute the mutation based on type
      switch (mutation.type) {
        case 'add_car':
          await apiClient.cars.create(mutation.data);
          break;
        case 'update_car':
          await apiClient.cars.update(mutation.data.id, mutation.data.updates, mutation.data.version);
          break;
        case 'delete_car':
          await apiClient.cars.delete(mutation.data.id, mutation.data.userId);
          break;
        case 'start_shift':
          await apiClient.shifts.start(mutation.data.userId, mutation.data.notes);
          break;
        case 'end_shift':
          await apiClient.shifts.end(mutation.data.userId, mutation.data.notes);
          break;
        default:
          console.warn('Unknown mutation type:', mutation.type);
      }

      // Mark as completed
      await completeMutation(mutation.id);
      processed++;
    } catch (error) {
      console.error('Failed to process mutation:', mutation, error);
      
      // Check for 409 Conflict or "Version mismatch" error
      const isConflict = error.message?.includes('409') || error.message?.toLowerCase().includes('version mismatch');
      
      if (isConflict) {
        console.error('Sync conflict detected. Marking mutation as conflict.');
        await failMutation(mutation.id, error.message, 'conflict');
      } else {
        await failMutation(mutation.id, error.message);
      }
      failed++;
    }
  }

  console.log(`Queue processing complete: ${processed} processed, ${failed} failed`);
  return { processed, failed };
}

/**
 * Register background sync
 */
async function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('offline-sync');
      console.log('Background sync registered');
      return true;
    } catch (error) {
      console.error('Failed to register background sync:', error);
      return false;
    }
  }
  return false;
}

/**
 * Offline Queue Manager
 */
class OfflineQueueManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.isOnline = navigator.onLine;
    this.listeners = new Set();

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Queue a mutation for later sync
   */
  async queue(type, data) {
    const id = await queueMutation({ type, data });
    this.notifyListeners();
    
    // Try to register background sync
    await registerBackgroundSync();
    
    return id;
  }

  /**
   * Manually trigger sync (when coming back online)
   */
  async sync() {
    if (!this.isOnline) {
      console.log('Cannot sync while offline');
      return { processed: 0, failed: 0 };
    }

    const result = await processQueue(this.apiClient);
    this.notifyListeners();
    return result;
  }

  /**
   * Get pending mutation count
   */
  async getPendingCount() {
    return await getPendingCount();
  }

  /**
   * Clear all failed mutations
   */
  async clearFailed() {
    await clearFailedMutations();
    this.notifyListeners();
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of queue changes
   */
  notifyListeners() {
    this.getPendingCount().then((count) => {
      this.listeners.forEach((callback) => callback(count));
    });
  }

  /**
   * Handle coming back online
   */
  async handleOnline() {
    console.log('Back online - syncing offline mutations');
    this.isOnline = true;
    await this.sync();
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    console.log('Gone offline - mutations will be queued');
    this.isOnline = false;
  }
}

export default OfflineQueueManager;
export { completeMutation, getPendingMutations, processQueue, queueMutation, registerBackgroundSync, storeApiKey };

