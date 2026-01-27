// import { expect } from '@playwright/test';

/**
 * Clears the database for testing
 * Uses direct fetch to work in both Node (cleanup) and Browser contexts
 */
export async function clearDatabase(requestContext = null) {
  // Prioritize the explicit API URL, fallback to localhost for local dev
  const baseUrl = process.env.VITE_API_URL || 'http://127.0.0.1:8787';
  const apiKey = process.env.VITE_API_KEY || 'test-api-key';

  console.log(`[db-cleanup] Target API: ${baseUrl}`);

  try {
    // If a Playwright request context is provided, use it (Browser/Test context)
    if (requestContext) {
      const response = await requestContext.post(`${baseUrl}/api/cars/reset?hard=true`, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok()) {
        console.warn(`Cleanup failed with status ${response.status()}: ${await response.text()}`);
      }
      return;
    }

    // Fallback to native fetch for Node.js environment (Global Cleanup)
    const response = await fetch(`${baseUrl}/api/cars/reset?hard=true`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`Global cleanup failed: ${response.status} ${text}`);
    } else {
      console.log('[db-cleanup] Database reset successful');
    }
  } catch (error) {
    console.error('[db-cleanup] Error:', error.message);
    // Don't throw, allow tests to proceed even if cleanup is flaky
  }
}
