import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { shiftsApi } from '../api/apiClient.js';

/**
 * Drawer component that displays shift history
 * Shows previous shifts with notes, start/end times, and snapshots
 */
export default function ShiftHistoryDrawer({ isOpen, onClose }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadShiftHistory();
    }
  }, [isOpen]);

  const loadShiftHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shiftsApi.getRecent(20); // Last 20 shifts
      setShifts(data.shifts || []);
    } catch (err) {
      console.error('Failed to load shift history:', err);
      setError('Failed to load shift history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const parseSnapshot = (snapshotString) => {
    if (!snapshotString) return null;
    try {
      return JSON.parse(snapshotString);
    } catch {
      return null;
    }
  };

  const getSnapshotStats = (snapshot) => {
    if (!snapshot || !Array.isArray(snapshot.cars)) {
      return { total: 0, arrived: 0, pending: 0, late: 0, empty: 0 };
    }

    return {
      total: snapshot.cars.length,
      arrived: snapshot.cars.filter((c) => c.arrived).length,
      pending: snapshot.cars.filter((c) => !c.arrived).length,
      late: snapshot.cars.filter((c) => c.late).length,
      empty: snapshot.cars.filter((c) => c.empty).length,
    };
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Shift History
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            aria-label="Close shift history"
          >
            <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="text-center py-8 text-slate-600 dark:text-slate-400">
              Loading shift history...
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={loadShiftHistory}
                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && shifts.length === 0 && (
            <div className="text-center py-8 text-slate-600 dark:text-slate-400">
              No shift history found.
            </div>
          )}

          {!loading && !error && shifts.length > 0 && (
            <div className="space-y-3">
              {shifts.map((shift) => {
                const snapshot = parseSnapshot(shift.snapshot);
                const stats = getSnapshotStats(snapshot);
                const isSelected = selectedShift?.id === shift.id;

                return (
                  <div
                    key={shift.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden hover:border-amber-500 dark:hover:border-amber-600 transition-colors"
                  >
                    <button
                      onClick={() => setSelectedShift(isSelected ? null : shift)}
                      className="w-full text-left"
                    >
                      {/* Shift Summary */}
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {shift.user_id}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {formatDate(shift.start_time)}
                            </span>
                          </div>
                          {shift.end_time && (
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-500">
                              {formatDuration(shift.start_time, shift.end_time)}
                            </span>
                          )}
                        </div>

                        {/* Snapshot Stats */}
                        {stats.total > 0 && (
                          <div className="flex gap-4 text-xs">
                            <span className="text-slate-600 dark:text-slate-400">
                              Total: <strong>{stats.total}</strong>
                            </span>
                            <span className="text-green-600 dark:text-green-400">
                              Arrived: <strong>{stats.arrived}</strong>
                            </span>
                            <span className="text-slate-600 dark:text-slate-400">
                              Pending: <strong>{stats.pending}</strong>
                            </span>
                            {stats.late > 0 && (
                              <span className="text-red-600 dark:text-red-400">
                                Late: <strong>{stats.late}</strong>
                              </span>
                            )}
                            {stats.empty > 0 && (
                              <span className="text-blue-600 dark:text-blue-400">
                                Empty: <strong>{stats.empty}</strong>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Start Notes Preview */}
                        {shift.start_notes && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-1">
                            {shift.start_notes}
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isSelected && (
                      <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                        {/* Times */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              Start:
                            </span>{' '}
                            <span className="text-slate-600 dark:text-slate-400">
                              {formatDate(shift.start_time)}
                            </span>
                          </div>
                          {shift.end_time && (
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                End:
                              </span>{' '}
                              <span className="text-slate-600 dark:text-slate-400">
                                {formatDate(shift.end_time)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Start Notes */}
                        {shift.start_notes && (
                          <div>
                            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1 text-sm">
                              Start Notes:
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 p-2 rounded">
                              {shift.start_notes}
                            </p>
                          </div>
                        )}

                        {/* End Notes */}
                        {shift.end_notes && (
                          <div>
                            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1 text-sm">
                              End Notes:
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 p-2 rounded">
                              {shift.end_notes}
                            </p>
                          </div>
                        )}

                        {/* Snapshot Car List */}
                        {snapshot && snapshot.cars && snapshot.cars.length > 0 && (
                          <div>
                            <p className="font-medium text-slate-700 dark:text-slate-300 mb-2 text-sm">
                              Fleet Snapshot ({snapshot.cars.length} cars)
                            </p>
                            <div className="max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-900 rounded p-2">
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                                {snapshot.cars.map((car) => (
                                  <div
                                    key={car.id}
                                    className={`p-2 rounded ${car.arrived
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                      : car.late
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                      }`}
                                  >
                                    <div className="font-medium">{car.id}</div>
                                    <div className="text-xs opacity-75">
                                      {car.location}
                                      {car.empty && ' • Empty'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
