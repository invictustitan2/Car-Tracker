import {
  BarChart3,
  Bell,
  Filter,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  Users,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sessionsApi, shiftsApi, usageApi } from './api/apiClient';
import CarCard from './CarCard.jsx';
import AuditLogDrawer from './components/AuditLogDrawer.jsx';
import DiagnosticsDrawer from './components/DiagnosticsDrawer.jsx';
import Header from './components/Header.jsx';
import LaneSummary from './components/LaneSummary.jsx';
import NotificationSettings from './components/NotificationSettings.jsx';
import ShiftDialog from './components/ShiftDialog.jsx';
import ShiftHistoryDrawer from './components/ShiftHistoryDrawer.jsx';
import StatsDrawer from './components/StatsDrawer.jsx';
import UserIdentificationDialog from './components/UserIdentificationDialog.jsx';
import { useTracker } from './context/TrackerContext';
import { createCar } from './model/packageCarSchema.js';
import { loadState, saveState } from './storage/trackerStorage';
import { USAGE_EVENTS } from './usage/usageCounters.js';
import { parseCsvContent } from './utils/csvParser.js';

const LOCATIONS = ["Yard", "On Site", "100", "200", "300", "400", "500", "600", "Shop"];
const LOCATION_FILTERS = ['all', ...LOCATIONS];

const VIEW_MODES = {
  list: 'List View',
  board: 'Board View'
};

