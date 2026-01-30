/**
 * UnloadApp - Main container for Unload module
 * 
 * Renders the Door Board and handles state management.
 * See docs/unload/UNLOAD_UI_PLAN.md
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ClipboardCheck } from 'lucide-react';
import DoorBoard from './components/DoorBoard';
import VerifyDoorsWizard from './components/VerifyDoorsWizard';
import VisitDrawer from './components/VisitDrawer';
import { unloadApi } from './unloadApi';

const POLL_INTERVAL = 10000; // 10 seconds

function getUserId() {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('ups_tracker_user_id') || 'anonymous';
  }
  return 'anonymous';
}

export default function UnloadApp() {
  const [doors, setDoors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  
  const [showVerifyWizard, setShowVerifyWizard] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  
  const [selectedDoor, setSelectedDoor] = useState(null);

  const userId = getUserId();

  const loadDoors = useCallback(async () => {
    try {
      const response = await unloadApi.getDoors();
      setDoors(response.doors);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to load doors:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDoors();
  }, [loadDoors]);

  // Polling
  useEffect(() => {
    const interval = setInterval(loadDoors, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [loadDoors]);

  const handleVerifySubmit = async (doorData) => {
    setVerifyLoading(true);
    try {
      await unloadApi.verifyDoors(userId, doorData);
      setShowVerifyWizard(false);
      await loadDoors();
    } catch (err) {
      console.error('Verify failed:', err);
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSelectDoor = (door) => {
    setSelectedDoor(door);
  };

  const handleCloseDrawer = () => {
    setSelectedDoor(null);
  };

  const handleRefresh = async () => {
    await loadDoors();
    // Update selected door if still selected
    if (selectedDoor) {
      const updated = doors.find(d => d.doorNumber === selectedDoor.doorNumber);
      if (updated) setSelectedDoor(updated);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" data-testid="unload-app">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                🚛 Door Board
              </h1>
              {lastRefresh && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Updated {lastRefresh.toLocaleTimeString()}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={loadDoors}
                disabled={isLoading}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Refresh"
                data-testid="refresh-btn"
              >
                <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
              </button>
              
              <button
                onClick={() => setShowVerifyWizard(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                data-testid="verify-doors-btn"
              >
                <ClipboardCheck size={18} />
                <span className="hidden sm:inline">Verify Doors</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-4 py-3 text-sm">
          Failed to load: {error}
          <button onClick={loadDoors} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        <DoorBoard
          doors={doors}
          onSelectDoor={handleSelectDoor}
          isLoading={isLoading && doors.length === 0}
        />
      </main>

      {/* Verify Wizard Modal */}
      <VerifyDoorsWizard
        isOpen={showVerifyWizard}
        onClose={() => setShowVerifyWizard(false)}
        onSubmit={handleVerifySubmit}
        isLoading={verifyLoading}
      />

      {/* Visit Drawer */}
      <VisitDrawer
        door={selectedDoor}
        onClose={handleCloseDrawer}
        onRefresh={handleRefresh}
        userId={userId}
      />

      {/* Footer nav link back to tracker */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-2">
        <div className="max-w-7xl mx-auto flex justify-center">
          <a
            href="/"
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            ← Back to Package Car Tracker
          </a>
        </div>
      </nav>
    </div>
  );
}
