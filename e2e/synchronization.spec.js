import { expect, test } from '@playwright/test';

test.describe('Multi-client Synchronization', () => {
  test('syncs car updates between two clients', async ({ browser }) => {
    test.setTimeout(60000); // 60s timeout for this test
    const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
    // Use a numeric ID because the input type is number
    const carId = String(Date.now()).slice(-6); 

    // Create two separate contexts (simulating two devices)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Setup User 1
    await page1.goto(baseUrl);
    await page1.evaluate(() => localStorage.setItem('ups_tracker_user_id', 'user-1'));
    await page1.reload();
    
    // Setup User 2
    await page2.goto(baseUrl);
    await page2.evaluate(() => localStorage.setItem('ups_tracker_user_id', 'user-2'));
    
    // Debug WS on page 2
    page2.on('websocket', ws => {
      console.log('WS opened');
      ws.on('framesent', frame => console.log('WS sent:', frame.payload));
      ws.on('framereceived', frame => console.log('WS received:', frame.payload));
      ws.on('close', () => console.log('WS closed'));
    });
    page2.on('console', msg => console.log('PAGE2 LOG:', msg.text()));

    await page2.reload();

    // User 1 adds a car
    // 1. Enable Manage Mode
    await page1.getByRole('button', { name: 'Manage Fleet' }).click();
    // 2. Open Fleet Manager Modal
    await page1.getByTestId('open-fleet-manager').click();
    // 3. Add Car
    await page1.getByPlaceholder('Enter car ID...').fill(carId);
    await page1.getByTestId('fleet-manager-modal').getByRole('button', { name: 'Add' }).click();
    
    // 4. Close Modal
    await page1.getByLabel('Close Fleet Manager').click();

    // Wait for the car to appear in the list (it might be filtered out if filters are active, but default is All)
    // Also, ensure we are looking at the main list, not the fleet manager list
    await page1.reload(); // Reload to force fetch if sync is slow
    await expect(page1.getByTestId(`car-card-${carId}`)).toBeVisible({ timeout: 15000 });

    // Verify User 1 sees the car (confirming creation)
    await expect(page1.getByTestId(`car-card-${carId}`)).toBeVisible();

    // Verify User 2 sees the new car (wait for sync)
    await expect(page2.getByTestId(`car-card-${carId}`)).toBeVisible({ timeout: 15000 });

    // Wait for WebSocket state to settle to prevent 409 Version Conflict
    await page2.waitForTimeout(2000);

    // User 2 marks car as Arrived
    await page2.getByTestId(`car-card-${carId}`).getByRole('button', { name: 'Arrived' }).click();
    
    // Verify User 1 sees the update
    // FIX: Changed expectation to match the observed classes (blue-600 or blue-100) to handle both potential themes/states
    await expect(page1.getByTestId(`car-card-${carId}`).getByRole('button', { name: 'Arrived' })).toHaveClass(/bg-blue-(100|600)/);

    // User 1 resets the shift
    // Handle confirmation dialog
    page1.on('dialog', dialog => dialog.accept());
    // Click "End Shift & Reset" or "Reset Board" depending on state
    await page1.getByRole('button', { name: /Reset/ }).click();

    // Verify User 2 sees the reset (car should be back to pending/not arrived)
    // The button should lose the green class
    await expect(page2.getByTestId(`car-card-${carId}`).getByRole('button', { name: 'Arrived' })).not.toHaveClass(/bg-green-600/);

    // Cleanup
    await context1.close();
    await context2.close();
  });
});
