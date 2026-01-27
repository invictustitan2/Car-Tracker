import { Bell, BellOff, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import notificationService from '../services/NotificationService';

export default function NotificationSettings({ apiUrl, userId }) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // VAPID public key - should be generated and stored securely
  // For production, fetch this from the server
  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

  useEffect(() => {
    const checkSupport = async () => {
      const supported = notificationService.isSupported();
      setIsSupported(supported);

      if (supported) {
        const perm = notificationService.getPermission();
        setPermission(perm);

        // Check if already subscribed
        await notificationService.initialize();
        const subscription = await notificationService.getSubscription();
        setIsSubscribed(!!subscription);
      }
    };

    checkSupport();
  }, []);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Request permission
      const perm = await notificationService.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setError('Notification permission denied. Please enable in browser settings.');
        setIsLoading(false);
        return;
      }

      // Subscribe to push notifications
      if (!VAPID_PUBLIC_KEY) {
        setError('VAPID public key not configured. Contact administrator.');
        setIsLoading(false);
        return;
      }

      const subscription = await notificationService.subscribe(VAPID_PUBLIC_KEY);

      // Save subscription to server
      await notificationService.saveSubscription(apiUrl, userId, subscription);

      setIsSubscribed(true);
      setSuccess('Push notifications enabled! You\'ll receive updates in real-time.');

      // Show test notification
      await notificationService.showNotification('Notifications Enabled', {
        body: 'You will now receive real-time updates for package car changes.',
        icon: '/icon-192.png',
        tag: 'notification-enabled',
      });
    } catch (err) {
      console.error('Failed to enable notifications:', err);
      setError(err.message || 'Failed to enable notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Unsubscribe from push notifications
      await notificationService.unsubscribe();

      // Remove subscription from server
      await notificationService.deleteSubscription(apiUrl, userId);

      setIsSubscribed(false);
      setSuccess('Push notifications disabled.');
    } catch (err) {
      console.error('Failed to disable notifications:', err);
      setError(err.message || 'Failed to disable notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await notificationService.showNotification('Test Notification', {
        body: 'This is a test notification from UPS Package Car Tracker.',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'test-notification',
        actions: [
          { action: 'view', title: 'View Tracker' },
        ],
      });
      setSuccess('Test notification sent!');
    } catch (err) {
      setError('Failed to send test notification: ' + err.message);
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <BellOff className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-1">
              Push Notifications Not Supported
            </h3>
            <p className="text-sm text-yellow-700">
              Your browser doesn't support push notifications.
              Try using Chrome, Firefox, or Edge for the best experience.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className={`border rounded-lg p-4 ${isSubscribed
          ? 'bg-green-50 border-green-200'
          : 'bg-gray-50 border-gray-200'
        }`}>
        <div className="flex items-start gap-3">
          {isSubscribed ? (
            <Bell className="w-5 h-5 text-green-600 mt-0.5" />
          ) : (
            <BellOff className="w-5 h-5 text-gray-600 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className={`font-semibold mb-1 ${isSubscribed ? 'text-green-900' : 'text-gray-900'
              }`}>
              Push Notifications {isSubscribed ? 'Enabled' : 'Disabled'}
            </h3>
            <p className={`text-sm ${isSubscribed ? 'text-green-700' : 'text-gray-600'
              }`}>
              {isSubscribed
                ? 'You\'re receiving real-time updates for car changes, shift updates, and important events.'
                : 'Enable push notifications to receive real-time updates even when the app is closed.'}
            </p>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!isSubscribed ? (
          <button
            onClick={handleEnableNotifications}
            disabled={isLoading || permission === 'denied'}
            className="flex-1 bg-brown-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brown-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Enabling...' : 'Enable Notifications'}
          </button>
        ) : (
          <>
            <button
              onClick={handleTestNotification}
              className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Send Test
            </button>
            <button
              onClick={handleDisableNotifications}
              disabled={isLoading}
              className="flex-1 bg-gray-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Disabling...' : 'Disable'}
            </button>
          </>
        )}
      </div>

      {/* Permission Info */}
      {permission === 'denied' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <BellOff className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-orange-900 mb-1">
                Notifications Blocked
              </h4>
              <p className="text-sm text-orange-700">
                You've previously blocked notifications for this site.
                To enable them, click the lock icon in your browser's address bar
                and allow notifications.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notification Types Info */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">
          What you'll receive:
        </h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-brown-600 mt-1">•</span>
            <span>Car status changes (arrived, late, empty)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brown-600 mt-1">•</span>
            <span>New shift started by team members</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brown-600 mt-1">•</span>
            <span>Important system updates and alerts</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brown-600 mt-1">•</span>
            <span>Critical car tracking updates</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
