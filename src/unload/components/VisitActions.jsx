/**
 * VisitActions Component
 * 
 * Action buttons for an active visit.
 */

import { useState } from 'react';

export default function VisitActions({ visit, onAction, isLoading }) {
  const [actionLoading, setActionLoading] = useState(null);

  const handleAction = async (action, extraData = {}) => {
    setActionLoading(action);
    try {
      await onAction(action, extraData);
    } finally {
      setActionLoading(null);
    }
  };

  if (!visit) return null;

  const canStart = visit.status === 'ARRIVED';
  const canProgress = visit.status === 'ARRIVED' || visit.status === 'IN_PROGRESS';
  const canFinish = visit.status === 'IN_PROGRESS';
  const canDepart = visit.status !== 'DEPARTED';

  return (
    <div className="space-y-3" data-testid="visit-actions">
      {/* Status change buttons */}
      <div className="flex flex-wrap gap-2">
        {canStart && (
          <button
            onClick={() => handleAction('START')}
            disabled={isLoading || actionLoading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="action-START"
          >
            {actionLoading === 'START' ? 'Starting...' : '▶ Start'}
          </button>
        )}
        
        {canFinish && (
          <button
            onClick={() => handleAction('FINISH')}
            disabled={isLoading || actionLoading}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="action-FINISH"
          >
            {actionLoading === 'FINISH' ? 'Finishing...' : '✓ Finish'}
          </button>
        )}
        
        {canDepart && (
          <button
            onClick={() => handleAction('DEPART')}
            disabled={isLoading || actionLoading}
            className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="action-DEPART"
          >
            {actionLoading === 'DEPART' ? 'Departing...' : '↗ Depart'}
          </button>
        )}
      </div>

      {/* Quick progress buttons */}
      {canProgress && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Quick Update (remaining: {visit.remainingPercent}%)
          </div>
          <div className="flex flex-wrap gap-2">
            {[-5, -10, -25].map((delta) => (
              <button
                key={delta}
                onClick={() => handleAction('PROGRESS_DELTA', { delta })}
                disabled={isLoading || actionLoading || visit.remainingPercent <= 0}
                className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-lg text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`action-delta-${delta}`}
              >
                {delta}%
              </button>
            ))}
            <button
              onClick={() => handleAction('PROGRESS_DELTA', { delta: -visit.remainingPercent })}
              disabled={isLoading || actionLoading || visit.remainingPercent <= 0}
              className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="action-delta-zero"
            >
              → 0%
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
