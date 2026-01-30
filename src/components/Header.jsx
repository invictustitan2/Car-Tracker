import { BarChart3, Clock, Cloud, CloudOff, History, LogOut, Moon, RefreshCw, Sun, Truck, DoorOpen } from 'lucide-react';
import { memo } from 'react';
import { useTracker } from '../context/TrackerContext';

function Header({ theme, onToggleTheme, currentShift = null, activeUsers = 0, onShowShiftHistory, onShowStats, onChangeUser, currentUserId, unloadEnabled = false }) {


  const { wsConnected, queueStatus } = useTracker();

  // Format shift start time
  const formatShiftTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <header className="bg-amber-900 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
            <Truck className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight">UPS Package Car Tracker</h1>
            <div className="flex items-center gap-2">
              {/* Sync Status Indicator */}
              {queueStatus.pending > 0 ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-500/20 border border-orange-400/30 rounded-md animate-pulse">
                  <CloudOff size={12} className="text-orange-300" />
                  <span className="text-xs font-medium text-orange-100">
                    Offline ({queueStatus.pending})
                  </span>
                </div>
              ) : !wsConnected ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 border border-yellow-400/30 rounded-md">
                  <RefreshCw size={12} className="text-yellow-300 animate-spin" />
                  <span className="text-xs font-medium text-yellow-100">
                    Connecting...
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 border border-green-400/30 rounded-md">
                  <Cloud size={12} className="text-green-300" />
                  <span className="text-xs font-medium text-green-100">
                    Synced
                  </span>
                </div>
              )}

              {currentShift && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 border border-green-400/30 rounded-md">
                  <Clock size={12} className="text-green-300" />
                  {/* Fixed contrast: changed green-200 to green-100 */}
                  <span className="text-xs font-medium text-green-100">
                    Shift Active • {formatShiftTime(currentShift.startedAt)}
                  </span>
                </div>
              )}
              {activeUsers > 0 && (
                /* Fixed contrast: changed amber-300/70 to amber-100 */
                <span className="text-xs text-amber-100">
                  {activeUsers} user{activeUsers !== 1 ? 's' : ''} online
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUserId && currentUserId !== 'anonymous' && onChangeUser && (
            <button
              onClick={onChangeUser}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              aria-label="Change user"
              title={`Logged in as ${currentUserId}`}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">{currentUserId}</span>
            </button>
          )}
          {unloadEnabled && (
            <a
              href="#/unload"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-600/80 hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              title="Door Board"
            >
              <DoorOpen size={14} />
              <span className="hidden sm:inline">Unload</span>
            </a>
          )}
          <button
            onClick={onShowShiftHistory}
            className="p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="View shift history"
            title="Shift History"
          >
            <History size={20} />
          </button>
          <button
            onClick={onShowStats}
            className="p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="View analytics"
            title="Analytics"
          >
            <BarChart3 size={20} />
          </button>
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
