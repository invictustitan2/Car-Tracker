/**
 * Push Notification Service
 * Handles service worker registration and push notification subscriptions
 */

class NotificationService {
  constructor() {
    this.registration = null;
    this.subscription = null;
  }

  /**
   * Check if push notifications are supported
   */
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Check current notification permission
   */
  getPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  /**
   * Request notification permission from user
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Register service worker
   */
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Workers not supported');
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registered:', this.registration);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      
      return this.registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(vapidPublicKey) {
    if (!this.registration) {
      await this.registerServiceWorker();
    }

    try {
      // Check if already subscribed
      const existingSubscription = await this.registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('Already subscribed to push notifications');
        this.subscription = existingSubscription;
        return existingSubscription;
      }

      // Subscribe to push notifications
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      });

      console.log('Push subscription created:', subscription);
      this.subscription = subscription;

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe() {
    if (!this.subscription) {
      const subscription = await this.registration?.pushManager.getSubscription();
      if (!subscription) {
        console.log('No active subscription found');
        return true;
      }
      this.subscription = subscription;
    }

    try {
      const result = await this.subscription.unsubscribe();
      console.log('Unsubscribed from push notifications:', result);
      this.subscription = null;
      return result;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      throw error;
    }
  }

  /**
   * Get current subscription
   */
  async getSubscription() {
    if (!this.registration) {
      await this.registerServiceWorker();
    }

    const subscription = await this.registration.pushManager.getSubscription();
    this.subscription = subscription;
    return subscription;
  }

  /**
   * Show a local notification (doesn't require push)
   */
  async showNotification(title, options = {}) {
    if (!this.registration) {
      await this.registerServiceWorker();
    }

    const defaultOptions = {
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      vibrate: [200, 100, 200],
      tag: 'local-notification',
    };

    return this.registration.showNotification(title, {
      ...defaultOptions,
      ...options,
    });
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Send subscription to server
   */
  async saveSubscription(apiUrl, userId, subscription) {
    try {
      const response = await fetch(`${apiUrl}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          subscription,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save subscription: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to save subscription to server:', error);
      throw error;
    }
  }

  /**
   * Delete subscription from server
   */
  async deleteSubscription(apiUrl, userId) {
    try {
      const response = await fetch(`${apiUrl}/api/notifications/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete subscription: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to delete subscription from server:', error);
      throw error;
    }
  }

  /**
   * Initialize and setup service worker with message handling
   */
  async initialize() {
    if (!this.isSupported()) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      await this.registerServiceWorker();

      // Handle service worker updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration.installing;
        console.log('Service Worker update found');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New Service Worker available');
            // Could show update notification here
          }
        });
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from Service Worker:', event.data);
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
