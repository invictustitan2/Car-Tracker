/**
 * VerifyDoorsWizard Component
 * 
 * Modal wizard for start-of-night door verification.
 */

import { useState } from 'react';
import { X } from 'lucide-react';

const DOORS = Array.from({ length: 15 }, (_, i) => i + 9);

export default function VerifyDoorsWizard({ isOpen, onClose, onSubmit, isLoading }) {
  const [doorStates, setDoorStates] = useState(() => 
    DOORS.reduce((acc, d) => ({ ...acc, [d]: { doorState: 'EMPTY', trailerNumber: '', initialPercent: '' } }), {})
  );
  const [currentDoor, setCurrentDoor] = useState(9);

  if (!isOpen) return null;

  const current = doorStates[currentDoor];
  const isOccupied = current.doorState === 'OCCUPIED';

  const updateCurrent = (updates) => {
    setDoorStates(prev => ({
      ...prev,
      [currentDoor]: { ...prev[currentDoor], ...updates },
    }));
  };

  const goNext = () => {
    if (currentDoor < 23) setCurrentDoor(currentDoor + 1);
  };

  const goPrev = () => {
    if (currentDoor > 9) setCurrentDoor(currentDoor - 1);
  };

  const handleSubmit = () => {
    const doors = DOORS.map(doorNumber => {
      const d = doorStates[doorNumber];
      const entry = { doorNumber, doorState: d.doorState };
      if (d.doorState === 'OCCUPIED') {
        entry.trailerNumber = d.trailerNumber;
        entry.initialPercent = parseInt(d.initialPercent, 10) || 100;
        if (d.originCode) entry.originCode = d.originCode;
      }
      return entry;
    });
    onSubmit(doors);
  };

  const progress = ((currentDoor - 9 + 1) / 15) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Verify Doors - Start of Shift
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 mb-1">
            <span>Door {currentDoor}</span>
            <span>{currentDoor - 9 + 1} / 15</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current Door Form */}
        <div className="p-4 space-y-4">
          <div className="text-center text-3xl font-bold text-slate-900 dark:text-slate-100">
            DOOR {currentDoor}
          </div>

          {/* State Selection */}
          <div className="flex gap-2">
            {['EMPTY', 'PENDING', 'OCCUPIED'].map((state) => (
              <button
                key={state}
                onClick={() => updateCurrent({ doorState: state })}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                  current.doorState === state
                    ? state === 'EMPTY' ? 'bg-slate-600 text-white' :
                      state === 'PENDING' ? 'bg-amber-500 text-white' :
                      'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                data-testid={`state-${state.toLowerCase()}`}
              >
                {state}
              </button>
            ))}
          </div>

          {/* Occupied Fields */}
          {isOccupied && (
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Trailer Number *
                </label>
                <input
                  type="text"
                  value={current.trailerNumber}
                  onChange={(e) => updateCurrent({ trailerNumber: e.target.value.toUpperCase() })}
                  placeholder="T4521"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  data-testid="input-trailer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Initial % Remaining *
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={current.initialPercent}
                  onChange={(e) => updateCurrent({ initialPercent: e.target.value })}
                  placeholder="75"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  data-testid="input-percent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Origin Code (optional)
                </label>
                <input
                  type="text"
                  value={current.originCode || ''}
                  onChange={(e) => updateCurrent({ originCode: e.target.value.toUpperCase() })}
                  placeholder="CACH"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  data-testid="input-origin"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={goPrev}
            disabled={currentDoor === 9 || isLoading}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          
          {currentDoor < 23 ? (
            <button
              onClick={goNext}
              disabled={isLoading}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700"
              data-testid="next-btn"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              data-testid="complete-verify-btn"
            >
              {isLoading ? 'Saving...' : '✓ Complete Verification'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
