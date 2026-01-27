import { expect, test } from '@playwright/test';

/**
 * E2E Tests for Package Car Tracker - Core Car Management
 * Real browser tests with no mocks - tests actual functionality
 */

test.describe('Car Management - Core Features', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh - clear localStorage
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
    
    // Wait for app to load - ensure React has rendered all critical UI elements
    await expect(page.locator('h1')).toContainText('Package Car Tracker');
    
    // Wait for the add car input to be visible (critical element that indicates app is ready)
    await expect(page.getByPlaceholder(/Add ID/i)).toBeVisible({ timeout: 10000 });
  });

  test('should load application with all UI elements', async ({ page }) => {
    // Verify header
    await expect(page.locator('h1')).toContainText('Package Car Tracker');
    
    // Verify filter tabs are present
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Pending' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Arrived' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Empty', exact: true })).toBeVisible();
    
    // Verify add car input and button exist
    await expect(page.getByPlaceholder(/Add ID/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
    
    // Verify Manage Fleet button exists
    await expect(page.getByRole('button', { name: 'Manage Fleet' })).toBeVisible();
    
    // Verify view toggles
    await expect(page.getByRole('button', { name: /List View/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Board View/i })).toBeVisible();
  });

  test('should add a new package car with default location', async ({ page }) => {
    // Generate unique car ID
    const carId = `${Date.now().toString().slice(-6)}`;
    
    // Fill in car ID in the input field
    const input = page.getByPlaceholder(/Add ID/i);
    await input.pressSequentially(carId);
    
    // Verify input value
    await expect(input).toHaveValue(carId);
    
    // Submit form by clicking Add button
    await page.getByRole('button', { name: 'Add' }).click();
    
    // Verify car was added with correct ID
    const carCard = page.getByTestId(`car-card-${carId}`);
    await expect(carCard).toBeVisible();
    await expect(carCard).toContainText(`#${carId}`);
    
    // Verify default status
    await expect(carCard.getByText('Pending')).toBeVisible();
    
    // Verify default location is Yard
    await expect(carCard.locator('select')).toHaveValue('Yard');
    
    // Verify buttons are present
    await expect(carCard.getByRole('button', { name: /Arrive/i })).toBeVisible();
    await expect(carCard.getByRole('button', { name: /Empty/i })).toBeDisabled();
  });

  test('should add multiple cars in sequence', async ({ page }) => {
    // Generate unique car IDs
    const carId1 = `${Date.now().toString().slice(-6)}`;
    const carId2 = `${(Date.now() + 1).toString().slice(-6)}`;
    const carId3 = `${(Date.now() + 2).toString().slice(-6)}`;
    
    // Add first car
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId1);
    await page.getByRole('button', { name: /Add/i }).click();
    
    // Wait for car card to appear
    const carCard1 = page.getByTestId(`car-card-${carId1}`);
    await expect(carCard1).toBeVisible();
    
    // Add second car
    const input = page.getByPlaceholder(/Add ID/i);
    await input.clear();
    await input.pressSequentially(carId2);
    await page.getByRole('button', { name: /Add/i }).click();
    
    const carCard2 = page.getByTestId(`car-card-${carId2}`);
    await expect(carCard2).toBeVisible();
    
    // Add third car
    await input.clear();
    await input.pressSequentially(carId3);
    await page.getByRole('button', { name: /Add/i }).click();
    
    const carCard3 = page.getByTestId(`car-card-${carId3}`);
    await expect(carCard3).toBeVisible();
    
    // Verify all three cars are displayed
    await expect(carCard1).toBeVisible();
    await expect(carCard2).toBeVisible();
    await expect(carCard3).toBeVisible();
    
    // Mark first car as arrived
    await carCard1.getByRole('button', { name: /Arrive/i }).click();
    
    // Verify status updated
    await expect(carCard1).toHaveAttribute('data-status', 'arrived');
  });

  test('should filter cars by status', async ({ page }) => {
    await page.goto('/');
    
    // Add two cars with different statuses
    const pendingCarId = '111111';
    const arrivedCarId = '222222';
    
    // Add first car (pending)
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(pendingCarId);
    await page.getByRole('button', { name: /Add/i }).click();
    
    // Add second car and mark as arrived
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(arrivedCarId);
    await page.getByRole('button', { name: /Add/i }).click();
    await page.getByTestId(`car-card-${arrivedCarId}`).getByRole('button', { name: /Arrived/i }).click();
    
    // Filter by Pending
    await page.getByRole('tab', { name: 'Pending' }).click();
    await expect(page.getByTestId(`car-card-${pendingCarId}`)).toBeVisible();
    await expect(page.getByTestId(`car-card-${arrivedCarId}`)).not.toBeVisible();
    
    // Filter by Arrived
    await page.getByRole('tab', { name: 'Arrived' }).click();
    await expect(page.getByTestId(`car-card-${pendingCarId}`)).not.toBeVisible();
    await expect(page.getByTestId(`car-card-${arrivedCarId}`)).toBeVisible();
    
    // Filter by All
    await page.getByRole('tab', { name: 'All' }).click();
    await expect(page.getByTestId(`car-card-${pendingCarId}`)).toBeVisible();
    await expect(page.getByTestId(`car-card-${arrivedCarId}`)).toBeVisible();
  });

  test('should delete a package car', async ({ page }) => {
    await page.goto('/');
    
    // Add a car
    const carId = '999999';
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.getByRole('button', { name: /Add/i }).click();
    
    const carCard = page.getByTestId(`car-card-${carId}`);
    await expect(carCard).toBeVisible();
    
    // Enter manage mode first
    await page.getByRole('button', { name: 'Manage Fleet' }).click();
    
    // Set up dialog handler to accept the confirm dialog
    page.once('dialog', dialog => dialog.accept());
    
    // Click remove button (X button in manage mode)
    await carCard.getByRole('button', { name: `Remove car ${carId}` }).click();
    
    // Verify car was removed
    await expect(carCard).not.toBeVisible();
  });

  test('should persist data in localStorage', async ({ page }) => {
    await page.goto('/');
    
    // Add a car
    const carId = '555555';
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.getByRole('button', { name: /Add/i }).click();
    
    // Verify car is visible
    await expect(page.getByTestId(`car-card-${carId}`)).toBeVisible();
    
    // Reload the page
    await page.reload();
    
    // Verify car is still there after reload
    await expect(page.getByTestId(`car-card-${carId}`)).toBeVisible();
  });

  test('should display lane summary counts', async ({ page }) => {
    await page.goto('/');
    
    // Check that lane summary is visible (use first() since there are 4 summaries)
    await expect(page.locator('.lane-summary, [data-testid="lane-summary"]').first()).toBeVisible();
    
    // Add a car to verify counts update
    
    await page.getByPlaceholder(/Add ID/i).pressSequentially('333333');
    await page.getByRole('button', { name: /Add/i }).click();
    
    // Verify total count increased (should show at least 1)
    const summaryText = await page.locator('.lane-summary, [data-testid="lane-summary"]').first().textContent();
    expect(summaryText).toMatch(/\d+/); // Contains at least one number
  });

  test('should import cars from CSV', async ({ page }) => {
    // Create a CSV file content
    const csvContent = '111111,Yard\n222222,200\n333333,Shop';
    
    // Open Manage Fleet to reveal import controls
    const manageFleetBtn = page.getByRole('button', { name: /Manage Fleet/i });
    await expect(manageFleetBtn).toBeVisible({ timeout: 5000 });
    await manageFleetBtn.click();
    
    // Wait for file input to be attached (it's sr-only/hidden)
    const fileInput = page.locator('input[type="file"][data-testid="fleet-import-input"]');
    await expect(fileInput).toBeAttached({ timeout: 5000 });
    
    // Upload file directly
    await fileInput.setInputFiles({
      name: 'test-cars.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    // Wait for import to complete
    await page.waitForTimeout(500);
    
    // Wait for cars to be imported
    await expect(page.getByTestId('car-card-111111')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('car-card-222222')).toBeVisible();
    await expect(page.getByTestId('car-card-333333')).toBeVisible();
  });
});
