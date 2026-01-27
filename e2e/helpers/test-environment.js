/**
 * Test Environment Detection Utilities
 * Determines whether tests are running locally or against production
 */

/**
 * Check if tests are running against production
 * @returns {boolean}
 */
export function isProductionTest() {
  return process.env.TEST_ENV === 'production' || process.env.BASE_URL?.includes('tracker.aperion.cc');
}

/**
 * Check if tests are running locally
 * @returns {boolean}
 */
export function isLocalTest() {
  return !isProductionTest();
}

/**
 * Get the base URL for tests
 * @returns {string}
 */
export function getBaseURL() {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  return isProductionTest() ? 'https://tracker.aperion.cc' : 'http://127.0.0.1:5173';
}

/**
 * Get test-specific configuration
 * @returns {object}
 */
export function getTestConfig() {
  const isProd = isProductionTest();
  
  return {
    baseURL: getBaseURL(),
    timeout: isProd ? 60000 : 30000, // Longer timeout for production
    retries: isProd ? 2 : 0, // Retry on production for network issues
    workers: isProd ? 3 : 1, // More parallelization on production
    headless: true, // Always headless in CI
    slowMo: isProd ? 100 : 0, // Slight delay on production to avoid rate limits
  };
}

/**
 * Skip test if running in production
 * Use for tests that modify data or test localhost-specific features
 * @param {object} test - Playwright test object
 */
export function skipInProduction(test) {
  test.skip(isProductionTest(), 'Skipped in production environment');
}

/**
 * Skip test if running locally
 * Use for tests that require production-specific features
 * @param {object} test - Playwright test object
 */
export function skipLocally(test) {
  test.skip(isLocalTest(), 'Skipped in local environment');
}

/**
 * Generate a unique test ID to avoid conflicts
 * @param {string} prefix - Optional prefix
 * @returns {string}
 */
export function generateTestId(prefix = 'TEST') {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * Setup common test environment (prevents UserIdentificationDialog from blocking tests)
 * Call this in beforeEach to ensure tests can interact with the UI
 * @param {object} page - Playwright page object
 */
export async function setupTestEnvironment(page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('ups_tracker_user_id', 'e2e-test-user');
  });
  await page.reload();
}
