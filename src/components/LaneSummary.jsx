import { memo } from 'react';

function LaneSummary({ title, count, total, variant = 'default' }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colors = {
    default: 'bg-slate-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <div className="lane-summary flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" data-testid="lane-summary">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</span>
        <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
          <div
            className={`h-full rounded-full ${colors[variant] || colors.default}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-slate-900 dark:text-white">{count}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">/ {total}</span>
      </div>
    </div>
  );
}

export default memo(LaneSummary);
