import { test, expect } from '@playwright/test';

/**
 * Screenshot automation for different dashboard views
 * These tests capture screenshots of the tree, network, and timeline views
 * for visual testing and iteration purposes.
 */

test.describe('Dashboard View Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('/');
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('capture hierarchical tree view', async ({ page }) => {
    // Click the Tree button (ViewSwitcher uses "Tree" label)
    const treeButton = page.getByRole('button', { name: 'Tree' });
    if (await treeButton.count() > 0) {
      await treeButton.click();
      await page.waitForTimeout(1000); // Allow time for animation
    }

    // Capture full page screenshot
    await page.screenshot({
      path: 'tests/screenshots/tree-view.png',
      fullPage: true
    });

    // Verify the view rendered something
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('capture network view', async ({ page }) => {
    // Click the Network button
    const networkButton = page.getByRole('button', { name: 'Network' });
    if (await networkButton.count() > 0) {
      await networkButton.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'tests/screenshots/network-view.png',
      fullPage: true
    });

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('capture timeline view', async ({ page }) => {
    // Click the Timeline button
    const timelineButton = page.getByRole('button', { name: 'Timeline' });
    if (await timelineButton.count() > 0) {
      await timelineButton.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'tests/screenshots/timeline-view.png',
      fullPage: true
    });

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('capture all views in sequence', async ({ page }) => {
    // This test captures all views in one go for comparison
    const views = [
      { name: 'tree', label: 'Tree' },
      { name: 'network', label: 'Network' },
      { name: 'timeline', label: 'Timeline' },
    ];

    for (const view of views) {
      // Try to find and click the button (with error handling)
      try {
        const button = page.getByRole('button', { name: view.label });
        if (await button.count() > 0) {
          await button.click();
          await page.waitForTimeout(2000);

          // Capture the screenshot
          await page.screenshot({
            path: `tests/screenshots/sequence-${view.name}.png`,
            fullPage: true
          });
        }
      } catch {
        // Skip if button not found - might be a different dashboard page
        console.log(`Skipping ${view.name} view - button not found`);
      }
    }

    // Verify basic content is present
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});
