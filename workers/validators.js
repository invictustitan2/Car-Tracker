/**
 * Input Validation Utilities for UPS Tracker API
 * 
 * Validates and sanitizes all user inputs before database operations
 * to prevent SQL injection, XSS, and other injection attacks.
 */

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Input validators
 */
export const Validators = {
  /**
   * Validate car ID
   * Must be alphanumeric with dashes, 1-50 characters
   */
  carId(id) {
    if (!id) {
      throw new ValidationError('Car ID is required', 'id');
    }
    
    const sanitized = String(id).trim();
    
    if (sanitized.length === 0 || sanitized.length > 50) {
      throw new ValidationError('Car ID must be 1-50 characters', 'id');
    }
    
    if (!/^[A-Z0-9-]+$/i.test(sanitized)) {
      throw new ValidationError('Car ID must be alphanumeric with dashes only', 'id');
    }
    
    return sanitized;
  },

  /**
   * Validate user ID
   * Must be 1-100 characters, no special characters that could break things
   */
  userId(userId) {
    if (!userId) {
      throw new ValidationError('User ID is required', 'userId');
    }
    
    const sanitized = String(userId).trim();
    
    if (sanitized.length === 0 || sanitized.length > 100) {
      throw new ValidationError('User ID must be 1-100 characters', 'userId');
    }
    
    // Disallow dangerous characters
    if (/<|>|"|'|;|--|\/\*|\*\//.test(sanitized)) {
      throw new ValidationError('User ID contains invalid characters', 'userId');
    }
    
    return sanitized;
  },

  /**
   * Validate location
   * Must be one of the predefined locations
   */
  location(location) {
    const validLocations = ["Yard", "100", "200", "300", "400", "500", "600", "Shop"];
    
    if (!location) {
      throw new ValidationError('Location is required', 'location');
    }
    
    const sanitized = String(location).trim();
    
    if (!validLocations.includes(sanitized)) {
      throw new ValidationError(
        `Invalid location. Must be one of: ${validLocations.join(', ')}`,
        'location'
      );
    }
    
    return sanitized;
  },

  /**
   * Validate notes field
   * Optional, max 1000 characters
   */
  notes(notes) {
    if (!notes) {
      return null;
    }
    
    const sanitized = String(notes).trim();
    
    if (sanitized.length > 1000) {
      throw new ValidationError('Notes must be 1000 characters or less', 'notes');
    }
    
    return sanitized;
  },

  /**
   * Validate shift notes
   * Optional, max 5000 characters (longer than regular notes)
   */
  shiftNotes(notes) {
    if (!notes) {
      return null;
    }
    
    const sanitized = String(notes).trim();
    
    if (sanitized.length > 5000) {
      throw new ValidationError('Shift notes must be 5000 characters or less', 'notes');
    }
    
    return sanitized;
  },

  /**
   * Validate boolean
   */
  boolean(value, fieldName = 'field') {
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (value === 'true' || value === '1' || value === 1) {
      return true;
    }
    
    if (value === 'false' || value === '0' || value === 0) {
      return false;
    }
    
    throw new ValidationError(`${fieldName} must be a boolean`, fieldName);
  },

  /**
   * Validate session ID (UUID format)
   */
  sessionId(id) {
    if (!id) {
      throw new ValidationError('Session ID is required', 'sessionId');
    }
    
    const sanitized = String(id).trim();
    
    // UUID v4 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(sanitized)) {
      throw new ValidationError('Invalid session ID format', 'sessionId');
    }
    
    return sanitized;
  },

  /**
   * Validate pagination parameters
   */
  pagination(limit, offset) {
    const validatedLimit = limit ? parseInt(limit, 10) : 50;
    const validatedOffset = offset ? parseInt(offset, 10) : 0;
    
    if (isNaN(validatedLimit) || validatedLimit < 1 || validatedLimit > 1000) {
      throw new ValidationError('Limit must be between 1 and 1000', 'limit');
    }
    
    if (isNaN(validatedOffset) || validatedOffset < 0) {
      throw new ValidationError('Offset must be >= 0', 'offset');
    }
    
    return { limit: validatedLimit, offset: validatedOffset };
  },

  /**
   * Validate request body size
   */
  requestBodySize(data) {
    const jsonSize = JSON.stringify(data).length;
    const maxSize = 100 * 1024; // 100KB
    
    if (jsonSize > maxSize) {
      throw new ValidationError(
        `Request body too large (${jsonSize} bytes, max ${maxSize} bytes)`
      );
    }
    
    return true;
  },

  /**
   * Validate array size
   */
  arraySize(arr, maxSize = 1000, fieldName = 'array') {
    if (!Array.isArray(arr)) {
      throw new ValidationError(`${fieldName} must be an array`, fieldName);
    }
    
    if (arr.length > maxSize) {
      throw new ValidationError(
        `${fieldName} too large (${arr.length} items, max ${maxSize})`,
        fieldName
      );
    }
    
    return arr;
  },
};

/**
 * Sanitize CSV field to prevent CSV injection
 */
export function sanitizeCsvField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // Prefix dangerous characters that trigger formula execution in Excel/Sheets
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousChars.some(char => str.startsWith(char))) {
    return `'${str}`;
  }
  
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}
