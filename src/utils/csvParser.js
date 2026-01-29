import { createCar } from '../model/packageCarSchema.js';

/**
 * Normalizes a CSV header string (lowercase, trim whitespace)
 * @param {string} header - Raw CSV header
 * @returns {string} Normalized header
 */
function normalizeHeader(header) {
  return String(header).toLowerCase().trim();
}

/**
 * Normalizes a CSV value (trim whitespace, handle empty strings)
 * @param {string} value - Raw CSV value
 * @returns {string} Normalized value
 */
function normalizeValue(value) {
  return String(value ?? '').trim();
}

/**
 * Maps a CSV row object to a car object based on expected headers
 * @param {object} row - CSV row object with headers as keys
 * @returns {object} Car object matching packageCarSchema
 */
function mapRowToCar(row) {
  // Support various header name variations (including spaces, normalized by normalizeHeader)
  const id = row.id || row['car id'] || row.car || row.carnumber || row.car_id || row.packagecar || '';
  const location = row.location || row.lane || row.dock || '';
  const arrived = row.arrived || row.status || '';
  const late = row.late || '';
  const empty = row.empty || '';

  return {
    id: normalizeValue(id),
    location: normalizeValue(location),
    // Parse boolean-ish values
    arrived: ['true', '1', 'yes', 'arrived'].includes(normalizeValue(arrived).toLowerCase()),
    late: ['true', '1', 'yes', 'late'].includes(normalizeValue(late).toLowerCase()),
    empty: ['true', '1', 'yes', 'empty'].includes(normalizeValue(empty).toLowerCase()),
  };
}

/**
 * Validates a single CSV row and returns normalized car or error
 * @param {object} row - CSV row object
 * @param {number} rowIndex - Row index for error reporting (1-based, excluding header)
 * @returns {object} { success: boolean, car?: object, error?: string, rowIndex: number }
 */
export function validateCsvRow(row, rowIndex) {
  try {
    const rawCar = mapRowToCar(row);
    
    if (!rawCar.id) {
      return {
        success: false,
        error: 'Missing car ID',
        rowIndex,
      };
    }

    // Use createCar for validation and normalization
    const normalizedCar = createCar(rawCar);
    
    return {
      success: true,
      car: normalizedCar,
      rowIndex,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Invalid car data',
      rowIndex,
    };
  }
}

/**
 * Parses CSV content and validates all rows
 * @param {string} csvContent - Raw CSV text content
 * @returns {object} { cars: Array, errors: Array }
 */
export function parseCsvContent(csvContent) {
  const cars = [];
  const errors = [];

  try {
    const lines = csvContent.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { cars: [], errors: [{ rowIndex: 0, error: 'CSV file is empty' }] };
    }

    // Detect if first line is a header or data
    // If first value is all letters (like "id", "car", "location"), it's a header
    // If it's numeric or alphanumeric car ID, it's data
    const firstLine = lines[0];
    const firstValues = firstLine.split(',').map(v => v.trim());
    const firstValue = firstValues[0].toLowerCase();
    
    // Check if first line looks like headers
    const hasHeaders = firstValue.includes('id') || 
                      firstValue.includes('car') || 
                      firstValue.match(/^[a-z_]+$/); // All letters/underscores, no numbers
    
    let headers;
    let startIndex;
    
    if (hasHeaders) {
      // First line is headers
      headers = firstLine.split(',').map(normalizeHeader);
      
      if (headers.length === 0 || !headers.some(h => h.includes('id') || h.includes('car'))) {
        return { 
          cars: [], 
          errors: [{ rowIndex: 0, error: 'CSV must include an "id" or "car" column' }] 
        };
      }
      
      startIndex = 1;
    } else {
      // No headers - assume format: id,location
      headers = ['id', 'location'];
      startIndex = 0;
    }

    // Parse data rows
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = line.split(',').map(normalizeValue);
      
      // Create row object by pairing headers with values
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      const result = validateCsvRow(row, i); // i is the line number (1-based excluding header)
      
      if (result.success) {
        cars.push(result.car);
      } else {
        errors.push({
          rowIndex: result.rowIndex,
          error: result.error,
        });
      }
    }

    return { cars, errors };
  } catch (err) {
    return {
      cars: [],
      errors: [{ rowIndex: 0, error: `Failed to parse CSV: ${err.message}` }],
    };
  }
}
