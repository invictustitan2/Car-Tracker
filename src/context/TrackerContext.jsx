import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auditApi, carsApi, sessionsApi, shiftsApi, syncApi, usageApi } from '../api/apiClient';
import OfflineQueueManager, { storeApiKey } from '../services/OfflineQueueService';
import { wsService } from '../services/WebSocketService';
import { loadState } from '../storage/trackerStorage';

const TrackerContext = createContext();

// Construct API client object for OfflineQueueManager
const fullApiClient = {
  cars: carsApi,
  shifts: shiftsApi,
  audit: auditApi,
  sessions: sessionsApi,
  usage: usageApi,
  sync: syncApi,
};



export function TrackerProvider({ children }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState(() => localStorage.getItem('ups_tracker_user_id'));
  const [activeUsers, setActiveUsers] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [queueStatus, setQueueStatus] = useState({ pending: 0, failed: 0 });

  // Initialize OfflineQueueManager
  const offlineQueueManager = useMemo(() => new OfflineQueueManager(fullApiClient), []);

  useEffect(() => {
    // Store API key in IndexedDB for service worker access
    const apiKey = import.meta.env.VITE_API_KEY || '';
    if (apiKey) {
      storeApiKey(apiKey).catch(err => console.warn('Failed to store API key for offline sync:', err));
    }
    
    // Subscribe to queue changes
    const unsubscribe = offlineQueueManager.subscribe((count) => {
      setQueueStatus(prev => ({ ...prev, pending: count }));
    });

    // Initial check
    offlineQueueManager.getPendingCount().then(count => {
      setQueueStatus(prev => ({ ...prev, pending: count }));
    });

    return unsubscribe;
  }, [offlineQueueManager]);

  // 1. Robust Data Fetching with React Query
  const { data: cars = [], isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['cars'],
    queryFn: async () => {
      const response = await carsApi.getAll();
      return response.cars || [];
    },
    initialData: () => loadState().cars || [],
    refetchInterval: 5000, // Fallback polling
    staleTime: 1000,
  });

  const addCarMutation = useMutation({
    mutationFn: async (newCar) => {
      try {
        return await carsApi.create(newCar);
      } catch (error) {
        if (!navigator.onLine || error.message === 'Failed to fetch' || error.name === 'TypeError') {
          console.log('Network error, queueing add_car mutation');
          await offlineQueueManager.queue('add_car', newCar);
          return { queued: true };
        }
        throw error;
      }
    },
    onMutate: async (newCar) => {
      await queryClient.cancelQueries(['cars']);
      const previousCars = queryClient.getQueryData(['cars']);
      queryClient.setQueryData(['cars'], (old) => old ? [...old, newCar] : []);
      return { previousCars };
    },
    onError: (err, newCar, context) => {
      if (context?.previousCars && !err.queued) {
        queryClient.setQueryData(['cars'], context.previousCars);
      }
    },
    onSuccess: (data) => {
      if (!data?.queued) queryClient.invalidateQueries(['cars']);
    },
  });

  const updateCarMutation = useMutation({
    mutationFn: async ({ id, updates, version }) => {
      try {
        return await carsApi.update(id, updates, version);
      } catch (error) {
        if (!navigator.onLine || error.message === 'Failed to fetch' || error.name === 'TypeError') {
          console.log('Network error, queueing update_car mutation');
          await offlineQueueManager.queue('update_car', { id, updates, version });
          return { queued: true };
        }
        throw error;
      }
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries(['cars']);
      const previousCars = queryClient.getQueryData(['cars']);
      queryClient.setQueryData(['cars'], (old) =>
        old ? old.map(car => car.id === id ? { ...car, ...updates } : car) : []
      );
      return { previousCars };
    },
    onError: (err, variables, context) => {
      if (context?.previousCars && !err.queued) {
        queryClient.setQueryData(['cars'], context.previousCars);
      }
    },
    onSuccess: (data) => {
      if (!data?.queued) queryClient.invalidateQueries(['cars']);
    },
  });

  const deleteCarMutation = useMutation({
    mutationFn: async ({ id, userId }) => {
      try {
        return await carsApi.delete(id, userId);
      } catch (error) {
        if (!navigator.onLine || error.message === 'Failed to fetch' || error.name === 'TypeError') {
          console.log('Network error, queueing delete_car mutation');
          await offlineQueueManager.queue('delete_car', { id, userId });
          return { queued: true };
        }
        throw error;
      }
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries(['cars']);
      const previousCars = queryClient.getQueryData(['cars']);
      queryClient.setQueryData(['cars'], (old) =>
        old ? old.filter(car => car.id !== id) : []
      );
      return { previousCars };
    },
    onError: (err, variables, context) => {
      if (context?.previousCars && !err.queued) {
        queryClient.setQueryData(['cars'], context.previousCars);
      }
    },
    onSuccess: (data) => {
      if (!data?.queued) queryClient.invalidateQueries(['cars']);
    },
  });

  // Reset is special, might need custom handling but using generic for now
  // Note: Reset doesn't take args in mutationFn but queue needs data? 
  // Actually resetCars takes no args. Queue type 'reset_cars' isn't handled in service yet?
  // Wait, I didn't add 'reset_cars' to OfflineQueueService.js switch case.
  // I should check that.

  const resetCarsMutation = useMutation({
    mutationFn: () => carsApi.reset(),
    onSuccess: () => {
      queryClient.invalidateQueries(['cars']);
    },
  });

  // 2. WebSocket Integration
  useEffect(() => {
    if (!userId) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/api/ws';

    // Connect WS immediately
    wsService.connect(wsUrl, userId);

    const handleConnected = (data) => {
      setWsConnected(true);
      setActiveUsers(data.activeClients || 0);
      queryClient.invalidateQueries(['cars']);

      // Try to sync offline queue when connected
      offlineQueueManager.sync();
    };

    const handleDisconnected = () => {
      setWsConnected(false);
    };

    const handleCarsUpdated = () => {
      queryClient.invalidateQueries(['cars']);
    };

    const handleActiveUsersUpdated = (data) => {
      if (data && data.activeClients) {
        setActiveUsers(data.activeClients);
      }
    };

    const handleClientConnected = (data) => {
      if (data && data.activeClients) setActiveUsers(data.activeClients);
    };

    const handleClientDisconnected = (data) => {
      if (data && data.activeClients) setActiveUsers(data.activeClients);
    };

    wsService.on('connected', handleConnected);
    wsService.on('disconnected', handleDisconnected);
    wsService.on('cars_updated', handleCarsUpdated);
    wsService.on('active_users_updated', handleActiveUsersUpdated);
    wsService.on('client_connected', handleClientConnected);
    wsService.on('client_disconnected', handleClientDisconnected);

    return () => {
      wsService.disconnect();
      wsService.off('connected', handleConnected);
      wsService.off('disconnected', handleDisconnected);
      wsService.off('cars_updated', handleCarsUpdated);
      wsService.off('active_users_updated', handleActiveUsersUpdated);
      wsService.off('client_connected', handleClientConnected);
      wsService.off('client_disconnected', handleClientDisconnected);
    };
  }, [userId, queryClient, offlineQueueManager]);

  const value = {
    cars,
    isLoading,
    error,
    userId,
    setUserId,
    activeUsers,
    wsConnected,
    queueStatus,
    dataUpdatedAt,
    addCar: addCarMutation.mutateAsync,
    updateCar: updateCarMutation.mutateAsync,
    deleteCar: deleteCarMutation.mutateAsync,
    resetCars: resetCarsMutation.mutateAsync,
  };

  return (
    <TrackerContext.Provider value={value}>
      {children}
    </TrackerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTracker() {
  const context = useContext(TrackerContext);
  if (!context) {
    throw new Error('useTracker must be used within a TrackerProvider');
  }
  return context;
}
