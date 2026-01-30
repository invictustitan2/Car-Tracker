/**
 * VisitDrawer Component
 * 
 * Slide-out drawer showing visit details and actions.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { unloadApi } from '../unloadApi';
import VisitActions from './VisitActions';

export default function VisitDrawer({ door, onClose, onRefresh, userId }) {
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const visit = door?.activeVisit;

  useEffect(() => {
    const fetchEvents = async () => {
      if (!visit?.id) return;
      setEventsLoading(true);
      try {
        const { events: data } = await unloadApi.getVisitEvents(visit.id);
        setEvents(data);
      } catch (error) {
        console.error('Failed to load events:', error);
      } finally {
        setEventsLoading(false);
      }
    };
    fetchEvents();
  }, [visit?.id]);

  const loadEvents = async () => {
    if (!visit?.id) return;
    setEventsLoading(true);
    try {
      const { events: data } = await unloadApi.getVisitEvents(visit.id);
      setEvents(data);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setEventsLoading(false);
    }
  };

  const handleAction = async (action, extraData = {}) => {
    if (!visit?.id) return;
    setActionLoading(true);
    try {
      await unloadApi.visitAction(visit.id, action, userId, extraData);
      await onRefresh();
      await loadEvents();
    } catch (error) {
      console.error('Action failed:', error);
      alert(`Action failed: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!door) return null;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" />
      
      {/* Drawer */}
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="visit-drawer"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Door {door.doorNumber}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          {visit && (
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Trailer: <span className="font-mono font-semibold">{visit.trailerNumber}</span>
              {visit.originCode && ` • ${visit.originCode}`}
            </div>
          )}
        </div>

        <div className="p-4 space-y-6">
          {visit ? (
            <>
              {/* Progress */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Progress</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {visit.remainingPercent}% remaining of {visit.initialPercent}%
                  </span>
                </div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${(visit.remainingPercent / visit.initialPercent) * 100}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div>
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Actions</h3>
                <VisitActions
                  visit={visit}
                  onAction={handleAction}
                  isLoading={actionLoading}
                />
              </div>

              {/* Event Timeline */}
              <div>
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Timeline</h3>
                {eventsLoading ? (
                  <div className="text-sm text-slate-500">Loading...</div>
                ) : events.length === 0 ? (
                  <div className="text-sm text-slate-500">No events yet</div>
                ) : (
                  <div className="space-y-2" data-testid="event-timeline">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 text-sm"
                      >
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium text-slate-700 dark:text-slate-300">
                            {event.eventType}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {event.actor} • {new Date(event.createdAt).toLocaleTimeString()}
                          </div>
                          {event.payload && (
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {JSON.stringify(event.payload)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <div className="text-lg mb-2">Door is {door.doorState}</div>
              <div className="text-sm">No active trailer at this door.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
