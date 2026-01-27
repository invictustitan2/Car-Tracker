import { AlertTriangle, CheckCircle, History, MapPin, Truck } from 'lucide-react';
import { memo } from 'react';
import StatusChip from './components/StatusChip.jsx';

function CarCard({
  car,
  LOCATIONS,
  isManageMode,
  toggleStatus,
  updateLocation,
  removeCar,
  onViewHistory,
  compact = false,
}) {
  const getStatusChip = () => {
    if (car.empty) return <StatusChip label="Completed" variant="success" />;
    if (car.arrived) return <StatusChip label="On Site" variant="info" />;
    return <StatusChip label="Pending" variant="default" />;
  };

  const dataStatus = car.empty ? 'empty' : car.arrived ? 'arrived' : 'pending';
  const buttonBase = 'flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500 dark:focus-visible:ring-offset-slate-900';
  const secondaryButtonBase = 'flex items-center justify-center gap-2 py-2.5 min-h-[44px] rounded text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500 dark:focus-visible:ring-offset-slate-900';

  return (
    <div
      data-testid={`car-card-${car.id}`}
      data-status={dataStatus}
      className={`relative p-4 rounded-lg border shadow-sm transition-all bg-white dark:bg-slate-800 space-y-3 
        ${car.empty ? 'border-l-4 border-l-green-500 opacity-90' :
          car.arrived ? 'border-l-4 border-l-blue-500' :
            'border-l-4 border-l-slate-300 dark:border-l-slate-600'} 
        ${car.late && !car.empty ? 'ring-2 ring-red-500/20 dark:ring-red-900/50' : 'hover:shadow-md'} 
        ${compact ? 'text-sm' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">#{car.id}</span>
            {car.late && !car.empty && (
              <span className="flex items-center text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                <AlertTriangle size={12} className="mr-1" /> LATE
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <MapPin size={14} className="text-slate-600 dark:text-slate-300" />
            <div className="relative">
              <select
                value={car.location}
                onChange={(e) => updateLocation(car.id, e.target.value)}
                className="appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 pr-6 text-sm font-semibold text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                aria-label="Update location"
              >
                {LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500 dark:text-slate-300">
                <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {isManageMode ? (
          <button
            onClick={() => removeCar(car.id)}
            className="text-slate-500 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            aria-label={`Remove car ${car.id}`}
          >
            ✕
          </button>
        ) : (
          getStatusChip()
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => toggleStatus(car.id, 'arrived')}
          className={`${buttonBase} ${car.arrived
            ? 'bg-blue-600 text-white hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400'
            : 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'
            }`}
          aria-pressed={car.arrived}
        >
          <Truck size={16} />
          {car.arrived ? 'Arrived' : 'Mark Arrived'}
        </button>

        <button
          onClick={() => toggleStatus(car.id, 'empty')}
          disabled={!car.arrived}
          className={`${buttonBase} ${!car.arrived
            ? 'cursor-not-allowed border border-slate-300 bg-slate-200 text-slate-500 opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400'
            : car.empty
              ? 'bg-green-600 text-white hover:bg-green-500 dark:bg-green-500 dark:hover:bg-green-400'
              : 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'
            }`}
          aria-pressed={car.empty}
        >
          <CheckCircle size={16} />
          {car.empty ? 'Empty' : 'Mark Empty'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => toggleStatus(car.id, 'late')}
          className={`${secondaryButtonBase} ${car.late
            ? 'bg-red-600 text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400'
            : 'bg-slate-200 text-slate-800 hover:bg-red-100 hover:text-red-700 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'
            }`}
          aria-label={car.late ? 'Unmark as late' : 'Mark as late'}
        >
          <AlertTriangle size={14} />
          {car.late ? 'Late Flag' : 'Mark Late'}
        </button>

        {onViewHistory && (
          <button
            onClick={() => onViewHistory(car.id)}
            className={`${secondaryButtonBase} bg-slate-200 text-slate-800 hover:bg-blue-600 hover:text-white dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-blue-500`}
            aria-label="View history for this car"
          >
            <History size={14} />
            History
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(CarCard);
