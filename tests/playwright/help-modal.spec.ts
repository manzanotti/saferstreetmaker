import { test, expect } from '@playwright/test';

test.describe('Help Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.toolbar');
  });

  test('help modal is hidden on load', async ({ page }) => {
    const helpModal = page.locator('#help');
    await expect(helpModal).toHaveClass(/fadeOut/);
  });

  test('clicking help button shows the help modal', async ({ page }) => {
    await page.locator('#help-button').click();
    const helpModal = page.locator('#help');
    await expect(helpModal).toHaveClass(/fadeIn/);
    await expect(helpModal).not.toHaveClass(/fadeOut/);
  });

  test('clicking help button a second time hides the help modal', async ({ page }) => {
    const helpButton = page.locator('#help-button');
    await helpButton.click(); // open
    await helpButton.click(); // close
    const helpModal = page.locator('#help');
    await expect(helpModal).toHaveClass(/fadeOut/);
  });

  test('help modal contains welcome text', async ({ page }) => {
    await page.locator('#help-button').click();
    await expect(page.locator('#tabs-home')).toContainText('Welcome to the Safer Street Maker');
  });
});
