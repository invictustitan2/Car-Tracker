/* eslint-env serviceworker */
/**
 * Service Worker for UPS Package Car Tracker
 * Handles push notifications and offline caching
 */

const CACHE_NAME = 'ups-tracker-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching assets');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((response) => {
          return response || caches.match(OFFLINE_URL);
        });
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  let data = {
    title: 'UPS Package Car Tracker',
    body: 'New update available',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'tracker-update',
    requireInteraction: false,
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = { ...data, ...pushData };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    requireInteraction: data.requireInteraction,
    data: data.data || {},
    vibrate: [200, 100, 200],
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);

  event.notification.close();

  // Handle action buttons
  if (event.action) {
    console.log('[Service Worker] Action clicked:', event.action);
    // Handle different actions
    switch (event.action) {
      case 'view':
        event.waitUntil(
          clients.openWindow('/')
        );
        break;
      default:
        break;
    }
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Background sync event - process offline mutation queue
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'offline-sync') {
    event.waitUntil(processOfflineQueue());
  } else if (event.tag === 'sync-usage-stats') {
    event.waitUntil(syncUsageStats());
  }
});

// Process offline mutation queue
async function processOfflineQueue() {
  console.log('[Service Worker] Processing offline mutation queue...');
  
  try {
    // Open IndexedDB
    const db = await openOfflineDB();
    const mutations = await getPendingMutations(db);

    if (mutations.length === 0) {
      console.log('[Service Worker] No pending mutations');
      return;
    }

    console.log(`[Service Worker] Processing ${mutations.length} mutations`);

    // Get API base URL from environment or default
    const apiBase = 'https://ups-tracker-api.invictustitan2.workers.dev/api';

    for (const mutation of mutations) {
      try {
        await executeMutation(mutation, apiBase);
        await deleteMutation(db, mutation.id);
        console.log(`[Service Worker] Processed mutation ${mutation.id}`);
      } catch (error) {
        console.error(`[Service Worker] Failed to process mutation ${mutation.id}:`, error);
        await incrementRetryCount(db, mutation.id);
      }
    }

    console.log('[Service Worker] Queue processing complete');
  } catch (error) {
    console.error('[Service Worker] Error processing offline queue:', error);
  }
}

// Open offline IndexedDB
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ups-tracker-offline', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get pending mutations from IndexedDB
async function getPendingMutations(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mutation-queue', 'readonly');
    const store = tx.objectStore('mutation-queue');
    const index = store.index('status');
    const request = index.getAll('pending');
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Execute a single mutation
async function executeMutation(mutation, apiBase) {
  const { type, data } = mutation;
  let url, method, body;

  switch (type) {
    case 'add_car':
      url = `${apiBase}/cars`;
      method = 'POST';
      body = JSON.stringify(data);
      break;
    case 'update_car':
      url = `${apiBase}/cars/${data.id}`;
      method = 'PUT';
      body = JSON.stringify(data);
      break;
    case 'delete_car':
      url = `${apiBase}/cars/${data.id}`;
      method = 'DELETE';
      break;
    case 'start_shift':
      url = `${apiBase}/shifts`;
      method = 'POST';
      body = JSON.stringify(data);
      break;
    case 'end_shift':
      url = `${apiBase}/shifts/${data.id}`;
      method = 'PUT';
      body = JSON.stringify(data);
      break;
    default:
      throw new Error(`Unknown mutation type: ${type}`);
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Delete mutation from queue
async function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mutation-queue', 'readwrite');
    const store = tx.objectStore('mutation-queue');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Increment retry count for failed mutation
async function incrementRetryCount(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('mutation-queue', 'readwrite');
    const store = tx.objectStore('mutation-queue');
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const mutation = getRequest.result;
      if (mutation) {
        mutation.retries = (mutation.retries || 0) + 1;
        mutation.lastAttempt = Date.now();
        
        // Mark as failed after 3 retries
        if (mutation.retries >= 3) {
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

// Helper function for syncing usage stats
async function syncUsageStats() {
  console.log('[Service Worker] Syncing usage stats...');
  // Implementation would sync usage stats to backend
}

// Message event - communication with main app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Send response back to client
  event.ports[0].postMessage({ 
    type: 'ACK',
    message: 'Service Worker received message' 
  });
});
