import { test, expect } from '@playwright/test';

test.describe('Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.toolbar');
  });

  test('settings panel is not visible on load', async ({ page }) => {
    // The settings panel contains a unique #read-only checkbox
    await expect(page.locator('#read-only')).not.toBeAttached();
  });

  test('clicking settings button opens the settings panel', async ({ page }) => {
    await page.locator('#settings-button').click();
    await expect(page.locator('#read-only')).toBeVisible();
  });

  test('clicking settings button a second time closes the settings panel', async ({ page }) => {
    const settingsButton = page.locator('#settings-button');
    await settingsButton.click(); // open
    await expect(page.locator('#read-only')).toBeVisible();
    await settingsButton.click(); // close
    await expect(page.locator('#read-only')).not.toBeAttached();
  });
});

test.describe('Map Manager Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.toolbar');
  });

  test('map manager panel is not visible on load', async ({ page }) => {
    await expect(page.locator('#map-manager')).not.toBeAttached();
  });

  test('clicking map manager button opens the panel', async ({ page }) => {
    await page.locator('#map-manager-button').click();
    await expect(page.locator('#map-manager')).toBeVisible();
  });

  test('clicking map manager button a second time closes the panel', async ({ page }) => {
    const button = page.locator('#map-manager-button');
    await button.click(); // open
    await expect(page.locator('#map-manager')).toBeVisible();
    await button.click(); // close
    await expect(page.locator('#map-manager')).not.toBeAttached();
  });
});

test.describe('Sharing Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.toolbar');
  });

  test('sharing panel is not visible on load', async ({ page }) => {
    await expect(page.locator('#sharing')).not.toBeAttached();
  });

  test('clicking share button opens the sharing panel', async ({ page }) => {
    await page.locator('#share-button').click();
    await expect(page.locator('#sharing')).toBeVisible();
  });

  test('clicking share button a second time closes the sharing panel', async ({ page }) => {
    const button = page.locator('#share-button');
    await button.click(); // open
    await expect(page.locator('#sharing')).toBeVisible();
    await button.click(); // close
    await expect(page.locator('#sharing')).not.toBeAttached();
  });
});
