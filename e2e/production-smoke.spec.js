import { expect, test } from '@playwright/test';

test.describe('Production Smoke Tests @smoke', () => {
  test('Homepage loads and shows critical elements', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/UPS Package Car Tracker/);
    await expect(page.getByRole('heading', { name: 'Package Car Tracker' })).toBeVisible();
  });

  test('Can view dashboard elements', async ({ page }) => {
    await page.goto('/');
    // Check for static dashboard elements that should always be present
    await expect(page.getByRole('heading', { name: 'Shift Summary' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Filters' })).toBeVisible();
    
    // Check that we have either cars OR empty state indicators
    // This ensures the board rendered, even if empty
    const hasCars = await page.locator('.car-card').count() > 0;
    const hasEmptyStates = await page.getByText('Empty', { exact: true }).count() > 0;
    
    expect(hasCars || hasEmptyStates).toBeTruthy();
  });
});