// Format date to CDT timezone
const formatTimeCDT = (dateString) => {
  if (!dateString) return '';
  const utcDateStr = dateString.includes('Z') || dateString.includes('+') 
    ? dateString 
    : dateString.replace(' ', 'T') + 'Z';
  const date = new Date(utcDateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Format full datetime to CDT timezone
const formatDateTimeCDT = (dateString) => {
  if (!dateString) return '';
  const utcDateStr = dateString.includes('Z') || dateString.includes('+') 
    ? dateString 
    : dateString.replace(' ', 'T') + 'Z';
  const date = new Date(utcDateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Helper to check if sync should be enabled
// Allows E2E tests to disable sync via localStorage
const isSyncEnabled = () => {
  if (typeof window !== 'undefined' && localStorage.getItem('e2e_disable_sync') === 'true') {
    return false;
  }
  // Default to true if variable is missing/undefined in production
  return import.meta.env.VITE_ENABLE_SYNC !== 'false';
};

const STATUS_FILTERS = {
  all: {
    label: 'All',
    predicate: () => true,
  },
  pending: {
    label: 'Pending',
    predicate: car => !car.arrived,
  },
  arrived: {
    label: 'Arrived',
    predicate: car => car.arrived,
  },
  arrivedNotEmpty: {
    label: 'On Site / Not Empty',
    predicate: car => car.arrived && !car.empty,
  },
  late: {
    label: 'Late',
    predicate: car => car.late,
  },
  empty: {
    label: 'Empty',
    predicate: car => car.empty === true,
  },
};

export default function PackageCarTracker({ theme, onToggleTheme, unloadEnabled = false }) {
  const {
    cars,
    userId,
    setUserId,
    activeUsers,
    wsConnected,
    dataUpdatedAt,
    addCar,
    updateCar,
    deleteCar,
    resetCars
  } = useTracker();

  const initialData = useMemo(() => {
    const data = loadState();
    console.log('PackageCarTracker initialData:', data);
    return data;
  }, []);
  // const [cars, setCars] = useState(initialData.cars); // Replaced by context
  const [usageStats, setUsageStats] = useState(initialData.usage);
  const fileInputRef = useRef(null);
  const sessionIdRef = useRef(null);
  const usageSyncIntervalRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  console.log(`[PackageCarTracker] Render. StatusFilter: ${statusFilter}, LocationFilter: ${locationFilter}`);

  const [viewMode, setViewMode] = useState('board');
  const [isManageMode, setIsManageMode] = useState(false);
  const [newCarInput, setNewCarInput] = useState('');
  const [isFleetManagerOpen, setIsFleetManagerOpen] = useState(false);
  const [csvImportErrors, setCsvImportErrors] = useState([]);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // const [activeUsers, setActiveUsers] = useState(0); // Replaced by context
  const [currentShift, setCurrentShift] = useState(initialData.currentShift || null);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [selectedCarForAudit, setSelectedCarForAudit] = useState(null);
  // const [wsConnected, setWsConnected] = useState(false); // Replaced by context
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftDialogType, setShiftDialogType] = useState('start'); // 'start' or 'end'
  const [isShiftHistoryOpen, setIsShiftHistoryOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  // const [userId, setUserId] = useState(...) // Replaced by context
  const [showUserDialog, setShowUserDialog] = useState(false);

  // Prompt for user identification on first launch (skip if already set to non-anonymous)
  useEffect(() => {
    if (userId === 'anonymous') {
      setShowUserDialog(true);
    }
  }, [userId]);

  const handleUserIdentify = useCallback((newUserId) => {
    setUserId(newUserId);
    localStorage.setItem('ups_tracker_user_id', newUserId);
    setShowUserDialog(false);
  }, [setUserId]);

  const handleChangeUser = useCallback(() => {
    if (confirm('Change user? This will end your current session and prompt for a new user ID.')) {
      // Reset to anonymous and show identification dialog
      setUserId('anonymous');
      localStorage.setItem('ups_tracker_user_id', 'anonymous');
      setShowUserDialog(true);
    }
  }, [setUserId]);

  // Save to localStorage so we always have an offline/bootstrap snapshot even though the
  // server remains the primary source of truth. This keeps historical tests and
  // resilience flows working while allowing D1/WebSockets to drive fresh data.
  useEffect(() => {
    const snapshot = Array.isArray(cars) ? cars : [];
    saveState({
      cars: snapshot,
      usage: usageStats,
      currentShift,
    });
  }, [cars, usageStats, currentShift]);

  // WebSocket real-time sync handled by TrackerContext
  // Data loading handled by TrackerContext


  // Session tracking
  useEffect(() => {
    const enableSync = isSyncEnabled();
    if (!enableSync) return; // Allow anonymous to work

    const deviceInfo = navigator.userAgent;

    // Start session
    const startSession = async () => {
      try {
        const { sessionId } = await sessionsApi.start(userId, deviceInfo);
        sessionIdRef.current = sessionId;
        console.log('Session started:', sessionId);
      } catch (error) {
        console.error('Failed to start session:', error);
      }
    };

    startSession();

    // Send heartbeat every 30 seconds (fallback if WebSocket disconnected)
    const heartbeatInterval = setInterval(async () => {
      if (sessionIdRef.current && !wsConnected) {
        try {
          await sessionsApi.heartbeat(sessionIdRef.current);
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      }
    }, 30000);

    // Handle session end on unmount or window close
    const handleUnload = () => {
      if (sessionIdRef.current) {
        const id = sessionIdRef.current;
        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/sessions/${id}/end`;
        const apiKey = import.meta.env.VITE_API_KEY || 'test-api-key';

        // Use fetch with keepalive to support headers (Auth)
        fetch(url, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          },
          body: JSON.stringify({ userId })
        }).catch(console.error);
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload(); // Also call on component unmount
    };
  }, [userId, wsConnected]);

  // Usage stats sync
  useEffect(() => {
    const enableSync = isSyncEnabled();
    if (!enableSync) return; // Allow anonymous to work

    // Sync usage stats every 5 minutes
    const syncUsageStats = async () => {
      const events = Object.entries(usageStats).map(([type, count]) => ({
        type,
        count,
      }));

      if (events.length > 0 && events.some(e => e.count > 0)) {
        try {
          await usageApi.submit(userId, events);
          console.log('Usage stats synced:', events.length, 'events');
        } catch (error) {
          console.error('Failed to sync usage stats:', error);
        }
      }
    };

    // Initial sync after 1 minute
    const initialTimeout = setTimeout(syncUsageStats, 60000);

    // Then sync every 5 minutes
    usageSyncIntervalRef.current = setInterval(syncUsageStats, 300000);

    return () => {
      clearTimeout(initialTimeout);
      if (usageSyncIntervalRef.current) {
        clearInterval(usageSyncIntervalRef.current);
      }
    };
  }, [userId, usageStats]);

  // Keyboard shortcut for diagnostics (Ctrl+D in dev mode)
  useEffect(() => {
    if (import.meta.env.MODE !== 'development') return;

    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        setIsDiagnosticsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  useEffect(() => {
    if (!isManageMode) {
      setIsFleetManagerOpen(false);
    }
  }, [isManageMode]);

  useEffect(() => {
    if (!isFleetManagerOpen || typeof window === 'undefined') return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsFleetManagerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFleetManagerOpen]);

  const stats = useMemo(() => {
    const total = cars.length;
    const arrived = cars.filter(c => c.arrived).length;
    const late = cars.filter(c => c.late).length;
    const empty = cars.filter(c => c.empty).length;
    const pending = total - arrived;
    return { total, arrived, late, empty, pending };
  }, [cars]);

  const trackUsage = useCallback((metric) => {
    setUsageStats(prev => ({
      ...prev,
      [metric]: (prev[metric] || 0) + 1,
    }));
  }, []);

  const resetUsageCounters = useCallback(() => {
    setUsageStats(Object.keys(usageStats).reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {}));
  }, [usageStats]);

  const openFleetManager = useCallback(() => setIsFleetManagerOpen(true), []);
  const closeFleetManager = useCallback(() => setIsFleetManagerOpen(false), []);

  const toggleStatus = useCallback(async (id, field) => {
    // Track status toggle events
    if (field === 'arrived') {
      trackUsage(USAGE_EVENTS.ARRIVED_TOGGLE);
    } else if (field === 'late') {
      trackUsage(USAGE_EVENTS.LATE_TOGGLE);
    } else if (field === 'empty') {
      trackUsage(USAGE_EVENTS.EMPTY_TOGGLE);
    }

    const car = cars.find(c => c.id === id);
    if (!car) return;

    const updates = { [field]: !car[field] };

    // Apply business logic
    if (field === 'empty' && updates.empty) {
      updates.arrived = true;
    }
    if (field === 'arrived' && !updates.arrived) {
      updates.empty = false;
    }

    try {
      await updateCar({ id, updates, version: car.version });
    } catch (error) {
      console.error('Failed to sync car update:', error);
    }
  }, [cars, updateCar, trackUsage]);

  const updateLocation = useCallback(async (id, newLocation) => {
    trackUsage(USAGE_EVENTS.CAR_LOCATION_CHANGE);

    const car = cars.find(c => c.id === id);
    if (!car) return;

    try {
      await updateCar({ id, updates: { location: newLocation }, version: car.version });
    } catch (error) {
      console.error('Failed to sync location update:', error);
    }
  }, [cars, updateCar, trackUsage]);

  const startShift = async () => {
    // Open dialog - shift management works locally even without sync
    setShiftDialogType('start');
    setShiftDialogOpen(true);
  };

  const handleStartShiftConfirm = async (notes) => {
    const enableSync = isSyncEnabled();

    // Create shift with snapshot of current car states
    const shiftData = {
      startedAt: new Date().toISOString(),
      startedBy: userId,
      snapshot: cars.map(car => ({ ...car })), // Deep copy of current cars
      notes: notes || undefined,
    };

    // Always update local state
    setCurrentShift(shiftData);
    setShiftDialogOpen(false);

    // Sync to API only if enabled
    if (enableSync) {
      try {
        setIsSyncing(true);
        await shiftsApi.start(userId, notes);
        console.log('Shift started and synced successfully');
      } catch (error) {
        console.error('Failed to sync shift start:', error);
        // Don't block local operation on sync failure
      } finally {
        setIsSyncing(false);
      }
    } else {
      console.log('Shift started locally (sync disabled)');
    }
  };

  const resetShift = async () => {
    // Open end shift dialog if shift is active
    if (currentShift) {
      setShiftDialogType('end');
      setShiftDialogOpen(true);
    } else {
      // No active shift, just confirm reset
      if (!window.confirm("Are you sure you want to reset all car statuses to Pending?")) {
        return;
      }
      performReset();
    }
  };

  const handleEndShiftConfirm = async (notes) => {
    trackUsage(USAGE_EVENTS.SHIFT_RESET);
    const enableSync = isSyncEnabled();

    // Always update local state
    setCurrentShift(null);
    setShiftDialogOpen(false);
    performReset();

    // Sync to API only if enabled
    if (enableSync) {
      try {
        setIsSyncing(true);
        await shiftsApi.end(userId, notes);
        console.log('Shift ended and synced successfully');
      } catch (error) {
        console.error('Failed to sync shift end:', error);
        // Local operation already completed, just log the sync failure
      } finally {
        setIsSyncing(false);
      }
    } else {
      console.log('Shift ended locally (sync disabled)');
    }
  };

  const performReset = async () => {
    trackUsage(USAGE_EVENTS.SHIFT_RESET);

    try {
      await resetCars();
      console.log('Shift reset synced to backend');
    } catch (error) {
      console.error('Failed to sync reset:', error);
      alert('Failed to sync reset to server');
    }
  };

  const handleAddCar = async (e) => {
    e.preventDefault();
    const trimmed = newCarInput.trim();

    // Validate car ID format (alphanumeric, hyphens, underscores)
    if (!trimmed) return;
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      alert('Car ID must contain only letters, numbers, hyphens, or underscores');
      return;
    }
    if (cars.find(c => c.id === trimmed)) {
      alert(`Car ${trimmed} already exists`);
      return;
    }

    trackUsage(USAGE_EVENTS.CAR_ADDED);

    const newCar = createCar({ id: trimmed });
    setNewCarInput('');

    try {
      await addCar(newCar);
    } catch (error) {
      console.error('Failed to sync new car:', error);
      setNewCarInput(trimmed); // Restore input
    }
  };

  const handleRemoveCar = useCallback(async (id) => {
    const confirmMsg = currentShift 
      ? `⚠️ Shift is active!\n\nRemove car ${id} from the fleet? This takes effect immediately.`
      : `Remove car ${id} from the fleet list?`;
    
    if (window.confirm(confirmMsg)) {
      trackUsage(USAGE_EVENTS.CAR_REMOVED);

      try {
        await deleteCar({ id, userId });
      } catch (error) {
        console.error('Failed to sync car removal:', error);
      }
    }
  }, [currentShift, deleteCar, trackUsage, userId]);

  const handleViewHistory = useCallback((carId) => {
    setSelectedCarForAudit(carId);
    setIsAuditLogOpen(true);
  }, []);

  const handleImportCsvClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCsvFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvImportErrors([]); // Clear previous errors

    try {
      const text = await file.text();
      const { cars: parsedCars, errors } = parseCsvContent(text);

      // Store errors for display
      if (errors.length > 0) {
        setCsvImportErrors(errors);
      }

      // Separate new cars from updates to existing cars
      if (parsedCars.length > 0) {
        const existingIds = new Set(cars.map(car => car.id));
        const newCars = parsedCars.filter(car => !existingIds.has(car.id));
        const updatedCars = parsedCars.filter(car => existingIds.has(car.id));

        if (newCars.length > 0 || updatedCars.length > 0) {
          trackUsage(USAGE_EVENTS.CSV_IMPORT);

          try {
            setIsSyncing(true);
            // Create new cars and update existing ones in parallel
            await Promise.all([
              ...newCars.map(car => addCar(car)),
              ...updatedCars.map(car => updateCar({ id: car.id, updates: car }))
            ]);
          } catch (error) {
            console.error('Failed to sync CSV import:', error);
            if (typeof window !== 'undefined') {
              window.alert('Failed to sync imported cars to server. Please try again.');
            }
            return;
          } finally {
            setIsSyncing(false);
          }

          if (typeof window !== 'undefined') {
            let successMsg;
            if (newCars.length === 0 && updatedCars.length === 0) {
              successMsg = 'No new car IDs found in CSV.';
            } else {
              successMsg = `Imported ${newCars.length} new car${newCars.length === 1 ? '' : 's'}${updatedCars.length > 0 ? `, updated ${updatedCars.length}` : ''} from CSV.`;
            }
            const errorMsg = errors.length > 0 ? ` ${errors.length} row${errors.length === 1 ? '' : 's'} had errors.` : '';
            window.alert(successMsg + errorMsg);
          }
        } else {
          if (typeof window !== 'undefined') {
            const msg = errors.length > 0
              ? `No new cars imported. ${errors.length} row${errors.length === 1 ? '' : 's'} had errors.`
              : 'No new car IDs found in CSV.';
            window.alert(msg);
          }
        }
      } else {
        // All rows failed
        if (typeof window !== 'undefined' && errors.length > 0) {
          window.alert(`CSV import failed. ${errors.length} row${errors.length === 1 ? '' : 's'} had errors. Check the error panel for details.`);
        }
      }
    } catch (error) {
      console.error('Unable to import CSV', error);
      if (typeof window !== 'undefined') {
        window.alert('Unable to import CSV. Please check the file format and try again.');
      }
    } finally {
      // reset value so the same file can be uploaded twice if needed
      if (event.target) {
        event.target.value = '';
      }
    }
  }, [cars, trackUsage, addCar, updateCar]);

  const handleExportCsv = useCallback(() => {
    if (typeof window === 'undefined') return;
    trackUsage(USAGE_EVENTS.CSV_EXPORT);
    
    // Helper to escape CSV values containing commas, quotes, or newlines
    const escapeCsvValue = (value) => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    // Enhanced CSV with timestamps for supervision reports
    const header = 'Car ID,Location,Status,Arrived,Arrived At,Empty,Emptied At,Late,Notes,Last Updated';
    const rows = cars.map(car => {
      const status = car.empty ? 'Empty' : car.arrived ? 'Arrived' : car.late ? 'Late' : 'Pending';
      return [
        car.id,
        car.location || '',
        status,
        car.arrived ? 'Yes' : 'No',
        escapeCsvValue(formatDateTimeCDT(car.arrivedAt)),
        car.empty ? 'Yes' : 'No',
        escapeCsvValue(formatDateTimeCDT(car.emptyAt)),
        car.late ? 'Yes' : 'No',
        escapeCsvValue(car.notes || ''),
        escapeCsvValue(formatDateTimeCDT(car.lastUpdatedAt))
      ].join(',');
    });
    
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ups-car-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [cars, trackUsage]);

  const filteredCars = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const statusPredicate = STATUS_FILTERS[statusFilter]?.predicate ?? STATUS_FILTERS.all.predicate;
    console.log(`Filtering cars. Filter: ${statusFilter}, Total cars: ${cars.length}`);
    return cars.filter(car => {
      const carId = String(car.id).toLowerCase();
      const matchesSearch = query ? carId.includes(query) : true;
      const matchesStatus = statusPredicate(car);
      const matchesLocation = locationFilter === 'all' ? true : car.location === locationFilter;

      if (statusFilter === 'empty') {
        console.log(`Checking car ${car.id}: empty=${car.empty}, matchesStatus=${matchesStatus}`);
      }

      if (statusFilter === 'empty' && !matchesStatus && matchesSearch && matchesLocation) {
        // Log cars that SHOULD be filtered out but might be slipping through if logic is wrong
        // Actually, if !matchesStatus, it IS filtered out.
      }
      if (statusFilter === 'empty' && matchesStatus && !car.empty) {
        console.error('CRITICAL: Car matched empty filter but is not empty!', car);
      }

      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [cars, searchQuery, statusFilter, locationFilter]);


  const carsByLocation = useMemo(() => {
    const grouped = LOCATIONS.reduce((acc, loc) => {
      acc[loc] = [];
      return acc;
    }, {});

    filteredCars.forEach(car => {
      const key = LOCATIONS.includes(car.location) ? car.location : 'Yard';
      grouped[key]?.push(car);
    });

    return grouped;
  }, [filteredCars]);

  return (
    <>
      <Header
        theme={theme}
        onToggleTheme={onToggleTheme}
        currentShift={currentShift}
        activeUsers={activeUsers}
        onShowShiftHistory={() => setIsShiftHistoryOpen(true)}
        onShowStats={() => setIsStatsOpen(true)}
        onChangeUser={handleChangeUser}
        currentUserId={userId}
        unloadEnabled={unloadEnabled}
      />

      {/* CSV Import Errors Panel */}
      {csvImportErrors.length > 0 && (
        <div className="fixed top-4 right-4 z-50 max-w-md w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-red-900 dark:text-red-100">CSV Import Errors</h3>
            <button
              onClick={() => setCsvImportErrors([])}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
              aria-label="Dismiss errors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto text-sm text-red-800 dark:text-red-200 space-y-1">
            {csvImportErrors.map((err, idx) => (
              <div key={idx} className="text-xs">
                {err.rowIndex > 0 ? `Row ${err.rowIndex}: ` : ''}{err.error}
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Fixed: Added hidden H2 for semantic structure (Heading Order violation) */}
        <h2 className="sr-only">Active Fleet Dashboard</h2>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Controls & Stats */}
          <div className="lg:col-span-3 space-y-6">

            {/* Search & Add */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search car number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  aria-label="Search cars"
                />
              </div>

              <form onSubmit={handleAddCar} className="flex gap-2">
                <input
                  type="text"
                  inputMode="text"
                  // Allow alphanumeric car IDs (e.g., CAR123456, A11Y12345, 12345)
                  // Validation handled in addCar function instead of HTML5 pattern
                  value={newCarInput}
                  onChange={e => setNewCarInput(e.target.value)}
                  placeholder="Add ID..."
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  aria-label="New car ID"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm font-medium transition-colors"
                  aria-label="Add car"
                >
                  Add
                </button>
              </form>
            </div>

            {/* Active Users & Shift Info */}
            {isSyncEnabled() && (activeUsers > 0 || currentShift) && (
              <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 space-y-2">
                {activeUsers > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users size={14} className="text-blue-500" />
                    <span className="text-slate-700 dark:text-slate-300">
                      <strong>{activeUsers}</strong> {activeUsers === 1 ? 'user' : 'users'} online
                    </span>
                  </div>
                )}
                {currentShift && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-slate-700 dark:text-slate-300">
                      Shift started {formatTimeCDT(currentShift.startedAt)}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setIsNotificationsOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-brown-50 hover:bg-brown-100 dark:bg-brown-900/20 dark:hover:bg-brown-900/40 border border-brown-200 dark:border-brown-700 rounded-md transition-colors text-brown-700 dark:text-brown-300"
                  title="Notification Settings"
                >
                  <Bell size={14} />
                  <span>Notifications</span>
                </button>
              </div>
            )}

            {/* Stats Summary */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shift Summary</h3>
              </div>
              
              {/* Shift State Indicator */}
              <div className="flex items-center gap-2 text-xs mb-2">
                {currentShift ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Shift: In Progress
                    </span>
                    {currentShift.startedAt && (
                      <span className="text-slate-400">
                        since {formatTimeCDT(currentShift.startedAt)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">
                    No active shift
                  </span>
                )}
              </div>
              
              <LaneSummary title="Arrived" count={stats.arrived} total={stats.total} variant="info" />
              <LaneSummary title="Pending" count={stats.pending} total={stats.total} variant="warning" />
              <LaneSummary title="Completed" count={stats.empty} total={stats.total} variant="success" />
              <LaneSummary title="Late" count={stats.late} total={stats.total} variant="error" />
              
              {/* Sync Status Indicator */}
              {isSyncEnabled() && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                    <span>
                      {isSyncing ? 'Syncing...' : (
                        <>
                          Synced · Auto-saved
                          {dataUpdatedAt ? ` · ${formatTimeCDT(new Date(dataUpdatedAt).toISOString())}` : ''}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Filters</h3>
              <div className="space-y-1" role="tablist" aria-label="Status filters">
                {Object.entries(STATUS_FILTERS).map(([value, config]) => (
                  <button
                    key={value}
                    role="tab"
                    aria-selected={statusFilter === value}
                    onClick={() => {
                      console.log(`[PackageCarTracker] Clicked filter: ${value}`);
                      setStatusFilter(value);
                      trackUsage(USAGE_EVENTS.FILTER_CLICK);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === value

                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={() => setIsManageMode(!isManageMode)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                {isManageMode ? 'Close Fleet Manager' : 'Manage Fleet'}
              </button>

              {!currentShift && (
                <button
                  onClick={startShift}
                  disabled={cars.length === 0}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={14} /> Start Shift
                </button>
              )}              <button
                onClick={resetShift}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} /> {currentShift ? 'End Shift & Reset' : 'Reset Board'}
              </button>
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">
                Clears statuses · Keeps fleet
              </p>
            </div>
          </div>

          {/* Right Column: Content */}
          <div className="lg:col-span-9 space-y-6">

            {/* Top Bar: Location & View Toggle */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex gap-2 overflow-x-auto pb-1 max-w-full" role="group" aria-label="Location filters">
                {LOCATION_FILTERS.map(loc => (
                  <button
                    key={loc}
                    onClick={() => {
                      setLocationFilter(loc);
                      trackUsage(USAGE_EVENTS.LOCATION_CLICK);
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${locationFilter === loc
                      ? 'bg-slate-800 dark:bg-slate-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                  >
                    {loc === 'all' ? 'All Locations' : loc}
                  </button>
                ))}
              </div>

              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg" role="group" aria-label="View mode">
                {Object.entries(VIEW_MODES).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => {
                      setViewMode(value);
                      trackUsage(USAGE_EVENTS.VIEW_TOGGLE);
                    }}
                    aria-pressed={viewMode === value}
                    aria-label={label}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === value
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                  >
                    {value === 'list' ? <List size={14} /> : <LayoutGrid size={14} />}
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fleet Manager Panel */}
            {isManageMode && (
              <div className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">Fleet Management</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Bulk import/export and roster management.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt,text/csv,text/plain"
                      onChange={handleCsvFileChange}
                      className="sr-only"
                      data-testid="fleet-import-input"
                      aria-label="Import CSV file"
                    />
                    <button
                      onClick={handleImportCsvClick}
                      disabled={!!currentShift}
                      title={currentShift ? 'Bulk imports disabled during active shift' : 'Import cars from CSV'}
                      className={`px-3 py-2 border rounded-md text-sm font-medium ${
                        currentShift 
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      Import CSV
                    </button>
                    <button
                      onClick={handleExportCsv}
                      className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={openFleetManager}
                      data-testid="open-fleet-manager"
                      className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      Full Roster
                    </button>
                  </div>
                </div>
                {currentShift && (
                  <div className="mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Shift is active — changes apply immediately
                  </div>
                )}
              </div>
            )}

            {/* Content Area */}
            {viewMode === 'board' ? (
              <div className="overflow-x-auto pb-4 snap-x snap-mandatory" data-testid="board-view">
                <div className="flex gap-4 min-w-max">
                  {LOCATIONS.map(location => {
                    const carsForLocation = carsByLocation[location] || [];
                    return (
                      <div
                        key={location}
                        data-testid={`board-column-${location}`}
                        className="w-72 bg-slate-100 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-800 snap-start"
                      >
                        <div className="flex items-center justify-between mb-3 px-1 sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 py-2 -mt-3 -mx-3 px-4 rounded-t-lg border-b border-slate-200 dark:border-slate-800">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{location}</span>
                          <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold px-2 py-0.5 rounded-full">
                            {carsForLocation.length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {carsForLocation.length === 0 ? (
                            <div className="h-24 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center">
                              <span className="text-xs text-slate-400">Empty</span>
                            </div>
                          ) : (
                            carsForLocation.map(car => (
                              <CarCard
                                key={car.id}
                                car={car}
                                LOCATIONS={LOCATIONS}
                                isManageMode={isManageMode}
                                toggleStatus={toggleStatus}
                                updateLocation={updateLocation}
                                removeCar={handleRemoveCar}
                                onViewHistory={handleViewHistory}
                                compact
                              />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="list-view">
                {filteredCars.map(car => (
                  <CarCard
                    key={car.id}
                    car={car}
                    LOCATIONS={LOCATIONS}
                    isManageMode={isManageMode}
                    toggleStatus={toggleStatus}
                    updateLocation={updateLocation}
                    removeCar={handleRemoveCar}
                    onViewHistory={handleViewHistory}
                  />
                ))}
              </div>
            )}

            {filteredCars.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                <Filter className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No cars found</p>
                <p className="text-sm">Try adjusting your filters or search query</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Fleet Manager Modal */}
      {isFleetManagerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fleet-manager-title"
          data-testid="fleet-manager-modal"
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeFleetManager} />
          <div
            className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-full"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 id="fleet-manager-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">Fleet Manager</h3>
              <button
                onClick={closeFleetManager}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Close Fleet Manager"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {currentShift && (
                <div className="mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                  Shift is active — fleet changes apply immediately
                </div>
              )}
              <form onSubmit={handleAddCar} className="flex gap-2 mb-6">
                <input
                  type="number"
                  value={newCarInput}
                  onChange={e => setNewCarInput(e.target.value)}
                  placeholder="Enter car ID..."
                  className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button type="submit" className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors">
                  Add
                </button>
              </form>

              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden" data-testid="fleet-manager-list">
                <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  Current Roster ({cars.length})
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                  {cars.map(car => (
                    <li key={car.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">#{car.id}</span>
                        <select
                          value={car.location}
                          onChange={(e) => updateLocation(car.id, e.target.value)}
                          className="text-sm bg-transparent border-none text-slate-500 focus:ring-0 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                          aria-label={`Update location for car ${car.id}`}
                        >
                          {LOCATIONS.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => handleRemoveCar(car.id)}
                        className="text-sm text-red-500 hover:text-red-700 font-medium"
                        aria-label={`Remove car ${car.id}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Drawer (dev-only) */}
      <DiagnosticsDrawer
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        counters={usageStats}
        cars={cars}
        onReset={resetUsageCounters}
      />

      {/* Audit Log Drawer */}
      <AuditLogDrawer
        isOpen={isAuditLogOpen}
        onClose={() => {
          setIsAuditLogOpen(false);
          setSelectedCarForAudit(null);
        }}
        carId={selectedCarForAudit}
      />

      {/* Notification Settings Drawer */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell size={20} />
                Notification Settings
              </h2>
              <button
                onClick={() => setIsNotificationsOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Close notification settings"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <NotificationSettings
                apiUrl={import.meta.env.VITE_API_URL || 'http://localhost:8787'}
                userId={userId || 'anonymous'}
              />
            </div>
          </div>
        </div>
      )}

      {/* Dev-only Diagnostics Toggle Button */}
      {import.meta.env.MODE === 'development' && (
        <button
          onClick={() => setIsDiagnosticsOpen(true)}
          className="fixed bottom-4 right-4 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-all hover:scale-110 z-30"
          aria-label="Open diagnostics"
          title="Open Diagnostics (Ctrl+D)"
        >
          <BarChart3 size={20} />
        </button>
      )}

      {/* Shift Management Dialog */}
      <ShiftDialog
        isOpen={shiftDialogOpen}
        onClose={() => setShiftDialogOpen(false)}
        onConfirm={shiftDialogType === 'start' ? handleStartShiftConfirm : handleEndShiftConfirm}
        type={shiftDialogType}
        isLoading={isSyncing}
      />

      {/* Shift History Drawer */}
      <ShiftHistoryDrawer
        isOpen={isShiftHistoryOpen}
        onClose={() => setIsShiftHistoryOpen(false)}
      />

      <StatsDrawer
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
      />

      {/* Diagnostics Drawer (dev-only) */}
      <DiagnosticsDrawer
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        counters={usageStats}
        cars={cars}
        onReset={resetUsageCounters}
      />

      {/* User Identification Dialog */}
      <UserIdentificationDialog
        isOpen={showUserDialog}
        onIdentify={handleUserIdentify}
      />
    </>
  );
}
