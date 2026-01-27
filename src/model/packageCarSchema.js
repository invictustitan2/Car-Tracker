export const CAR_SCHEMA_VERSION = 2;

/**
 * Canonical Package Car Schema
 * 
 * A package car object has the following shape:
 * {
 *   id: string (required) - Unique identifier for the car
 *   location: string (default: 'Yard') - Current location of the car
 *   arrived: boolean (default: false) - Whether the car has arrived
 *   late: boolean (default: false) - Whether the car is late
 *   empty: boolean (default: false) - Whether the car has been emptied
 * }
 * 
 * All car creation and updates should go through the helper functions
 * in this module to ensure consistency and validation.
 */

const INITIAL_CARS = [
  "128414", "128421", "128425", "128431", "128446", "128448", "128450",
  "128458", "128463", "128469", "128470", "128472", "128477", "128484",
  "128489", "128507", "128508", "144129", "156445", "171011", "173813",
  "173815", "173837", "173839", "173856", "173869", "194040", "632850",
  "690045", "690046", "690065", "690142", "690166", "690263", "690279",
  "690325", "690330", "690331", "690340", "690346", "690354", "690359",
  "690368"
];

/**
 * @deprecated Use DEFAULT_COUNTERS from src/usage/usageCounters.js instead
 * This export maintained for backwards compatibility with tests
 */
export const DEFAULT_USAGE = Object.freeze({
  filterClicks: 0,
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

/**
 * Default values for a package car
 */
const DEFAULT_CAR_VALUES = {
  location: 'Yard',
  arrived: false,
  late: false,
  empty: false,
};

/**
 * Normalizes a raw car object to ensure all required fields exist
 * and are properly typed.
 * This function is primarily for backwards compatibility and migration.
 * New code should use createCar() or updateCar() instead.
 * 
 * @param {object} raw - The raw car data
 * @returns {object} Normalized car object
 */
export function normalizeCar(raw) {
  // Use createCar for actual normalization to ensure consistency
  return createCar(raw);
}

/**
 * Creates the default fleet with initial car IDs
 * @returns {Array} Array of normalized car objects
 */
export function createDefaultFleet() {
  return INITIAL_CARS.map(id => ({
    id,
    location: 'Yard',
    arrived: false,
    late: false,
    empty: false,
  }));
}

/**
 * Creates a new car object with the provided properties.
 * This is the canonical way to create a car - all creation paths should use this.
 * 
 * @param {object} props - Car properties
 * @param {string} props.id - Required car ID
 * @param {string} [props.location] - Location (defaults to 'Yard')
 * @param {boolean} [props.arrived] - Arrived status (defaults to false)
 * @param {boolean} [props.late] - Late status (defaults to false)
 * @param {boolean} [props.empty] - Empty status (defaults to false)
 * @returns {object} Normalized car object
 * @throws {Error} If id is missing or invalid
 */
export function createCar(props) {
  if (!props || typeof props !== 'object') {
    throw new Error('Car properties must be an object');
  }

  const id = props.id != null ? String(props.id).trim() : '';
  
  if (!id) {
    throw new Error('Car id is required');
  }

  const location = props.location ? String(props.location).trim() : '';

  return {
    id,
    location: location || DEFAULT_CAR_VALUES.location,
    arrived: Boolean(props.arrived),
    late: Boolean(props.late),
    empty: Boolean(props.empty),
  };
}

/**
 * Updates an existing car with new properties.
 * This is the canonical way to update a car - all update paths should use this.
 * 
 * @param {object} car - Existing car object
 * @param {object} updates - Properties to update
 * @returns {object} New car object with updates applied
 * @throws {Error} If car is invalid
 */
export function updateCar(car, updates = {}) {
  if (!car || typeof car !== 'object') {
    throw new Error('Car must be an object');
  }
  
  if (!car.id) {
    throw new Error('Car must have an id');
  }

  // Merge updates into existing car, then normalize
  const merged = { ...car, ...updates };
  
  // Use createCar to ensure all fields are properly normalized
  return createCar(merged);
}

/**
 * Validates that an object conforms to the car schema without normalizing.
 * Useful for checking if an object is a valid car before operations.
 * 
 * @param {object} obj - Object to validate
 * @returns {boolean} True if valid car shape
 */
export function isValidCarShape(obj) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  if (!obj.id || typeof obj.id !== 'string' || !obj.id.trim()) {
    return false;
  }

  return true;
}
