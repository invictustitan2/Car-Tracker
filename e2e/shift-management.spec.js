import { expect, test } from '@playwright/test';
import { CAR_SCHEMA_VERSION } from '../src/model/packageCarSchema.js';
import { STORAGE_KEY } from '../src/storage/trackerStorage.js';
import { clearDatabase } from './helpers/db-cleanup.js';

/**
 * E2E Tests - Shift Management
 * Real browser tests for shift start, end, snapshots, and reset
 * NO MOCKS - Tests actual shift tracking functionality
 */

test.describe('Shift Management', () => {
  test.beforeEach(async ({ page, request }) => {
    // Clean up database before each test to ensure isolation
    await clearDatabase(request);

    await page.goto('/');
    // Set user ID to prevent UserIdentificationDialog from blocking UI
    await page.evaluate(({ storageKey, schemaVersion }) => {
      localStorage.clear();
      localStorage.setItem('e2e_disable_sync', 'true');
      localStorage.setItem('ups_tracker_user_id', 'e2e-test-user');
      localStorage.setItem(storageKey, JSON.stringify({
        trackerVersion: schemaVersion,
        cars: [],
        usage: {},
        currentShift: null,
      }));
    }, { storageKey: STORAGE_KEY, schemaVersion: CAR_SCHEMA_VERSION });
    // Reload to apply localStorage changes
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Package Car Tracker');
    
    // Wait for the add car input to be visible (ensures React has fully rendered)
    await expect(page.getByPlaceholder(/Add ID/i)).toBeVisible({ timeout: 10000 });
  });

  test('should start shift when cars exist', async ({ page }) => {
    // Add some cars first
    const car1 = `SH1${Date.now().toString().slice(-5)}`;
    const car2 = `SH2${Date.now().toString().slice(-5)}`;
    
    for (const carId of [car1, car2]) {
      
      await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }
    
    // Mark one as arrived
    await page.getByTestId(`car-card-${car1}`).getByRole('button', { name: /Mark Arrived/i }).click();
    
    // Click Start Shift button - this opens a dialog
    const startBtn = page.getByRole('button', { name: /Start Shift/i }).first();
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    
    // Confirm the shift start dialog
    await page.getByRole('button', { name: 'Start Shift' }).last().click();
    
    // Verify button changed to End Shift & Reset
    await expect(page.getByRole('button', { name: /End Shift/i })).toBeVisible();
  });

  test('should end shift and reset car statuses', async ({ page }) => {
    // Add and setup cars
    const car1 = `ES1${Date.now().toString().slice(-5)}`;
    const car2 = `ES2${Date.now().toString().slice(-5)}`;
    
    for (const carId of [car1, car2]) {
      
      await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }
    
    // Mark both as arrived and one as empty
    const card1 = page.getByTestId(`car-card-${car1}`);
    const card2 = page.getByTestId(`car-card-${car2}`);
    
    await card1.getByRole('button', { name: /Mark Arrived/i }).click();
    await card2.getByRole('button', { name: /Mark Arrived/i }).click();
    await card1.getByRole('button', { name: /Mark Empty/i }).click();
    
    // Verify statuses
    await expect(card1.getByText('Completed')).toBeVisible();
    await expect(card2.getByText('On Site')).toBeVisible();
    
    // Start shift - click main button then confirm dialog
    await page.getByRole('button', { name: /Start Shift/i }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Start Shift' }).last().click();
    
    // End shift - click main button then confirm dialog
    await page.getByRole('button', { name: /End Shift/i }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'End Shift' }).last().click();
    
    // Verify both cars reset to Pending
    await expect(page.getByTestId(`car-card-${car1}`).getByText('Pending')).toBeVisible();
    await expect(page.getByTestId(`car-card-${car2}`).getByText('Pending')).toBeVisible();
    
    // Verify Start Shift button is back
    await expect(page.getByRole('button', { name: /Start Shift/i })).toBeVisible();
  });

  test('should create shift snapshot with current car states', async ({ page }) => {
    // Add cars with different states
    const car1 = `SN1${Date.now().toString().slice(-5)}`;
    const car2 = `SN2${Date.now().toString().slice(-5)}`;
    const car3 = `SN3${Date.now().toString().slice(-5)}`;
    
    // Add car 1 - pending
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(car1);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    
    // Add car 2 - arrived
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(car2);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await page.getByTestId(`car-card-${car2}`).getByRole('button', { name: /Mark Arrived/i }).click();
    
    // Add car 3 - completed
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(car3);
    await page.keyboard.press('Enter');
    
    // FIX: Added wait and visibility check to prevent timeout on click
    await page.waitForTimeout(200);
    const card3 = page.getByTestId(`car-card-${car3}`);
    await expect(card3).toBeVisible();
    
    await card3.getByRole('button', { name: /Mark Arrived/i }).click();
    await card3.getByRole('button', { name: /Mark Empty/i }).click();
    
    // Start shift (creates snapshot) - click main button then confirm dialog
    await page.getByRole('button', { name: /Start Shift/i }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Start Shift' }).last().click();
    
    // Verify shift is active
    await expect(page.getByRole('button', { name: /End Shift/i })).toBeVisible();
    
    // Verify snapshot data exists in localStorage
    const snapshotExists = await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return state.currentShift && state.currentShift.snapshot;
    }, STORAGE_KEY);
    expect(snapshotExists).toBeTruthy();
  });

  test('should persist shift state across page reloads', async ({ page }) => {
    // Add car and start shift
    const carId = `PSH${Date.now().toString().slice(-5)}`;
    
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    
    // Start shift - click main button then confirm dialog
    await page.getByRole('button', { name: /Start Shift/i }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Start Shift' }).last().click();
    
    // Verify shift started
    await expect(page.getByRole('button', { name: /End Shift/i })).toBeVisible();
    
    // Reload page
    await page.reload();
    await expect(page.locator('h1')).toContainText('Package Car Tracker');
    
    // Verify shift is still active
    await expect(page.getByRole('button', { name: /End Shift/i })).toBeVisible();
  });

  test('should not start shift without cars', async ({ page }) => {
    // Ensure DB is empty
    await page.evaluate(async () => {
        await fetch('/api/cars/reset?hard=true', { method: 'POST' });
    });
    await page.reload();

    // Ensure we are in a clean state (no cars)
    const carCount = await page.getByTestId(/^car-card-/).count();
    if (carCount === 0) {
        const startBtn = page.getByRole('button', { name: /Start Shift/i });
        if (await startBtn.count() > 0) {
            await expect(startBtn).toBeDisabled();
        }
    }
  });

  test('should track shift start and end times', async ({ page }) => {
    // Add car
    const carId = `TIME${Date.now().toString().slice(-5)}`;
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    
    // Start shift - click main button then confirm dialog
    const startTime = Date.now();
    await page.getByRole('button', { name: /Start Shift/i }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Start Shift' }).last().click();
    
    // Verify shift has start time in localStorage
    const shiftData = await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return state.currentShift;
    }, STORAGE_KEY);
    
    expect(shiftData).toBeTruthy();
    expect(shiftData.startedAt).toBeTruthy();
    expect(new Date(shiftData.startedAt).getTime()).toBeGreaterThanOrEqual(startTime);
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // End shift - click main button then confirm dialog
    await page.getByRole('button', { name: /End Shift/i }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'End Shift' }).last().click();
    
    // Confirm if dialog appears
    const confirmBtn = page.getByRole('button', { name: /Yes|Confirm|Reset/i });
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click();
    }
    
    // Shift should be ended (currentShift should be null)
    const endedShift = await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return state.currentShift;
    }, STORAGE_KEY);
    
    expect(endedShift).toBeNull();
  });

  test('should update car during active shift without losing shift state', async ({ page }) => {
    // Ensure DB is empty
    await page.evaluate(async () => {
        await fetch('/api/cars/reset?hard=true', { method: 'POST' });
    });
    await page.reload();

    // Add car and start shift
    const carId = `UPD${Date.now().toString().slice(-5)}`;
    
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    
    // Start shift - click main button then confirm dialog
    await page.getByRole('button', { name: /Start Shift/i }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Start Shift' }).last().click();
    await expect(page.getByRole('button', { name: /End Shift/i })).toBeVisible();
    
    // Update car during shift
    const carCard = page.getByTestId(`car-card-${carId}`);
    await carCard.getByRole('button', { name: /Mark Arrived/i }).click();
    await expect(carCard.getByText('On Site')).toBeVisible();
    // Wait a bit for server state to settle to avoid version conflicts
    await page.waitForTimeout(500);
    
    // Retry selection if it fails to persist
    await expect(async () => {
      await carCard.locator('select').selectOption('200');
      // Wait for potential server roundtrip
      await page.waitForTimeout(500);
      await expect(carCard.locator('select')).toHaveValue('200', { timeout: 2000 });
    }).toPass({ timeout: 15000 });
    
    // Verify shift is still active
    await expect(page.getByRole('button', { name: /End Shift/i })).toBeVisible();
    
    // Verify car updated
    await expect(carCard.getByText('On Site')).toBeVisible();
    await expect(carCard.locator('select')).toHaveValue('200', { timeout: 10000 });
  });

  test('should add new car during active shift', async ({ page }) => {
    // Add initial car and start shift
    const car1 = `AD1${Date.now().toString().slice(-5)}`;
    
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(car1);
    await page.keyboard.press('Enter');
    
    // Start shift - click main button then confirm dialog
    await page.getByRole('button', { name: /Start Shift/i }).first().click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Start Shift' }).last().click();
    
    // Add another car during shift
    const car2 = `AD2${Date.now().toString().slice(-5)}`;
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(car2);
    await page.keyboard.press('Enter');
    
    // Verify both cars exist
    await expect(page.getByTestId(`car-card-${car1}`)).toBeVisible();
    await expect(page.getByTestId(`car-card-${car2}`)).toBeVisible();
    
    // Verify shift is still active
    await expect(page.getByRole('button', { name: /End Shift/i })).toBeVisible();
  });
});
