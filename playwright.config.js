import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for UPS Tracker
 * Supports both local development and production testing
 * @see https://playwright.dev/docs/test-configuration
 */

// Determine if running against production
const isProduction = process.env.TEST_ENV === 'production' || process.env.BASE_URL?.includes('tracker.aperion.cc');
const isCI = !!process.env.CI;
const baseURL = process.env.BASE_URL || (isProduction ? 'https://tracker.aperion.cc' : 'http://127.0.0.1:5173');

export default defineConfig({
  testDir: './e2e',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI or production tests (reduced to 1 for faster feedback)
  retries: process.env.CI || isProduction ? 1 : 0,
  
  // Use 1 worker for local development to avoid SQLite locking
  // Use more workers for Production where the DB might be remote or separate
  workers: process.env.CI ? 1 : (isProduction ? 3 : 1),
  
  // Timeout for tests
  timeout: isProduction ? 60000 : 30000,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL,
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Slight delay for production to avoid rate limits
    actionTimeout: isProduction ? 15000 : 10000,
    navigationTimeout: isProduction ? 30000 : 15000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment for mobile testing
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    
    // Uncomment for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: isProduction ? undefined : {
    command: isCI ? 'npm run dev:all' : 'npm run dev:all',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120 * 1000,
  },
});
