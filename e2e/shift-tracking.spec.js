import { expect, test } from '@playwright/test';
import { clearDatabase } from './helpers/db-cleanup.js';

/**
 * E2E Tests for Shift Tracking Features
 * Tests shift start, end, reset, and snapshot functionality
 */

test.describe('Shift Tracking', () => {
  test.beforeEach(async ({ page, request }) => {
    // Clean up database before each test to ensure isolation
    await clearDatabase(request);

    await page.goto('/');
    // Set user ID to prevent UserIdentificationDialog from blocking UI
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('e2e_disable_sync', 'true');
      localStorage.setItem('ups_tracker_user_id', 'e2e-test-user');
    });
    // Reload to apply localStorage changes
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Package Car Tracker');
    
    // Wait for the add car input to be visible (ensures React has fully rendered)
    await expect(page.getByPlaceholder(/Add ID/i)).toBeVisible({ timeout: 10000 });
  });

  test('should start a new shift', async ({ page }) => {
    await page.goto('/');
    
    // Add some cars first
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially('111111');
    await page.getByRole('button', { name: /Add/i }).click();
    
    // Look for Start Shift button
    const startShiftButton = page.getByRole('button', { name: /Start Shift/i });
    
    // Button should be visible when there are cars
    await expect(startShiftButton).toBeVisible();
    
    // Click to start shift - this opens dialog, then confirm
    await startShiftButton.first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Start Shift' }).last().click();
    
    // Verify shift started (button should change to End Shift)
    await expect(page.getByRole('button', { name: /End Shift/i })).toBeVisible();
  });

  test('should end shift and reset cars', async ({ page }) => {
    await page.goto('/');
    
    // Add a car and mark as arrived
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially('222222');
    await page.getByRole('button', { name: /Add/i }).click();
    
    const carCard = page.getByTestId('car-card-222222');
    await carCard.getByRole('button', { name: /Arrived/i }).click();
    
    // Start shift - click main button then confirm dialog
    await page.getByRole('button', { name: /Start Shift/i }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Start Shift' }).last().click();
    
    // End shift - click main button then confirm dialog
    await page.getByRole('button', { name: /End Shift/i }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'End Shift' }).last().click();
    
    // Verify cars were reset (should be back to pending state)
    await expect(carCard).toHaveAttribute('data-status', 'pending');
  });

  test('should not allow starting shift without cars', async ({ page }) => {
    // Ensure DB is empty
    await page.evaluate(async () => {
        await fetch('/api/cars/reset?hard=true', { method: 'POST' });
    });
    
    await page.goto('/');
    
    // Ensure fleet is empty (override default fleet)
    // Note: With server-first architecture, we rely on the DB being empty from beforeEach cleanup
    
    // With no cars, start shift button should not be visible or disabled
    const startShiftButton = page.getByRole('button', { name: /Start Shift/i });
    
    // Button should either not exist or be disabled
    const buttonCount = await startShiftButton.count();
    if (buttonCount > 0) {
      await expect(startShiftButton).toBeDisabled();
    }
  });
});
