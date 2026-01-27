import { expect, test } from '@playwright/test';
import { clearDatabase } from './helpers/db-cleanup.js';

test.describe('Car Management', () => {
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

  test('should add a car and verify all default properties', async ({ page }) => {
    const carId = `CAR${Date.now().toString().slice(-6)}`;
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    const carCard = page.getByTestId(`car-card-${carId}`);
    await expect(carCard).toBeVisible();
    await expect(carCard).toContainText(`#${carId}`);
    await expect(carCard.getByText('Pending')).toBeVisible();
    await expect(carCard.locator('select')).toHaveValue('Yard');
    await expect(carCard.getByRole('button', { name: /Mark Arrived/i })).toBeVisible();
    await expect(carCard.getByRole('button', { name: /Mark Empty/i })).toBeDisabled();
  });

  test('should complete full car workflow: add → arrived → empty', async ({ page }) => {
    const carId = `WF${Date.now().toString().slice(-6)}`;
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    const carCard = page.getByTestId(`car-card-${carId}`);
    await expect(carCard).toBeVisible();
    await carCard.getByRole('button', { name: /Mark Arrived/i }).click();
    await expect(carCard.getByText('On Site')).toBeVisible();
    const emptyBtn = carCard.getByRole('button', { name: /Mark Empty/i });
    await expect(emptyBtn).toBeEnabled();
    await emptyBtn.click();
    await expect(carCard.getByText('Completed')).toBeVisible();
  });

  test('should update car location through dropdown', async ({ page }) => {
    const carId = `LOC${Date.now().toString().slice(-6)}`;
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    const carCard = page.getByTestId(`car-card-${carId}`);
    const locationSelect = carCard.locator('select');
    await expect(locationSelect).toHaveValue('Yard');
    await locationSelect.selectOption('200');
    await expect(locationSelect).toHaveValue('200');
    await locationSelect.selectOption('Shop');
    await expect(locationSelect).toHaveValue('Shop');
    await page.reload();
    const carCardAfterReload = page.getByTestId(`car-card-${carId}`);
    await expect(carCardAfterReload.locator('select')).toHaveValue('Shop');
  });

  test('should remove car in manage mode', async ({ page }) => {
    const carId = `DEL${Date.now().toString().slice(-6)}`;
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    const carCard = page.getByTestId(`car-card-${carId}`);
    await expect(carCard).toBeVisible();
    await page.getByRole('button', { name: 'Manage Fleet' }).click();
    page.once('dialog', dialog => dialog.accept());
    await carCard.getByRole('button', { name: `Remove car ${carId}` }).click();
    await expect(carCard).not.toBeVisible();
    await page.getByRole('button', { name: /Close Fleet Manager/i }).click();
  });

  test('should add multiple cars and verify order', async ({ page }) => {
    const car1 = `A${Date.now().toString().slice(-6)}`;
    const car2 = `B${Date.now().toString().slice(-5)}`;
    const car3 = `C${Date.now().toString().slice(-4)}`;
    for (const carId of [car1, car2, car3]) {
      await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
      await page.keyboard.press('Enter');
      await page.getByTestId(`car-card-${carId}`).waitFor({ state: 'visible' });
    }
    await expect(page.getByTestId(`car-card-${car1}`)).toBeVisible();
    await expect(page.getByTestId(`car-card-${car2}`)).toBeVisible();
    await expect(page.getByTestId(`car-card-${car3}`)).toBeVisible();
  });

  test('should persist car data after page reload', async ({ page }) => {
    const carId = `PER${Date.now().toString().slice(-6)}`;
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    const carCard = page.getByTestId(`car-card-${carId}`);
    await carCard.getByRole('button', { name: /Mark Arrived/i }).click();
    await expect(carCard.getByText('On Site')).toBeVisible();
    await carCard.locator('select').selectOption('300');
    await expect(carCard.locator('select')).toHaveValue('300', { timeout: 10000 });
    
    await expect(async () => {
      const val = await page.evaluate(async (id) => {
        const res = await fetch(`/api/cars/${id}`, {
            headers: { 'X-API-Key': 'test-api-key' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        // FIX: Access nested car object
        return data.car ? data.car.location : null;
      }, carId);
      if (val !== '300') throw new Error(`Location not updated yet: ${val}`);
    }).toPass({ timeout: 10000 });

    await page.reload();
    await expect(page.locator('h1')).toContainText('Package Car Tracker');
    const reloadedCard = page.getByTestId(`car-card-${carId}`);
    await expect(reloadedCard).toBeVisible();
    await expect(reloadedCard.getByText('On Site')).toBeVisible();
    await expect(reloadedCard.locator('select')).toHaveValue('300');
  });

  test('should mark car as late when flag is set', async ({ page }) => {
    // Changed prefix to avoid strict mode violation
    const carId = `DLAY${Date.now().toString().slice(-6)}`;
    await page.evaluate(async (id) => {
      const res = await fetch('/api/cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-api-key' },
        body: JSON.stringify({ id, location: 'Yard', userId: 'test-user' })
      });
      if (!res.ok) throw new Error('Failed to create car');
    }, carId);
    await page.reload();
    await expect(page.getByTestId(`car-card-${carId}`)).toBeVisible();

    await page.evaluate(async (id) => {
      for (let i = 0; i < 20; i++) {
        const res = await fetch(`/api/cars/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-api-key' },
          body: JSON.stringify({ late: true })
        });
        if (res.ok) return;
        if (res.status !== 404) throw new Error(`Failed to set late flag: ${res.status}`);
        await new Promise(r => setTimeout(r, 500));
      }
      throw new Error('Failed to set late flag: 404 after retries');
    }, carId);
    
    const lateCard = page.getByTestId(`car-card-${carId}`);
    await expect(lateCard.locator('.bg-red-50').getByText('LATE')).toBeVisible();
  });

  test('should toggle car states back and forth', async ({ page }) => {
    const carId = `TOG${Date.now().toString().slice(-6)}`;
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    const carCard = page.getByTestId(`car-card-${carId}`);
    await carCard.getByRole('button', { name: /Mark Arrived/i }).click();
    await expect(carCard.getByText('On Site')).toBeVisible();
    await carCard.getByRole('button', { name: /^Arrived$/i }).click();
    await expect(carCard.getByText('Pending')).toBeVisible();
    await carCard.getByRole('button', { name: /Mark Arrived/i }).click();
    await expect(carCard.getByText('On Site')).toBeVisible();
    await carCard.getByRole('button', { name: /Mark Empty/i }).click();
    await expect(carCard.getByText('Completed')).toBeVisible();
    await carCard.getByRole('button', { name: /Empty/i }).click();
    await expect(carCard.getByText('On Site')).toBeVisible();
  });

  test('should show view history button and open drawer', async ({ page }) => {
    const carId = `HIST${Date.now().toString().slice(-6)}`;
    await page.getByPlaceholder(/Add ID/i).pressSequentially(carId);
    await page.keyboard.press('Enter');
    const carCard = page.getByTestId(`car-card-${carId}`);
    const historyBtn = carCard.getByRole('button', { name: /View history for this car/i });
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();
    const drawer = page.locator('[role="dialog"], [class*="drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(/Audit Log/i);
    await expect(drawer).toContainText(carId);
    await page.getByRole('button', { name: /Close/i }).first().click();
    await expect(drawer).not.toBeVisible();
  });
});
