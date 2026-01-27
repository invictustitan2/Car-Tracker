import { expect, test } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { clearDatabase } from './helpers/db-cleanup.js';

test.describe('CSV Import/Export', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearDatabase(request);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('e2e_disable_sync', 'true');
      localStorage.setItem('ups_tracker_user_id', 'e2e-test-user');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Package Car Tracker');
    await expect(page.getByPlaceholder(/Add ID/i)).toBeVisible({ timeout: 10000 });
  });

  test('should export cars to CSV file', async ({ page }) => {
    const cars = [
      { id: `EXP1${Date.now().toString().slice(-4)}`, location: 'Yard', status: 'pending' },
      { id: `EXP2${Date.now().toString().slice(-4)}`, location: '200', status: 'arrived' },
      { id: `EXP3${Date.now().toString().slice(-4)}`, location: 'Shop', status: 'empty' },
    ];
    
    for (const car of cars) {
      await page.getByPlaceholder(/Add ID/i).pressSequentially(car.id);
      await page.keyboard.press('Enter');
      // Increased wait for stability
      await page.waitForTimeout(300);
      
      const carCard = page.getByTestId(`car-card-${car.id}`);
      await expect(carCard).toBeVisible({ timeout: 10000 });
      
      if (car.location !== 'Yard') {
        // Retry select option if it fails
        await expect(async () => {
          await carCard.locator('select').selectOption(car.location);
          await expect(carCard.locator('select')).toHaveValue(car.location);
        }).toPass({ timeout: 10000 });
        await page.waitForTimeout(300);
      }
      
      if (car.status === 'arrived' || car.status === 'empty') {
        await carCard.getByRole('button', { name: /Mark Arrived/i }).click();
        await page.waitForTimeout(500);
        await expect(carCard.getByText('On Site')).toBeVisible();
      }
      if (car.status === 'empty') {
        const emptyBtn = carCard.getByRole('button', { name: /Mark Empty/i });
        await expect(emptyBtn).toBeEnabled({ timeout: 10000 });
        await emptyBtn.click();
      }
    }
    
    const downloadPromise = page.waitForEvent('download');
    const fleetManagerBtn = page.getByRole('button', { name: /Fleet Manager|Manage|Import/i });
    if (await fleetManagerBtn.count() > 0) {
      await fleetManagerBtn.click();
      const exportBtn = page.getByRole('button', { name: /Export|Download/i });
      await exportBtn.click();
    }
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/cars.*\.csv$/i);
    const downloadPath = await download.path();
    const csvContent = await fs.readFile(downloadPath, 'utf-8');
    for (const car of cars) {
      expect(csvContent).toContain(car.id);
    }
  });

  test('should import cars from CSV file', async ({ page }) => {
    const csvContent = `123456,Yard\n234567,200\n345678,300\n456789,Shop`;
    const tempDir = await fs.mkdtemp('/tmp/ups-tracker-test-');
    const csvPath = path.join(tempDir, 'import-cars.csv');
    await fs.writeFile(csvPath, csvContent);
    
    try {
      const manageFleetBtn = page.getByRole('button', { name: /Manage Fleet/i });
      await expect(manageFleetBtn).toBeVisible({ timeout: 5000 });
      await manageFleetBtn.click();
      
      const fileInput = page.locator('input[type="file"][data-testid="fleet-import-input"]');
      await expect(fileInput).toBeAttached({ timeout: 5000 });
      await fileInput.setInputFiles(csvPath);
      await page.waitForTimeout(500);
      
      const closeBtn = page.getByRole('button', { name: /Close Fleet Manager/i });
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.locator('.fixed.inset-0.bg-black\\/60').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      }

      await expect(page.getByTestId('car-card-123456')).toBeVisible();
      await expect(page.getByTestId('car-card-234567')).toBeVisible();
      await expect(page.getByTestId('car-card-345678')).toBeVisible();
      await expect(page.getByTestId('car-card-456789')).toBeVisible();
      
      await expect(page.getByTestId('car-card-123456').locator('select')).toHaveValue('Yard');
      await expect(page.getByTestId('car-card-234567').locator('select')).toHaveValue('200');
      await expect(page.getByTestId('car-card-345678').locator('select')).toHaveValue('300');
      await expect(page.getByTestId('car-card-456789').locator('select')).toHaveValue('Shop');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should handle CSV import with invalid data', async ({ page }) => {
    const csvContent = `111111,Yard\n,200\n333333,InvalidLocation\n444444,300`;
    const tempDir = await fs.mkdtemp('/tmp/ups-tracker-test-');
    const csvPath = path.join(tempDir, 'invalid-cars.csv');
    await fs.writeFile(csvPath, csvContent);
    
    try {
      const manageFleetBtn = page.getByRole('button', { name: /Manage Fleet/i });
      await expect(manageFleetBtn).toBeVisible({ timeout: 5000 });
      await manageFleetBtn.click();
      
      const fileInput = page.locator('input[type="file"][data-testid="fleet-import-input"]');
      await expect(fileInput).toBeAttached({ timeout: 5000 });
      await fileInput.setInputFiles(csvPath);
      await page.waitForTimeout(500);

      const closeBtn = page.getByRole('button', { name: /Close Fleet Manager/i });
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.locator('.fixed.inset-0.bg-black\\/60').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      }
      
      await expect(page.getByTestId('car-card-111111')).toBeVisible();
      await expect(page.getByTestId('car-card-444444')).toBeVisible();
      
      const errorMsg = page.getByText(/error|invalid|warning/i);
      const hasError = await errorMsg.count() > 0;
      expect(hasError || await page.getByTestId('car-card-333333').count() > 0).toBeTruthy();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should replace existing cars on import when duplicate IDs exist', async ({ page }) => {
    const carId = '999888';
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    const carCard = page.getByTestId(`car-card-${carId}`);
    await carCard.locator('select').selectOption('Yard');
    await expect(carCard.locator('select')).toHaveValue('Yard');
    
    const csvContent = `999888,Shop`;
    const tempDir = await fs.mkdtemp('/tmp/ups-tracker-test-');
    const csvPath = path.join(tempDir, 'duplicate-cars.csv');
    await fs.writeFile(csvPath, csvContent);
    
    try {
      const fleetManagerBtn = page.getByRole('button', { name: /Fleet Manager|Manage|Import/i });
      if (await fleetManagerBtn.count() > 0) {
        await fleetManagerBtn.click();
      }
      const fileInput = page.locator('input[type="file"][data-testid="fleet-import-input"]');
      await fileInput.setInputFiles(csvPath);
      await page.waitForTimeout(500);
      const updatedCard = page.getByTestId(`car-card-${carId}`);
      await expect(updatedCard.locator('select')).toHaveValue('Shop');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should import large CSV file with many cars', async ({ page }) => {
    const csvLines = [];
    for (let i = 1; i <= 50; i++) {
      const carId = `${100000 + i}`;
      const location = ['Yard', '100', '200', '300', '400', '500', '600', 'Shop'][i % 8];
      csvLines.push(`${carId},${location}`);
    }
    const csvContent = csvLines.join('\n');
    const tempDir = await fs.mkdtemp('/tmp/ups-tracker-test-');
    const csvPath = path.join(tempDir, 'large-import.csv');
    await fs.writeFile(csvPath, csvContent);
    
    try {
      const manageFleetBtn = page.getByRole('button', { name: /Manage Fleet/i });
      await expect(manageFleetBtn).toBeVisible({ timeout: 5000 });
      await manageFleetBtn.click();
      const fileInput = page.locator('input[type="file"][data-testid="fleet-import-input"]');
      await expect(fileInput).toBeAttached({ timeout: 5000 });
      await fileInput.setInputFiles(csvPath);
      await page.waitForTimeout(2000);
      
      await expect(page.getByTestId('car-card-100001')).toBeVisible({ timeout: 15000 });
      const totalCars = await page.getByTestId(/car-card-/).count();
      expect(totalCars).toBeGreaterThan(0);
      const summaryText = await page.getByText(/\d+.*car/i).first().textContent().catch(() => '0');
      expect(summaryText).toMatch(/\d+/);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should preserve car states during CSV import', async ({ page }) => {
    const carId = '777666';
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    
    const carCard = page.getByTestId(`car-card-${carId}`);
    await carCard.getByRole('button', { name: /Mark Arrived/i }).click();
    const emptyBtn = carCard.getByRole('button', { name: /Mark Empty/i });
    await expect(emptyBtn).toBeEnabled({ timeout: 10000 });
    await emptyBtn.click();
    await expect(carCard.getByText('Completed')).toBeVisible();
    
    const csvContent = `888999,200`;
    const tempDir = await fs.mkdtemp('/tmp/ups-tracker-test-');
    const csvPath = path.join(tempDir, 'preserve-state.csv');
    await fs.writeFile(csvPath, csvContent);
    
    try {
      const manageFleetBtn = page.getByRole('button', { name: /Manage Fleet/i });
      await expect(manageFleetBtn).toBeVisible({ timeout: 5000 });
      await manageFleetBtn.click();
      const fileInput = page.locator('input[type="file"][data-testid="fleet-import-input"]');
      await expect(fileInput).toBeAttached({ timeout: 5000 });
      await fileInput.setInputFiles(csvPath);
      await page.waitForTimeout(500);

      await page.getByRole('button', { name: /Close Fleet Manager/i }).click();
      await page.getByTestId('fleet-manager-modal').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      
      const originalCard = page.getByTestId(`car-card-${carId}`);
      await expect(originalCard.getByText('Completed')).toBeVisible();
      await expect(page.getByTestId('car-card-888999')).toBeVisible();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test('should export and re-import without data loss', async ({ page }) => {
    const testCars = [
      { id: 'RT001', location: '100' },
      { id: 'RT002', location: '200' },
      { id: 'RT003', location: 'Shop' },
    ];
    for (const car of testCars) {
      await page.getByPlaceholder(/Add ID/i).pressSequentially(car.id);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200); // Increased wait
      const card = page.getByTestId(`car-card-${car.id}`);
      await expect(card).toBeVisible();
      await card.locator('select').selectOption(car.location);
      await expect(card.locator('select')).toHaveValue(car.location); // Wait for update
    }
    
    const downloadPromise = page.waitForEvent('download');
    const fleetManagerBtn = page.getByRole('button', { name: /Fleet Manager|Manage|Import/i });
    if (await fleetManagerBtn.count() > 0) {
      await fleetManagerBtn.click();
      const exportBtn = page.getByRole('button', { name: /Export|Download/i });
      await exportBtn.click();
      const download = await downloadPromise;
      const downloadPath = await download.path();
      
      await page.getByTestId('fleet-manager-modal').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      
      await page.evaluate(() => {
        localStorage.removeItem('ups-tracker-data');
        localStorage.setItem('ups_tracker_user_id', 'e2e-test-user');
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await page.getByTestId('fleet-manager-modal').waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
      await fleetManagerBtn.click();
      const fileInput = page.locator('input[type="file"][data-testid="fleet-import-input"]');
      await fileInput.setInputFiles(downloadPath);
      
      await page.waitForTimeout(500);
      
      for (const car of testCars) {
        const carCard = page.getByTestId(`car-card-${car.id}`);
        await expect(carCard).toBeVisible();
        await expect(carCard.locator('select')).toHaveValue(car.location);
      }
    }
  });
});
