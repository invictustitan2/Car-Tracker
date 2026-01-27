import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

/**
 * Mock Service Worker server for Node.js tests
 * This intercepts HTTP requests during testing
 */
export const server = setupServer(...handlers);
