import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_COUNTERS,
  USAGE_EVENTS,
  calculateDerivedStats,
  createUsageTracker
} from './usageCounters.js';

describe('usageCounters', () => {
  describe('DEFAULT_COUNTERS', () => {
    it('should have all counter fields initialized to zero', () => {
      expect(DEFAULT_COUNTERS.filterClicks).toBe(0);
      expect(DEFAULT_COUNTERS.locationClicks).toBe(0);
      expect(DEFAULT_COUNTERS.viewToggles).toBe(0);
      expect(DEFAULT_COUNTERS.arrivedToggles).toBe(0);
      expect(DEFAULT_COUNTERS.lateToggles).toBe(0);
      expect(DEFAULT_COUNTERS.emptyToggles).toBe(0);
      expect(DEFAULT_COUNTERS.carsAdded).toBe(0);
      expect(DEFAULT_COUNTERS.carsRemoved).toBe(0);
      expect(DEFAULT_COUNTERS.carLocationChanges).toBe(0);
      expect(DEFAULT_COUNTERS.csvImports).toBe(0);
      expect(DEFAULT_COUNTERS.csvExports).toBe(0);
      expect(DEFAULT_COUNTERS.shiftsReset).toBe(0);
      expect(DEFAULT_COUNTERS.carSelections).toBe(0);
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(DEFAULT_COUNTERS)).toBe(true);
    });
  });

  describe('USAGE_EVENTS', () => {
    it('should map event names to counter keys', () => {
      expect(USAGE_EVENTS.FILTER_CLICK).toBe('filterClicks');
      expect(USAGE_EVENTS.LOCATION_CLICK).toBe('locationClicks');
      expect(USAGE_EVENTS.VIEW_TOGGLE).toBe('viewToggles');
      expect(USAGE_EVENTS.ARRIVED_TOGGLE).toBe('arrivedToggles');
      expect(USAGE_EVENTS.LATE_TOGGLE).toBe('lateToggles');
      expect(USAGE_EVENTS.EMPTY_TOGGLE).toBe('emptyToggles');
      expect(USAGE_EVENTS.CAR_ADDED).toBe('carsAdded');
      expect(USAGE_EVENTS.CAR_REMOVED).toBe('carsRemoved');
      expect(USAGE_EVENTS.CAR_LOCATION_CHANGE).toBe('carLocationChanges');
      expect(USAGE_EVENTS.CSV_IMPORT).toBe('csvImports');
      expect(USAGE_EVENTS.CSV_EXPORT).toBe('csvExports');
      expect(USAGE_EVENTS.SHIFT_RESET).toBe('shiftsReset');
      expect(USAGE_EVENTS.CAR_SELECTION).toBe('carSelections');
    });
  });

  describe('createUsageTracker', () => {
    it('should create a tracker with default counters', () => {
      const tracker = createUsageTracker();
      const counters = tracker.getCounters();

      expect(counters).toEqual(DEFAULT_COUNTERS);
    });

    it('should create a tracker with custom initial counters', () => {
      const initialCounters = {
        ...DEFAULT_COUNTERS,
        filterClicks: 5,
        viewToggles: 3,
      };

      const tracker = createUsageTracker(initialCounters);
      const counters = tracker.getCounters();

      expect(counters.filterClicks).toBe(5);
      expect(counters.viewToggles).toBe(3);
    });

    it('should increment counter when tracking an event', () => {
      const tracker = createUsageTracker();

      tracker.track(USAGE_EVENTS.FILTER_CLICK);
      const counters = tracker.getCounters();

      expect(counters.filterClicks).toBe(1);
    });

    it('should increment counter multiple times', () => {
      const tracker = createUsageTracker();

      tracker.track(USAGE_EVENTS.FILTER_CLICK);
      tracker.track(USAGE_EVENTS.FILTER_CLICK);
      tracker.track(USAGE_EVENTS.FILTER_CLICK);

      const counters = tracker.getCounters();
      expect(counters.filterClicks).toBe(3);
    });

    it('should track different events independently', () => {
      const tracker = createUsageTracker();

      tracker.track(USAGE_EVENTS.FILTER_CLICK);
      tracker.track(USAGE_EVENTS.FILTER_CLICK);
      tracker.track(USAGE_EVENTS.VIEW_TOGGLE);
      tracker.track(USAGE_EVENTS.CAR_ADDED);

      const counters = tracker.getCounters();
      expect(counters.filterClicks).toBe(2);
      expect(counters.viewToggles).toBe(1);
      expect(counters.carsAdded).toBe(1);
      expect(counters.locationClicks).toBe(0);
    });

    it('should warn on unknown event but not crash', () => {
      const tracker = createUsageTracker();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      tracker.track('unknownEvent');

      expect(consoleWarnSpy).toHaveBeenCalledWith('Unknown usage event: unknownEvent');
      consoleWarnSpy.mockRestore();
    });

    it('should reset all counters to zero', () => {
      const tracker = createUsageTracker();

      tracker.track(USAGE_EVENTS.FILTER_CLICK);
      tracker.track(USAGE_EVENTS.VIEW_TOGGLE);
      tracker.track(USAGE_EVENTS.CAR_ADDED);

      tracker.reset();
      const counters = tracker.getCounters();

      expect(counters.filterClicks).toBe(0);
      expect(counters.viewToggles).toBe(0);
      expect(counters.carsAdded).toBe(0);
    });

    it('should set counters to specific values', () => {
      const tracker = createUsageTracker();

      tracker.setCounters({
        filterClicks: 10,
        viewToggles: 5,
        carsAdded: 3,
      });

      const counters = tracker.getCounters();
      expect(counters.filterClicks).toBe(10);
      expect(counters.viewToggles).toBe(5);
      expect(counters.carsAdded).toBe(3);
      // Should preserve defaults for unspecified counters
      expect(counters.locationClicks).toBe(0);
    });

    it('should return new counter object (immutability)', () => {
      const tracker = createUsageTracker();

      const counters1 = tracker.getCounters();
      tracker.track(USAGE_EVENTS.FILTER_CLICK);
      const counters2 = tracker.getCounters();

      expect(counters1).not.toBe(counters2);
      expect(counters1.filterClicks).toBe(0);
      expect(counters2.filterClicks).toBe(1);
    });
  });

  describe('calculateDerivedStats', () => {
    it('should calculate total actions across all counters', () => {
      const counters = {
        ...DEFAULT_COUNTERS,
        filterClicks: 5,
        locationClicks: 3,
        viewToggles: 2,
        arrivedToggles: 4,
        carsAdded: 1,
      };

      const stats = calculateDerivedStats(counters);

      // 5 + 3 + 2 + 4 + 1 = 15
      expect(stats.totalActions).toBe(15);
    });

    it('should calculate total status toggles', () => {
      const counters = {
        ...DEFAULT_COUNTERS,
        arrivedToggles: 5,
        lateToggles: 3,
        emptyToggles: 2,
      };

      const stats = calculateDerivedStats(counters);

      expect(stats.totalStatusToggles).toBe(10);
    });

    it('should calculate total filter clicks', () => {
      const counters = {
        ...DEFAULT_COUNTERS,
        filterClicks: 7,
        locationClicks: 4,
      };

      const stats = calculateDerivedStats(counters);

      expect(stats.totalFilterClicks).toBe(11);
    });

    it('should calculate total car changes', () => {
      const counters = {
        ...DEFAULT_COUNTERS,
        carsAdded: 3,
        carsRemoved: 2,
        carLocationChanges: 5,
      };

      const stats = calculateDerivedStats(counters);

      expect(stats.totalCarChanges).toBe(10);
    });

    it('should identify most used feature', () => {
      const counters = {
        ...DEFAULT_COUNTERS,
        filterClicks: 5,
        locationClicks: 10,
        viewToggles: 2,
      };

      const stats = calculateDerivedStats(counters);

      expect(stats.mostUsedFeature).toBe('Location Filters (10)');
    });

    it('should return "No usage yet" when all counters are zero', () => {
      const stats = calculateDerivedStats(DEFAULT_COUNTERS);

      expect(stats.mostUsedFeature).toBe('No usage yet');
    });

    it('should calculate car stats when cars provided', () => {
      const cars = [
        { id: '1', arrived: true, late: false, empty: false },
        { id: '2', arrived: true, late: true, empty: false },
        { id: '3', arrived: true, late: false, empty: true },
        { id: '4', arrived: false, late: false, empty: false },
      ];

      const stats = calculateDerivedStats(DEFAULT_COUNTERS, cars);

      expect(stats.carStats).toBeDefined();
      expect(stats.carStats.arrivedPercent).toBe('75.0'); // 3/4
      expect(stats.carStats.latePercent).toBe('25.0'); // 1/4
      expect(stats.carStats.emptyPercent).toBe('25.0'); // 1/4
    });

    it('should return null car stats when no cars provided', () => {
      const stats = calculateDerivedStats(DEFAULT_COUNTERS);

      expect(stats.carStats).toBeNull();
    });

    it('should return null car stats when empty car array provided', () => {
      const stats = calculateDerivedStats(DEFAULT_COUNTERS, []);

      expect(stats.carStats).toBeNull();
    });

    it('should handle 100% car stats correctly', () => {
      const cars = [
        { id: '1', arrived: true, late: true, empty: true },
        { id: '2', arrived: true, late: true, empty: true },
      ];

      const stats = calculateDerivedStats(DEFAULT_COUNTERS, cars);

      expect(stats.carStats.arrivedPercent).toBe('100.0');
      expect(stats.carStats.latePercent).toBe('100.0');
      expect(stats.carStats.emptyPercent).toBe('100.0');
    });

    it('should handle 0% car stats correctly', () => {
      const cars = [
        { id: '1', arrived: false, late: false, empty: false },
        { id: '2', arrived: false, late: false, empty: false },
      ];

      const stats = calculateDerivedStats(DEFAULT_COUNTERS, cars);

      expect(stats.carStats.arrivedPercent).toBe('0.0');
      expect(stats.carStats.latePercent).toBe('0.0');
      expect(stats.carStats.emptyPercent).toBe('0.0');
    });
  });
});
