import { Clock, History, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { auditApi } from '../api/apiClient.js';

/**
 * AuditLogDrawer Component
 * 
 * Displays change history for a specific car or all cars
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the drawer is open
 * @param {Function} props.onClose - Callback to close the drawer
 * @param {string} props.carId - Car ID to show history for (null for all)
 */
export default function AuditLogDrawer({ isOpen, onClose, carId = null }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchLogs = async () => {
      setLoading(true);
      setError(null);

      try {
        const { auditLogs } = await auditApi.getLogs(carId, 50);
        setLogs(auditLogs || []);
      } catch (err) {
        setError(err.message);
        console.error('Failed to load audit logs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [isOpen, carId]);

  if (!isOpen) return null;

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
        aria-labelledby="audit-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={20} />
            <h2 id="audit-title" className="text-lg font-semibold">
              {carId ? `Car ${carId} - Audit Log` : 'Audit Log - All Changes'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-md transition-colors"
            aria-label="Close audit log"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              Loading history...
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200 text-sm">
              Failed to load audit logs: {error}
            </div>
          )}

          {!loading && !error && logs.length === 0 && (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              No changes recorded yet.
            </div>
          )}

          {!loading && !error && logs.length > 0 && (
            <div className="space-y-3">
              {logs.map((log) => (
                <AuditLogEntry key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Single audit log entry
 */
function AuditLogEntry({ log }) {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

    return date.toLocaleString();
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'created':
        return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'updated':
        return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'deleted':
        return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-slate-700 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20';
    }
  };

  const getFieldLabel = (field) => {
    const labels = {
      location: 'Location',
      arrived: 'Arrived Status',
      late: 'Late Status',
      empty: 'Empty Status',
      notes: 'Notes',
    };
    return labels[field] || field;
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${getActionColor(log.action)}`}>
            {log.action}
          </span>
          {log.car_id && (
            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
              #{log.car_id}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Clock size={12} />
          <time>{formatDate(log.changed_at)}</time>
        </div>
      </div>

      {log.field_changed && (
        <div className="text-sm mb-2">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {getFieldLabel(log.field_changed)}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <code className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-xs text-slate-600 dark:text-slate-400">
              {log.old_value || '(empty)'}
            </code>
            <span className="text-slate-400">→</span>
            <code className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-xs text-slate-600 dark:text-slate-400">
              {log.new_value || '(empty)'}
            </code>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        <User size={12} />
        <span>{log.changed_by}</span>
      </div>
    </div>
  );
}
