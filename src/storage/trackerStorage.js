import { CAR_SCHEMA_VERSION, createDefaultFleet, DEFAULT_USAGE, isValidCarShape, normalizeCar } from '../model/packageCarSchema.js';

export const STORAGE_KEY = 'ups-tracker-data';

const createEmptyState = (targetVersion = CAR_SCHEMA_VERSION) => ({
  trackerVersion: targetVersion,
  cars: [],
  usage: { ...DEFAULT_USAGE },
  currentShift: null,
});

/**
 * Migrates old state format to current version
 * @param {object|Array} oldState - The old state data
 * @param {number} targetVersion - Target schema version
 * @returns {object} Migrated state
 */
export function migrateState(oldState, targetVersion = CAR_SCHEMA_VERSION) {
  if (!oldState) {
    return createEmptyState(targetVersion);
  }

  const isArrayPayload = Array.isArray(oldState);
  const incomingVersion = !isArrayPayload && typeof oldState === 'object'
    ? Number(oldState.trackerVersion ?? oldState.version ?? 0)
    : 0;
  
  const container = isArrayPayload ? { cars: oldState } : oldState;
  const hasExplicitCars = Array.isArray(container.cars) || isArrayPayload;
  const carsSource = Array.isArray(container.cars)
    ? container.cars
    : (isArrayPayload ? oldState : []);

  const cleanedCars = carsSource
    .filter(entry => entry?.id)
    .map(raw => {
      try {
        return normalizeCar(raw);
      } catch (err) {
        const isDev = import.meta.env.DEV;
        if (isDev) {
          console.warn('Skipping invalid car during migration:', raw, err.message);
        } else {
          console.warn('Skipping invalid car during migration:', err.message);
        }
        return null;
      }
    })
    .filter(Boolean);

  const usage = {
    ...DEFAULT_USAGE,
    ...(!isArrayPayload && typeof oldState === 'object' && incomingVersion >= 2 && oldState?.usage ? oldState.usage : {}),
  };

  const currentShift = typeof oldState === 'object' && oldState?.currentShift
    ? oldState.currentShift
    : null;

  return {
    trackerVersion: targetVersion,
    cars: hasExplicitCars && (cleanedCars.length > 0 || carsSource.length === 0)
      ? cleanedCars
      : createDefaultFleet(),
    usage,
    currentShift,
  };
}

/**
 * Loads the tracker state from localStorage
 * @returns {object} Normalized tracker state
 */
export function loadState() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return migrateState(null);
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return migrateState(null);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('loadState: JSON parse error, clearing storage entry');
      window.localStorage.removeItem(STORAGE_KEY);
      return migrateState(null);
    }

    if (parsed !== null && typeof parsed !== 'object') {
      console.warn('loadState: Invalid structure detected, resetting storage');
      window.localStorage.removeItem(STORAGE_KEY);
      return migrateState(null);
    }

    return migrateState(parsed);
  } catch (err) {
    const isDev = import.meta.env.DEV;
    if (isDev) {
      console.warn('Unexpected error loading tracker state, using defaults:', err);
    } else {
      console.warn('Unexpected error loading tracker state, using defaults');
    }
    return migrateState(null);
  }
}

/**
 * Saves the tracker state to localStorage
 * @param {object} state - The state to save
 * @returns {boolean} Success status
 */
export function saveState(state) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    if (!state || typeof state !== 'object') {
      console.warn('Invalid state provided to saveState');
      return false;
    }

    // Validate all cars before saving
    const validCars = Array.isArray(state.cars) ? state.cars.filter(car => {
      const isValid = isValidCarShape(car);
      if (!isValid) {
        console.warn('Skipping invalid car during save:', car);
      }
      return isValid;
    }) : [];

    const stateToSave = {
      trackerVersion: state.trackerVersion ?? CAR_SCHEMA_VERSION,
      cars: validCars,
      usage: state.usage ?? { ...DEFAULT_USAGE },
    };

    stateToSave.currentShift = state.currentShift ?? null;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    return true;
  } catch (err) {
    console.error('Failed to save tracker state', err);
    return false;
  }
}

/**
 * Clears all tracker data from localStorage
 * @returns {boolean} Success status
 */
export function clearAllData() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('Failed to clear tracker data:', err);
    return false;
  }
}
