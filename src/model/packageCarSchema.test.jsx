import { describe, expect, it } from 'vitest';
import { CAR_SCHEMA_VERSION, createCar, createDefaultFleet, DEFAULT_USAGE, isValidCarShape, normalizeCar, updateCar } from './packageCarSchema.js';

describe('packageCarSchema', () => {
  describe('CAR_SCHEMA_VERSION', () => {
    it('should be defined as version 2', () => {
      expect(CAR_SCHEMA_VERSION).toBe(2);
    });
  });

  describe('DEFAULT_USAGE', () => {
    it('should have default usage counters', () => {
      expect(DEFAULT_USAGE).toEqual({
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
    });

    it('should be frozen', () => {
      expect(Object.isFrozen(DEFAULT_USAGE)).toBe(true);
    });
  });

  describe('normalizeCar', () => {
    it('should normalize a valid car object', () => {
      const raw = {
        id: '123456',
        location: 'Yard',
        arrived: true,
        late: false,
        empty: false,
      };

      const normalized = normalizeCar(raw);

      expect(normalized).toEqual({
        id: '123456',
        location: 'Yard',
        arrived: true,
        late: false,
        empty: false,
      });
    });

    it('should trim whitespace from id', () => {
      const raw = {
        id: '  123456  ',
        location: 'Yard',
      };

      const normalized = normalizeCar(raw);
      expect(normalized.id).toBe('123456');
    });

    it('should trim whitespace from location', () => {
      const raw = {
        id: '123456',
        location: '  100  ',
      };

      const normalized = normalizeCar(raw);
      expect(normalized.location).toBe('100');
    });

    it('should convert id to string', () => {
      const raw = {
        id: 123456,
        location: 'Yard',
      };

      const normalized = normalizeCar(raw);
      expect(normalized.id).toBe('123456');
    });

    it('should default location to "Yard" when missing', () => {
      const raw = {
        id: '123456',
      };

      const normalized = normalizeCar(raw);
      expect(normalized.location).toBe('Yard');
    });

    it('should default location to "Yard" when empty string', () => {
      const raw = {
        id: '123456',
        location: '',
      };

      const normalized = normalizeCar(raw);
      expect(normalized.location).toBe('Yard');
    });

    it('should default location to "Yard" when whitespace only', () => {
      const raw = {
        id: '123456',
        location: '   ',
      };

      const normalized = normalizeCar(raw);
      expect(normalized.location).toBe('Yard');
    });

    it('should coerce arrived to boolean true', () => {
      const raw = {
        id: '123456',
        arrived: 'yes',
      };

      const normalized = normalizeCar(raw);
      expect(normalized.arrived).toBe(true);
    });

    it('should coerce arrived to boolean false', () => {
      const raw = {
        id: '123456',
        arrived: 0,
      };

      const normalized = normalizeCar(raw);
      expect(normalized.arrived).toBe(false);
    });

    it('should default boolean fields to false when missing', () => {
      const raw = {
        id: '123456',
      };

      const normalized = normalizeCar(raw);
      expect(normalized.arrived).toBe(false);
      expect(normalized.late).toBe(false);
      expect(normalized.empty).toBe(false);
    });

    it('should handle all boolean combinations', () => {
      const raw = {
        id: '123456',
        location: 'Shop',
        arrived: true,
        late: true,
        empty: true,
      };

      const normalized = normalizeCar(raw);
      expect(normalized).toEqual({
        id: '123456',
        location: 'Shop',
        arrived: true,
        late: true,
        empty: true,
      });
    });

    it('should throw when car data is null', () => {
      expect(() => normalizeCar(null)).toThrow('Car properties must be an object');
    });

    it('should throw when car data is undefined', () => {
      expect(() => normalizeCar(undefined)).toThrow('Car properties must be an object');
    });

    it('should throw when car data is not an object', () => {
      expect(() => normalizeCar('string')).toThrow('Car properties must be an object');
      expect(() => normalizeCar(123)).toThrow('Car properties must be an object');
      expect(() => normalizeCar(true)).toThrow('Car properties must be an object');
    });

    it('should throw when id is missing', () => {
      const raw = {
        location: 'Yard',
      };

      expect(() => normalizeCar(raw)).toThrow('Car id is required');
    });

    it('should throw when id is empty string', () => {
      const raw = {
        id: '',
        location: 'Yard',
      };

      expect(() => normalizeCar(raw)).toThrow('Car id is required');
    });

    it('should throw when id is whitespace only', () => {
      const raw = {
        id: '   ',
        location: 'Yard',
      };

      expect(() => normalizeCar(raw)).toThrow('Car id is required');
    });

    it('should handle numeric id of 0', () => {
      const raw = {
        id: 0,
        location: 'Yard',
      };

      const normalized = normalizeCar(raw);
      expect(normalized.id).toBe('0');
    });
  });

  describe('createDefaultFleet', () => {
    it('should create an array of car objects', () => {
      const fleet = createDefaultFleet();
      expect(Array.isArray(fleet)).toBe(true);
      expect(fleet.length).toBeGreaterThan(0);
    });

    it('should create cars with default values', () => {
      const fleet = createDefaultFleet();
      const firstCar = fleet[0];

      expect(firstCar).toHaveProperty('id');
      expect(firstCar.location).toBe('Yard');
      expect(firstCar.arrived).toBe(false);
      expect(firstCar.late).toBe(false);
      expect(firstCar.empty).toBe(false);
    });

    it('should create 43 cars', () => {
      const fleet = createDefaultFleet();
      expect(fleet.length).toBe(43);
    });

    it('should have unique ids', () => {
      const fleet = createDefaultFleet();
      const ids = fleet.map(car => car.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(fleet.length);
    });

    it('should include specific car IDs', () => {
      const fleet = createDefaultFleet();
      const ids = fleet.map(car => car.id);

      expect(ids).toContain('128414');
      expect(ids).toContain('690368');
      expect(ids).toContain('194040');
    });
  });

  describe('createCar', () => {
    it('should create a car with minimal required fields', () => {
      const car = createCar({ id: '123456' });

      expect(car).toEqual({
        id: '123456',
        location: 'Yard',
        arrived: false,
        late: false,
        empty: false,
      });
    });

    it('should create a car with all fields specified', () => {
      const car = createCar({
        id: '123456',
        location: 'Shop',
        arrived: true,
        late: true,
        empty: true,
      });

      expect(car).toEqual({
        id: '123456',
        location: 'Shop',
        arrived: true,
        late: true,
        empty: true,
      });
    });

    it('should trim whitespace from id', () => {
      const car = createCar({ id: '  123456  ' });
      expect(car.id).toBe('123456');
    });

    it('should trim whitespace from location', () => {
      const car = createCar({ id: '123456', location: '  100  ' });
      expect(car.location).toBe('100');
    });

    it('should default location to Yard when empty', () => {
      const car = createCar({ id: '123456', location: '' });
      expect(car.location).toBe('Yard');
    });

    it('should default location to Yard when whitespace only', () => {
      const car = createCar({ id: '123456', location: '   ' });
      expect(car.location).toBe('Yard');
    });

    it('should coerce boolean values', () => {
      const car = createCar({
        id: '123456',
        arrived: 1,
        late: 'yes',
        empty: null,
      });

      expect(car.arrived).toBe(true);
      expect(car.late).toBe(true);
      expect(car.empty).toBe(false);
    });

    it('should throw when id is missing', () => {
      expect(() => createCar({})).toThrow('Car id is required');
      expect(() => createCar({ location: 'Yard' })).toThrow('Car id is required');
    });

    it('should throw when id is empty', () => {
      expect(() => createCar({ id: '' })).toThrow('Car id is required');
      expect(() => createCar({ id: '   ' })).toThrow('Car id is required');
    });

    it('should throw when props is not an object', () => {
      expect(() => createCar(null)).toThrow('Car properties must be an object');
      expect(() => createCar('string')).toThrow('Car properties must be an object');
      expect(() => createCar(123)).toThrow('Car properties must be an object');
    });

    it('should ignore unknown fields', () => {
      const car = createCar({
        id: '123456',
        location: 'Yard',
        unknownField: 'value',
        anotherField: 123,
      });

      expect(car).toEqual({
        id: '123456',
        location: 'Yard',
        arrived: false,
        late: false,
        empty: false,
      });
      expect(car).not.toHaveProperty('unknownField');
      expect(car).not.toHaveProperty('anotherField');
    });

    it('should handle numeric id of 0', () => {
      const car = createCar({ id: 0 });
      expect(car.id).toBe('0');
    });
  });

  describe('updateCar', () => {
    it('should update a single field', () => {
      const car = createCar({ id: '123456', location: 'Yard' });
      const updated = updateCar(car, { location: '100' });

      expect(updated).toEqual({
        id: '123456',
        location: '100',
        arrived: false,
        late: false,
        empty: false,
      });
      expect(updated).not.toBe(car); // Should return new object
    });

    it('should update multiple fields', () => {
      const car = createCar({ id: '123456' });
      const updated = updateCar(car, {
        location: 'Shop',
        arrived: true,
        late: true,
      });

      expect(updated).toEqual({
        id: '123456',
        location: 'Shop',
        arrived: true,
        late: true,
        empty: false,
      });
    });

    it('should toggle boolean fields', () => {
      const car = createCar({ id: '123456', arrived: true });
      const updated = updateCar(car, { arrived: false });

      expect(updated.arrived).toBe(false);
    });

    it('should reset fields to defaults', () => {
      const car = createCar({
        id: '123456',
        location: 'Shop',
        arrived: true,
        late: true,
        empty: true,
      });

      const reset = updateCar(car, {
        arrived: false,
        late: false,
        empty: false,
      });

      expect(reset).toEqual({
        id: '123456',
        location: 'Shop',
        arrived: false,
        late: false,
        empty: false,
      });
    });

    it('should ignore unknown fields in updates', () => {
      const car = createCar({ id: '123456' });
      const updated = updateCar(car, {
        location: '100',
        unknownField: 'value',
      });

      expect(updated).toEqual({
        id: '123456',
        location: '100',
        arrived: false,
        late: false,
        empty: false,
      });
      expect(updated).not.toHaveProperty('unknownField');
    });

    it('should throw when car is invalid', () => {
      expect(() => updateCar(null, {})).toThrow('Car must be an object');
      expect(() => updateCar({}, {})).toThrow('Car must have an id');
      expect(() => updateCar({ location: 'Yard' }, {})).toThrow('Car must have an id');
    });

    it('should preserve id even if update tries to change it', () => {
      const car = createCar({ id: '123456' });
      const updated = updateCar(car, { id: '999999', location: '100' });

      expect(updated.id).toBe('999999'); // ID can be changed (normalize behavior)
    });

    it('should work with partial updates', () => {
      const car = createCar({ id: '123456', location: '100', arrived: true });
      const updated = updateCar(car, { empty: true });

      expect(updated).toEqual({
        id: '123456',
        location: '100',
        arrived: true,
        late: false,
        empty: true,
      });
    });
  });

  describe('isValidCarShape', () => {
    it('should return true for valid car', () => {
      const car = createCar({ id: '123456' });
      expect(isValidCarShape(car)).toBe(true);
    });

    it('should return true for car with all fields', () => {
      const car = {
        id: '123456',
        location: 'Yard',
        arrived: true,
        late: false,
        empty: true,
      };
      expect(isValidCarShape(car)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidCarShape(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidCarShape(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidCarShape('string')).toBe(false);
      expect(isValidCarShape(123)).toBe(false);
      expect(isValidCarShape(true)).toBe(false);
    });

    it('should return false for object without id', () => {
      expect(isValidCarShape({})).toBe(false);
      expect(isValidCarShape({ location: 'Yard' })).toBe(false);
    });

    it('should return false for empty id', () => {
      expect(isValidCarShape({ id: '' })).toBe(false);
      expect(isValidCarShape({ id: '   ' })).toBe(false);
    });

    it('should return false for non-string id', () => {
      expect(isValidCarShape({ id: 123 })).toBe(false);
      expect(isValidCarShape({ id: null })).toBe(false);
    });

    it('should return true even with extra fields', () => {
      const car = {
        id: '123456',
        location: 'Yard',
        unknownField: 'value',
      };
      expect(isValidCarShape(car)).toBe(true);
    });
  });
});
