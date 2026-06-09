import { test, expect } from '@playwright/test';

test.describe('Legend', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.legend');
  });

  test('legend is visible', async ({ page }) => {
    await expect(page.locator('.legend')).toBeVisible();
  });

  test('legend has a header', async ({ page }) => {
    await expect(page.locator('.legend h4')).toHaveText('Legend');
  });

  test('legend contains modal filter entry', async ({ page }) => {
    await expect(page.locator('#ModalFilters-legend')).toBeVisible();
  });

  test('legend contains LTN entry', async ({ page }) => {
    await expect(page.locator('#LtnCells-legend')).toBeVisible();
  });

  test('legend contains mobility lane entry', async ({ page }) => {
    await expect(page.locator('#MobilityLanes-legend')).toBeVisible();
  });

  test('clicking a legend entry toggles layer visibility', async ({ page }) => {
    const legendEntry = page.locator('#ModalFilters-legend');
    await legendEntry.click();
    await expect(legendEntry).toHaveClass(/disabled/);

    // Click again to re-enable
    await legendEntry.click();
    await expect(legendEntry).not.toHaveClass(/disabled/);
  });
});
