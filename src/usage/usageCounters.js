/**
 * Usage Counters Module
 * 
 * Lightweight tracking for development diagnostics.
 * Tracks user interactions to understand how the tool is used on the floor.
 * No external analytics - data stays local.
 */

/**
 * Default usage counters
 */
export const DEFAULT_COUNTERS = Object.freeze({
  // Filter interactions
  filterClicks: 0,
  locationClicks: 0,
  
  // Layout/view changes
  viewToggles: 0,
  
  // Status changes
  arrivedToggles: 0,
  lateToggles: 0,
  emptyToggles: 0,
  
  // Car management
  carsAdded: 0,
  carsRemoved: 0,
  carLocationChanges: 0,
  
  // CSV operations
  csvImports: 0,
  csvExports: 0,
  
  // Shift operations
  shiftsReset: 0,
  
  // Selection/focus (for understanding user flow)
  carSelections: 0,
});

/**
 * Usage event types - centralized list of all trackable events
 */
export const USAGE_EVENTS = {
  FILTER_CLICK: 'filterClicks',
  LOCATION_CLICK: 'locationClicks',
  VIEW_TOGGLE: 'viewToggles',
  ARRIVED_TOGGLE: 'arrivedToggles',
  LATE_TOGGLE: 'lateToggles',
  EMPTY_TOGGLE: 'emptyToggles',
  CAR_ADDED: 'carsAdded',
  CAR_REMOVED: 'carsRemoved',
  CAR_LOCATION_CHANGE: 'carLocationChanges',
  CSV_IMPORT: 'csvImports',
  CSV_EXPORT: 'csvExports',
  SHIFT_RESET: 'shiftsReset',
  CAR_SELECTION: 'carSelections',
};

/**
 * Create a usage tracker instance
 * 
 * @param {Object} initialCounters - Initial counter values (defaults to DEFAULT_COUNTERS)
 * @returns {Object} Tracker instance with track and getCounters methods
 */
export function createUsageTracker(initialCounters = DEFAULT_COUNTERS) {
  let counters = { ...initialCounters };
  
  return {
    /**
     * Track a usage event by incrementing its counter
     * @param {string} event - Event type from USAGE_EVENTS
     */
    track(event) {
      if (event in counters) {
        counters = {
          ...counters,
          [event]: counters[event] + 1,
        };
      } else {
        console.warn(`Unknown usage event: ${event}`);
      }
      return counters;
    },
    
    /**
     * Get current counter values
     * @returns {Object} Current counters
     */
    getCounters() {
      return { ...counters };
    },
    
    /**
     * Reset all counters to zero
     */
    reset() {
      counters = Object.keys(counters).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {});
      return counters;
    },
    
    /**
     * Set counters to specific values (useful for loading persisted state)
     * @param {Object} newCounters - New counter values
     */
    setCounters(newCounters) {
      counters = { ...DEFAULT_COUNTERS, ...newCounters };
      return counters;
    },
  };
}

/**
 * Calculate derived statistics from usage counters
 * 
 * @param {Object} counters - Usage counter object
 * @param {Array} cars - Current car list for contextual stats
 * @returns {Object} Derived statistics
 */
export function calculateDerivedStats(counters, cars = []) {
  const totalStatusToggles = 
    counters.arrivedToggles + 
    counters.lateToggles + 
    counters.emptyToggles;
  
  const totalFilterClicks = 
    counters.filterClicks + 
    counters.locationClicks;
  
  const totalCarChanges = 
    counters.carsAdded + 
    counters.carsRemoved + 
    counters.carLocationChanges;
  
  const totalActions = 
    totalStatusToggles + 
    totalFilterClicks + 
    counters.viewToggles + 
    totalCarChanges +
    counters.csvImports +
    counters.csvExports +
    counters.shiftsReset;
  
  // Calculate percentages of car statuses if cars provided
  let carStats = null;
  if (cars.length > 0) {
    const arrived = cars.filter(c => c.arrived).length;
    const late = cars.filter(c => c.late).length;
    const empty = cars.filter(c => c.empty).length;
    
    carStats = {
      arrivedPercent: ((arrived / cars.length) * 100).toFixed(1),
      latePercent: ((late / cars.length) * 100).toFixed(1),
      emptyPercent: ((empty / cars.length) * 100).toFixed(1),
    };
  }
  
  return {
    totalActions,
    totalStatusToggles,
    totalFilterClicks,
    totalCarChanges,
    carStats,
    mostUsedFeature: getMostUsedFeature(counters),
  };
}

/**
 * Determine the most frequently used feature
 * 
 * @param {Object} counters - Usage counter object
 * @returns {string} Name of most used feature
 */
function getMostUsedFeature(counters) {
  const features = {
    'Status Filters': counters.filterClicks,
    'Location Filters': counters.locationClicks,
    'View Toggle': counters.viewToggles,
    'Arrived Status': counters.arrivedToggles,
    'Late Status': counters.lateToggles,
    'Empty Status': counters.emptyToggles,
    'Add Cars': counters.carsAdded,
    'Remove Cars': counters.carsRemoved,
    'Move Cars': counters.carLocationChanges,
    'CSV Import': counters.csvImports,
    'CSV Export': counters.csvExports,
  };
  
  let maxFeature = 'None';
  let maxCount = 0;
  
  for (const [feature, count] of Object.entries(features)) {
    if (count > maxCount) {
      maxCount = count;
      maxFeature = feature;
    }
  }
  
  return maxCount > 0 ? `${maxFeature} (${maxCount})` : 'No usage yet';
}
