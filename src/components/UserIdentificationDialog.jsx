import { User } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * UserIdentificationDialog Component
 * 
 * Prompts user to identify themselves on first launch
 * Stores userId in localStorage
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the dialog is open
 * @param {Function} props.onIdentify - Callback with userId when user identifies
 */
export default function UserIdentificationDialog({ isOpen, onIdentify }) {
  const [userId, setUserId] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Focus input when dialog opens
      setTimeout(() => {
        document.getElementById('userId-input')?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = userId.trim();
    if (trimmed) {
      onIdentify(trimmed);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <User size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Identify Yourself
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Enter your name or ID
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              htmlFor="userId-input"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Your Name or ID
            </label>
            <input
              id="userId-input"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g., John Smith or EMPID123"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              This helps track who made changes to package cars. You can change this later in settings.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!userId.trim()}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
