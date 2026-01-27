import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAR_SCHEMA_VERSION, DEFAULT_USAGE } from '../model/packageCarSchema.js';
import { clearAllData, loadState, migrateState, saveState, STORAGE_KEY } from './trackerStorage.js';

describe('trackerStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('STORAGE_KEY', () => {
    it('should be defined', () => {
      expect(STORAGE_KEY).toBe('ups-tracker-data');
    });
  });

  describe('migrateState', () => {
    it('should return default state when passed null', () => {
      const state = migrateState(null);

      expect(state).toHaveProperty('trackerVersion', CAR_SCHEMA_VERSION);
      expect(state).toHaveProperty('cars');
      expect(state).toHaveProperty('usage');
      expect(state).toHaveProperty('currentShift', null);
      expect(Array.isArray(state.cars)).toBe(true);
      // Server-First: Default state should be empty, waiting for API fetch
      expect(state.cars.length).toBe(0);
      expect(state.usage).toEqual(DEFAULT_USAGE);
    });

    it('should return default state when passed undefined', () => {
      const state = migrateState(undefined);

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      // Server-First: Default state should be empty
      expect(state.cars.length).toBe(0);
      expect(state.currentShift).toBeNull();
    });

    it('should migrate an array of cars (v0 format)', () => {
      const oldState = [
        { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
        { id: '456', location: '100', arrived: true, late: false, empty: false },
      ];
      oldState.currentShift = { startedAt: '2025-01-01T00:00:00.000Z' };

      const state = migrateState(oldState);

      expect(state.currentShift).toEqual(oldState.currentShift);
      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars).toHaveLength(2);
      expect(state.cars[0].id).toBe('123');
      expect(state.cars[1].id).toBe('456');
      expect(state.usage).toEqual(DEFAULT_USAGE);
    });

    it('should migrate v1 format with cars property', () => {
      const oldState = {
        version: 1,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
        ],
      };

      const state = migrateState(oldState);

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars).toHaveLength(1);
      expect(state.cars[0].id).toBe('123');
    });

    it('should preserve v2 format with usage stats', () => {
      const oldState = {
        trackerVersion: 2,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
        ],
        usage: {
          filterClicks: 5,
          locationClicks: 10,
          viewToggles: 2,
        },
      };

      const state = migrateState(oldState);

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars).toHaveLength(1);
      expect(state.usage).toEqual({
        filterClicks: 5,
        locationClicks: 10,
        viewToggles: 2,
        arrivedToggles: 0,
        lateToggles: 0,
        emptyToggles: 0,
        carsAdded: 0,
        carsRemoved: 0,
        carLocationChanges: 0,
        csvImports: 0,
        csvExports: 0,
        shiftsReset: 0,
        carSelections: 0,
      });
    });

    it('should filter out cars without id', () => {
      const oldState = {
        trackerVersion: 2,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
          { location: 'Yard', arrived: false, late: false, empty: false }, // no id
          { id: '456', location: '100', arrived: true, late: false, empty: false },
        ],
      };

      const state = migrateState(oldState);

      expect(state.cars).toHaveLength(2);
      expect(state.cars[0].id).toBe('123');
      expect(state.cars[1].id).toBe('456');
    });

    it('should skip invalid cars during migration', () => {
      const oldState = {
        trackerVersion: 2,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
          null,
          { id: '456', location: '100', arrived: true, late: false, empty: false },
        ],
      };

      const state = migrateState(oldState);

      expect(state.cars).toHaveLength(2);
      expect(state.cars[0].id).toBe('123');
      expect(state.cars[1].id).toBe('456');
    });

    it('should normalize car fields during migration', () => {
      const oldState = {
        trackerVersion: 2,
        cars: [
          { id: '  123  ', location: '  Yard  ', arrived: 1, late: 0, empty: 'yes' },
        ],
      };

      const state = migrateState(oldState);

      expect(state.cars[0]).toEqual({
        id: '123',
        location: 'Yard',
        arrived: true,
        late: false,
        empty: true,
      });
    });

    it('should allow empty fleet when cars array is explicitly empty', () => {
      const oldState = {
        trackerVersion: 2,
        cars: [],
      };

      const state = migrateState(oldState);

      expect(state.cars).toEqual([]);
    });

    it('should handle object without cars property', () => {
      const oldState = {
        trackerVersion: 1,
        someOtherProperty: 'value',
      };

      const state = migrateState(oldState);

      expect(state.cars.length).toBeGreaterThan(0);
      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
    });

    it('should preserve partial usage stats and fill defaults', () => {
      const oldState = {
        trackerVersion: 2,
        cars: [{ id: '123', location: 'Yard', arrived: false, late: false, empty: false }],
        usage: {
          filterClicks: 5,
        },
      };

      const state = migrateState(oldState);

      expect(state.usage).toEqual({
        filterClicks: 5,
        locationClicks: 0,
        viewToggles: 0,
        arrivedToggles: 0,
        lateToggles: 0,
        emptyToggles: 0,
        carsAdded: 0,
        carsRemoved: 0,
        carLocationChanges: 0,
        csvImports: 0,
        csvExports: 0,
        shiftsReset: 0,
        carSelections: 0,
      });
    });
  });

  describe('loadState', () => {
    it('should load and parse valid state from localStorage', () => {
      const mockState = {
        trackerVersion: 2,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
        ],
        usage: DEFAULT_USAGE,
        currentShift: null,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockState));

      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars).toHaveLength(1);
      expect(state.cars[0].id).toBe('123');
      expect(state.currentShift).toBeNull();
    });

    it('should return default state when localStorage is empty', () => {
      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars.length).toBe(0);
      expect(state.usage).toEqual(DEFAULT_USAGE);
      expect(state.currentShift).toBeNull();
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorage.setItem(STORAGE_KEY, '{invalid json}');

      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars.length).toBe(0);
      expect(state.usage).toEqual(DEFAULT_USAGE);
      expect(state.currentShift).toBeNull();
    });

    it('should handle non-JSON string gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not json at all');

      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars.length).toBe(0);
      expect(state.currentShift).toBeNull();
    });

    it('should handle empty string in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, '');

      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars.length).toBe(0);
      expect(state.currentShift).toBeNull();
    });

    it('should migrate old v1 format from localStorage', () => {
      const oldState = {
        version: 1,
        cars: [
          { id: '999', location: 'Shop', arrived: true, late: false, empty: true },
        ],
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(oldState));

      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars).toHaveLength(1);
      expect(state.cars[0].id).toBe('999');
      expect(state.cars[0].empty).toBe(true);
      expect(state.currentShift).toBeNull();
    });

    it('should migrate array format from localStorage', () => {
      const oldState = [
        { id: '111', location: 'Yard', arrived: false, late: false, empty: false },
        { id: '222', location: '200', arrived: true, late: false, empty: false },
      ];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(oldState));

      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars).toHaveLength(2);
      expect(state.currentShift).toBeNull();
    });

    it('should load persisted currentShift data when present', () => {
      const stored = {
        trackerVersion: CAR_SCHEMA_VERSION,
        cars: [
          { id: '111', location: 'Yard', arrived: false, late: false, empty: false },
        ],
        usage: DEFAULT_USAGE,
        currentShift: { id: 'shift-123', startedAt: '2025-01-01T00:00:00.000Z' },
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      const state = loadState();

      expect(state.currentShift).toEqual(stored.currentShift);
    });
  });

  describe('saveState', () => {
    it('should save state to localStorage', () => {
      const state = {
        trackerVersion: 2,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
        ],
        usage: DEFAULT_USAGE,
      };

      const result = saveState(state);

      expect(result).toBe(true);

      const saved = localStorage.getItem(STORAGE_KEY);
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved);
      expect(parsed.trackerVersion).toBe(2);
      expect(parsed.cars).toHaveLength(1);
      expect(parsed.cars[0].id).toBe('123');
    });

    it('should add trackerVersion if missing', () => {
      const state = {
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
        ],
        usage: DEFAULT_USAGE,
      };

      saveState(state);

      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(saved);

      expect(parsed.trackerVersion).toBe(CAR_SCHEMA_VERSION);
    });

    it('should handle missing usage field', () => {
      const state = {
        trackerVersion: 2,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
        ],
      };

      saveState(state);

      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(saved);

      expect(parsed.usage).toEqual(DEFAULT_USAGE);
    });

    it('should handle missing cars field', () => {
      const state = {
        trackerVersion: 2,
        usage: DEFAULT_USAGE,
      };

      saveState(state);

      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(saved);

      expect(parsed.cars).toEqual([]);
    });

    it('should persist currentShift information when provided', () => {
      const state = {
        trackerVersion: 2,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
        ],
        usage: DEFAULT_USAGE,
        currentShift: { id: 'shift-456', startedAt: '2025-01-01T00:00:00.000Z' },
      };

      saveState(state);

      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(saved);

      expect(parsed.currentShift).toEqual(state.currentShift);
    });

    it('should return false for null state', () => {
      const result = saveState(null);
      expect(result).toBe(false);
    });

    it('should return false for undefined state', () => {
      const result = saveState(undefined);
      expect(result).toBe(false);
    });

    it('should return false for non-object state', () => {
      const result = saveState('string');
      expect(result).toBe(false);
    });

    it('should save state with usage stats', () => {
      const state = {
        trackerVersion: 2,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
        ],
        usage: {
          filterClicks: 10,
          locationClicks: 20,
          viewToggles: 5,
        },
      };

      saveState(state);

      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(saved);

      expect(parsed.usage).toEqual({
        filterClicks: 10,
        locationClicks: 20,
        viewToggles: 5,
      });
    });

    it('should save empty cars array', () => {
      const state = {
        trackerVersion: 2,
        cars: [],
        usage: DEFAULT_USAGE,
      };

      saveState(state);

      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(saved);

      expect(parsed.cars).toEqual([]);
    });
  });

  describe('loadState and saveState integration', () => {
    it('should roundtrip state correctly', () => {
      const originalState = {
        trackerVersion: 2,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
          { id: '456', location: '100', arrived: true, late: true, empty: false },
        ],
        usage: {
          filterClicks: 15,
          locationClicks: 25,
          viewToggles: 3,
        },
        currentShift: { id: 'shift-789', startedAt: '2025-01-01T05:00:00.000Z' },
      };

      saveState(originalState);
      const loadedState = loadState();

      expect(loadedState.trackerVersion).toBe(originalState.trackerVersion);
      expect(loadedState.cars).toEqual(originalState.cars);
      // Usage stats will be filled with defaults for missing fields
      expect(loadedState.usage.filterClicks).toBe(15);
      expect(loadedState.usage.locationClicks).toBe(25);
      expect(loadedState.usage.viewToggles).toBe(3);
      expect(loadedState.usage.arrivedToggles).toBe(0);
      expect(loadedState.usage.lateToggles).toBe(0);
      expect(loadedState.currentShift).toEqual(originalState.currentShift);
    });
  });

  describe('clearAllData', () => {
    it('should remove tracker data from localStorage', () => {
      const state = {
        trackerVersion: 2,
        cars: [{ id: '123', location: 'Yard', arrived: false, late: false, empty: false }],
        usage: DEFAULT_USAGE,
      };

      saveState(state);
      expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();

      const result = clearAllData();

      expect(result).toBe(true);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should return true even if data does not exist', () => {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

      const result = clearAllData();

      expect(result).toBe(true);
    });

    it('should clear data and allow loading defaults', () => {
      const state = {
        trackerVersion: 2,
        cars: [{ id: '999', location: 'Shop', arrived: true, late: false, empty: true }],
        usage: DEFAULT_USAGE,
      };

      saveState(state);
      clearAllData();

      const loadedState = loadState();

      // Should return default state after clear
      expect(loadedState.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(loadedState.cars.length).toBe(0); // Should be default fleet (empty now)
      expect(loadedState.usage).toEqual(DEFAULT_USAGE);
      expect(loadedState.currentShift).toBeNull();
    });
  });

  describe('corrupted data recovery', () => {
    it('should recover from invalid JSON and clear the corrupted entry', () => {
      localStorage.setItem(STORAGE_KEY, '{invalid json}');

      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars.length).toBe(0);
      expect(state.usage).toEqual(DEFAULT_USAGE);
      expect(state.currentShift).toBeNull();

      // Should have cleared the corrupted data
      const storageValue = localStorage.getItem(STORAGE_KEY);
      expect(storageValue).toBeNull();
    });

    it('should recover from non-object JSON data', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify('string data'));

      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars.length).toBe(0);
      expect(state.currentShift).toBeNull();

      // Should have cleared the invalid data
      const storageValue = localStorage.getItem(STORAGE_KEY);
      expect(storageValue).toBeNull();
    });

    it('should recover from number JSON data', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(12345));

      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars.length).toBe(0);
    });

    it('should recover from boolean JSON data', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(true));

      const state = loadState();

      expect(state.trackerVersion).toBe(CAR_SCHEMA_VERSION);
      expect(state.cars.length).toBe(0);
    });

    it('should recover from array with all invalid cars', () => {
      const badState = [
        { location: 'Yard' }, // missing id
        { id: '', location: 'Yard' }, // empty id
        null,
        undefined,
      ];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(badState));

      const state = loadState();

      // Should fall back to default fleet since no valid cars
      expect(state.cars.length).toBeGreaterThan(0);
      expect(state.cars[0]).toHaveProperty('id');
      expect(state.cars[0].id).toBeTruthy();
    });

    it('should recover from object with corrupted cars array', () => {
      const badState = {
        trackerVersion: 2,
        cars: [
          { id: '123', location: 'Yard', arrived: false, late: false, empty: false },
          null,
          { id: '', location: 'Shop' }, // invalid id
          { location: 'Yard' }, // missing id
        ],
        usage: DEFAULT_USAGE,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(badState));

      const state = loadState();

      // Should only have the one valid car
      expect(state.cars).toHaveLength(1);
      expect(state.cars[0].id).toBe('123');
    });
  });

  describe('saveState validation', () => {
    it('should filter out invalid cars before saving', () => {
      const state = {
        trackerVersion: 2,
        cars: [
          { id: '123456', location: 'Yard', arrived: false, late: false, empty: false },
          { location: 'Yard' }, // missing id - invalid
          { id: '', location: 'Shop' }, // empty id - invalid
          { id: '789012', location: '100', arrived: true, late: false, empty: false },
          null, // invalid
        ],
        usage: DEFAULT_USAGE,
      };

      const result = saveState(state);

      expect(result).toBe(true);

      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(saved);

      expect(parsed.cars).toHaveLength(2);
      expect(parsed.cars[0].id).toBe('123456');
      expect(parsed.cars[1].id).toBe('789012');
    });

    it('should save empty array if all cars are invalid', () => {
      const state = {
        trackerVersion: 2,
        cars: [
          { location: 'Yard' }, // missing id
          { id: '' }, // empty id
          null,
        ],
        usage: DEFAULT_USAGE,
      };

      saveState(state);

      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(saved);

      expect(parsed.cars).toEqual([]);
    });

    it('should handle non-array cars field', () => {
      const state = {
        trackerVersion: 2,
        cars: 'not an array',
        usage: DEFAULT_USAGE,
      };

      saveState(state);

      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(saved);

      expect(parsed.cars).toEqual([]);
    });

    it('should preserve all valid car fields', () => {
      const state = {
        trackerVersion: 2,
        cars: [
          {
            id: '123456',
            location: 'Shop',
            arrived: true,
            late: true,
            empty: true,
          },
        ],
        usage: DEFAULT_USAGE,
      };

      saveState(state);

      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(saved);

      expect(parsed.cars[0]).toEqual({
        id: '123456',
        location: 'Shop',
        arrived: true,
        late: true,
        empty: true,
      });
    });
  });
});
