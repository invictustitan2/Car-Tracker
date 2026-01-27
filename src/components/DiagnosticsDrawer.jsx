import { BarChart3, X } from 'lucide-react';
import { useMemo } from 'react';
import { calculateDerivedStats } from '../usage/usageCounters.js';

/**
 * DiagnosticsDrawer Component
 * 
 * Development-only panel for viewing usage statistics and diagnostics.
 * This component is excluded from production builds via environment check.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the drawer is open
 * @param {Function} props.onClose - Callback to close the drawer
 * @param {Object} props.counters - Current usage counters
 * @param {Array} props.cars - Current car list for contextual stats
 * @param {Function} props.onReset - Callback to reset counters
 */
export default function DiagnosticsDrawer({ isOpen, onClose, counters, cars = [], onReset }) {
  const stats = useMemo(() => {
    return calculateDerivedStats(counters, cars);
  }, [counters, cars]);

  // Only render in development
  if (import.meta.env.MODE !== 'development') {
    return null;
  }

  if (!isOpen) return null;

  const handleReset = () => {
    if (window.confirm('Reset all diagnostics counters? This cannot be undone.')) {
      onReset();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-y-auto"
        role="dialog"
        aria-labelledby="diagnostics-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} />
            <h2 id="diagnostics-title" className="text-lg font-semibold">
              Development Diagnostics
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-md transition-colors"
            aria-label="Close diagnostics"
          >
            <X size={20} />
          </button>
        </div>

        {/* Environment Badge */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 p-3">
          <p className="text-xs text-amber-800 dark:text-amber-400 font-medium flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
            DEV MODE ONLY - Not visible in production
          </p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">

          {/* Summary Stats */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Total Actions"
                value={stats.totalActions}
                highlight={true}
              />
              <StatCard
                label="Most Used"
                value={stats.mostUsedFeature}
                small={true}
              />
            </div>
          </section>

          {/* Current Fleet Stats */}
          {stats.carStats && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Current Fleet Status
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <StatCard
                  label="Arrived"
                  value={`${stats.carStats.arrivedPercent}%`}
                  color="green"
                />
                <StatCard
                  label="Late"
                  value={`${stats.carStats.latePercent}%`}
                  color="red"
                />
                <StatCard
                  label="Empty"
                  value={`${stats.carStats.emptyPercent}%`}
                  color="blue"
                />
              </div>
            </section>
          )}

          {/* Interaction Counters */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Filter & View Interactions
            </h3>
            <div className="space-y-2">
              <CounterRow label="Status Filters" value={counters.filterClicks} />
              <CounterRow label="Location Filters" value={counters.locationClicks} />
              <CounterRow label="View Toggles" value={counters.viewToggles} />
              <CounterRow
                label="Total Filter Clicks"
                value={stats.totalFilterClicks}
                subtotal={true}
              />
            </div>
          </section>

          {/* Status Toggle Counters */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Status Toggles
            </h3>
            <div className="space-y-2">
              <CounterRow label="Arrived Toggles" value={counters.arrivedToggles} />
              <CounterRow label="Late Toggles" value={counters.lateToggles} />
              <CounterRow label="Empty Toggles" value={counters.emptyToggles} />
              <CounterRow
                label="Total Status Changes"
                value={stats.totalStatusToggles}
                subtotal={true}
              />
            </div>
          </section>

          {/* Car Management */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Fleet Management
            </h3>
            <div className="space-y-2">
              <CounterRow label="Cars Added" value={counters.carsAdded} />
              <CounterRow label="Cars Removed" value={counters.carsRemoved} />
              <CounterRow label="Location Changes" value={counters.carLocationChanges} />
              <CounterRow label="Car Selections" value={counters.carSelections} />
              <CounterRow
                label="Total Car Changes"
                value={stats.totalCarChanges}
                subtotal={true}
              />
            </div>
          </section>

          {/* Data Operations */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Data Operations
            </h3>
            <div className="space-y-2">
              <CounterRow label="CSV Imports" value={counters.csvImports} />
              <CounterRow label="CSV Exports" value={counters.csvExports} />
              <CounterRow label="Shifts Reset" value={counters.shiftsReset} />
            </div>
          </section>

          {/* Actions */}
          <section className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handleReset}
              className="w-full px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              Reset All Counters
            </button>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
              Keyboard shortcut: <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">Ctrl+D</kbd>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

/**
 * StatCard - Display a statistic with label and value
 */
function StatCard({ label, value, color = 'slate', highlight = false, small = false }) {
  const colorClasses = {
    slate: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
        {label}
      </div>
      <div className={`font-bold text-slate-900 dark:text-white ${highlight ? 'text-2xl' : small ? 'text-xs' : 'text-lg'
        }`}>
        {value}
      </div>
    </div>
  );
}

/**
 * CounterRow - Display a counter with label
 */
function CounterRow({ label, value, subtotal = false }) {
  return (
    <div className={`flex justify-between items-center py-2 px-3 rounded ${subtotal
        ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold border border-blue-200 dark:border-blue-800'
        : 'bg-slate-50 dark:bg-slate-800'
      }`}>
      <span className="text-sm text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <span className={`text-sm font-mono ${subtotal
          ? 'text-blue-700 dark:text-blue-400'
          : 'text-slate-600 dark:text-slate-400'
        }`}>
        {value}
      </span>
    </div>
  );
}
