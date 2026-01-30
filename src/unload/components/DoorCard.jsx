/**
 * DoorCard Component
 * 
 * Displays a single door's state and active visit info.
 */

import { memo } from 'react';

const stateColors = {
  EMPTY: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600',
  PENDING: 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600',
  OCCUPIED: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600',
};

const statusLabels = {
  ARRIVED: 'Arrived',
  IN_PROGRESS: 'Unloading',
  COMPLETED: 'Done',
  DEPARTED: 'Departed',
};

const statusColors = {
  ARRIVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DEPARTED: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

function PercentBar({ remaining, initial }) {
  const pct = initial > 0 ? (remaining / initial) * 100 : 0;
  const color = pct > 50 ? 'bg-red-500' : pct > 20 ? 'bg-amber-500' : 'bg-emerald-500';
  
  return (
    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function DoorCard({ door, onSelect }) {
  const { doorNumber, doorState, activeVisit } = door;
  
  return (
    <button
      onClick={() => onSelect(door)}
      className={`
        relative p-4 rounded-xl border-2 transition-all text-left w-full
        ${stateColors[doorState]}
        hover:scale-[1.02] active:scale-[0.98]
        focus:outline-none focus:ring-2 focus:ring-amber-500
      `}
      data-testid={`door-card-${doorNumber}`}
      aria-label={`Door ${doorNumber}, ${doorState}${activeVisit ? `, trailer ${activeVisit.trailerNumber}` : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {doorNumber}
        </span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
          doorState === 'EMPTY' ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400' :
          doorState === 'PENDING' ? 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200' :
          'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200'
        }`}>
          {doorState}
        </span>
      </div>
      
      {activeVisit && (
        <>
          <div className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">
            {activeVisit.trailerNumber}
          </div>
          {activeVisit.originCode && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {activeVisit.originCode}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${statusColors[activeVisit.status]}`}>
              {statusLabels[activeVisit.status]}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {activeVisit.remainingPercent}% left
            </span>
          </div>
          <PercentBar remaining={activeVisit.remainingPercent} initial={activeVisit.initialPercent} />
        </>
      )}
    </button>
  );
}

export default memo(DoorCard);
