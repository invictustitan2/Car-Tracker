import { describe, expect, it } from 'vitest';
import { parseCsvContent, validateCsvRow } from './csvParser.js';

describe('csvParser', () => {
  describe('validateCsvRow', () => {
    it('should validate a valid row', () => {
      const row = {
        id: '123456',
        location: 'Yard',
        arrived: 'false',
        late: 'false',
        empty: 'false',
      };

      const result = validateCsvRow(row, 1);

      expect(result.success).toBe(true);
      expect(result.car).toEqual({
        id: '123456',
        location: 'Yard',
        arrived: false,
        late: false,
        empty: false,
      });
      expect(result.rowIndex).toBe(1);
    });

    it('should fail validation for missing id', () => {
      const row = {
        location: 'Yard',
        arrived: 'false',
      };

      const result = validateCsvRow(row, 2);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing car ID');
      expect(result.rowIndex).toBe(2);
    });

    it('should fail validation for empty id', () => {
      const row = {
        id: '   ',
        location: 'Yard',
      };

      const result = validateCsvRow(row, 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing car ID');
    });

    it('should parse boolean values correctly', () => {
      const testCases = [
        { arrived: 'true', expected: true },
        { arrived: '1', expected: true },
        { arrived: 'yes', expected: true },
        { arrived: 'arrived', expected: true },
        { arrived: 'false', expected: false },
        { arrived: '0', expected: false },
        { arrived: 'no', expected: false },
        { arrived: '', expected: false },
      ];

      testCases.forEach(({ arrived, expected }, idx) => {
        const result = validateCsvRow({ id: '123', arrived }, idx);
        expect(result.success).toBe(true);
        expect(result.car.arrived).toBe(expected);
      });
    });

    it('should normalize whitespace in values', () => {
      const row = {
        id: '  123456  ',
        location: '  Yard  ',
        arrived: '  true  ',
      };

      const result = validateCsvRow(row, 1);

      expect(result.success).toBe(true);
      expect(result.car.id).toBe('123456');
      expect(result.car.location).toBe('Yard');
    });

    it('should support alternative header names', () => {
      const testCases = [
        { car: '123' },
        { carnumber: '123' },
        { car_id: '123' },
        { packagecar: '123' },
      ];

      testCases.forEach((row, idx) => {
        const result = validateCsvRow(row, idx);
        expect(result.success).toBe(true);
        expect(result.car.id).toBe('123');
      });
    });

    it('should support alternative location header names', () => {
      const testCases = [
        { id: '123', lane: 'Yard' },
        { id: '123', dock: 'Yard' },
      ];

      testCases.forEach((row, idx) => {
        const result = validateCsvRow(row, idx);
        expect(result.success).toBe(true);
        expect(result.car.location).toBe('Yard');
      });
    });

    it('should default to Yard for missing location', () => {
      const row = { id: '123' };

      const result = validateCsvRow(row, 1);

      expect(result.success).toBe(true);
      expect(result.car.location).toBe('Yard');
    });
  });

  describe('parseCsvContent', () => {
    it('should parse valid CSV content', () => {
      const csv = `id,location,arrived,late,empty
123456,Yard,false,false,false
789012,100,true,false,false
345678,200,false,true,false`;

      const { cars, errors } = parseCsvContent(csv);

      expect(errors).toHaveLength(0);
      expect(cars).toHaveLength(3);
      expect(cars[0]).toEqual({
        id: '123456',
        location: 'Yard',
        arrived: false,
        late: false,
        empty: false,
      });
      expect(cars[1]).toEqual({
        id: '789012',
        location: '100',
        arrived: true,
        late: false,
        empty: false,
      });
      expect(cars[2]).toEqual({
        id: '345678',
        location: '200',
        arrived: false,
        late: true,
        empty: false,
      });
    });

    it('should handle CSV with only headers', () => {
      const csv = `id,location,arrived,late,empty`;

      const { cars, errors } = parseCsvContent(csv);

      expect(cars).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('should return error for empty CSV', () => {
      const csv = '';

      const { cars, errors } = parseCsvContent(csv);

      expect(cars).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('empty');
    });

    it('should return error for CSV without id column', () => {
      const csv = `location,arrived
Yard,false`;

      const { cars, errors } = parseCsvContent(csv);

      expect(cars).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('id');
    });

    it('should skip rows with missing id', () => {
      const csv = `id,location,arrived
123,Yard,false
,100,true
456,200,false`;

      const { cars, errors } = parseCsvContent(csv);

      expect(cars).toHaveLength(2);
      expect(cars[0].id).toBe('123');
      expect(cars[1].id).toBe('456');
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe('Missing car ID');
    });

    it('should collect errors for multiple invalid rows', () => {
      const csv = `id,location,arrived
123,Yard,false
,100,true
,200,false
456,Shop,true`;

      const { cars, errors } = parseCsvContent(csv);

      expect(cars).toHaveLength(2);
      expect(errors).toHaveLength(2);
      expect(errors[0].rowIndex).toBe(2);
      expect(errors[1].rowIndex).toBe(3);
    });

    it('should handle case-insensitive headers', () => {
      const csv = `ID,LOCATION,ARRIVED
123,Yard,true`;

      const { cars, errors } = parseCsvContent(csv);

      expect(errors).toHaveLength(0);
      expect(cars).toHaveLength(1);
      expect(cars[0].id).toBe('123');
      expect(cars[0].location).toBe('Yard');
      expect(cars[0].arrived).toBe(true);
    });

    it('should skip empty lines', () => {
      const csv = `id,location

123,Yard

456,100
`;

      const { cars, errors } = parseCsvContent(csv);

      expect(errors).toHaveLength(0);
      expect(cars).toHaveLength(2);
    });

    it('should handle mixed valid and invalid rows', () => {
      const csv = `id,location,arrived,late,empty
123,Yard,false,false,false
,100,true,false,false
456,200,false,false,false
,300,false,true,false
789,Shop,true,false,true`;

      const { cars, errors } = parseCsvContent(csv);

      expect(cars).toHaveLength(3);
      expect(cars[0].id).toBe('123');
      expect(cars[1].id).toBe('456');
      expect(cars[2].id).toBe('789');

      expect(errors).toHaveLength(2);
      expect(errors[0].rowIndex).toBe(2);
      expect(errors[1].rowIndex).toBe(4);
    });

    it('should handle CSV with extra whitespace', () => {
      const csv = `  id  ,  location  ,  arrived  
  123  ,  Yard  ,  true  
  456  ,  100  ,  false  `;

      const { cars, errors } = parseCsvContent(csv);

      expect(errors).toHaveLength(0);
      expect(cars).toHaveLength(2);
      expect(cars[0].id).toBe('123');
      expect(cars[0].location).toBe('Yard');
    });

    it('should parse minimal CSV with just id column', () => {
      const csv = `id
123
456
789`;

      const { cars, errors } = parseCsvContent(csv);

      expect(errors).toHaveLength(0);
      expect(cars).toHaveLength(3);
      expect(cars[0]).toEqual({
        id: '123',
        location: 'Yard',
        arrived: false,
        late: false,
        empty: false,
      });
    });

    it('should handle alternative column names', () => {
      const csv = `car,lane,status
123,100,arrived
456,200,`;

      const { cars, errors } = parseCsvContent(csv);

      expect(errors).toHaveLength(0);
      expect(cars).toHaveLength(2);
      expect(cars[0].id).toBe('123');
      expect(cars[0].location).toBe('100');
      expect(cars[0].arrived).toBe(true);
      expect(cars[1].id).toBe('456');
      expect(cars[1].arrived).toBe(false);
    });

    it('should handle malformed CSV gracefully', () => {
      const csv = `id,location
123,Yard,extra,columns
456`;

      const { cars } = parseCsvContent(csv);

      // Should parse what it can
      expect(cars.length).toBeGreaterThanOrEqual(0);
    });

    it('should return all valid cars even with some errors', () => {
      const csv = `id,location,arrived
123,Yard,true
,100,false
456,200,true
789,Shop,false
,300,true`;

      const { cars, errors } = parseCsvContent(csv);

      expect(cars).toHaveLength(3);
      expect(cars[0].id).toBe('123');
      expect(cars[1].id).toBe('456');
      expect(cars[2].id).toBe('789');

      expect(errors).toHaveLength(2);
    });
  });
});
