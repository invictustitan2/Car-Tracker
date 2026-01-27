import { expect, test } from '@playwright/test';
import { clearDatabase } from './helpers/db-cleanup.js';

test.describe('State resilience', () => {
  test.beforeEach(async ({ request }) => {
    await clearDatabase(request);
  });

  test('recovers gracefully from corrupted localStorage state', async ({ page }) => {
    await page.goto('/');
    
    // Add a car first so we have something to check visibility for
    const carId = 'RECOVER123';
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    // FIX: Wait for stability before proceeding
    await expect(page.getByTestId(`car-card-${carId}`)).toBeVisible({ timeout: 10000 });

    // Intentionally corrupt localStorage
    await page.evaluate(() => {
      localStorage.setItem('ups-tracker-storage', 'invalid-json{}}');
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The app should recover to defaults and still render the UI
    await expect(page.getByPlaceholder(/Add ID/i)).toBeVisible();
    
    // Verify the car we just added is refetched from API (might take a moment)
    await expect(page.getByTestId(`car-card-${carId}`)).toBeVisible({ timeout: 10000 });
  });
});
