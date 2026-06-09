import { test, expect } from '@playwright/test';

test.describe('Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the toolbar to be rendered by Leaflet
    await page.waitForSelector('.toolbar');
  });

  test('toolbar is visible', async ({ page }) => {
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('help button is present', async ({ page }) => {
    await expect(page.locator('#help-button')).toBeVisible();
  });

  test('settings button is present', async ({ page }) => {
    await expect(page.locator('#settings-button')).toBeVisible();
  });

  test('map manager button is present', async ({ page }) => {
    await expect(page.locator('#map-manager-button')).toBeVisible();
  });

  test('share button is present', async ({ page }) => {
    await expect(page.locator('#share-button')).toBeVisible();
  });

  test('modal filter layer button is present', async ({ page }) => {
    await expect(page.locator('#modal-filter-button')).toBeVisible();
  });

  test('mobility lane button is present', async ({ page }) => {
    await expect(page.locator('#mobility-lane-button')).toBeVisible();
  });

  test('car free street button is present', async ({ page }) => {
    await expect(page.locator('#car-free-street-button')).toBeVisible();
  });

  test('school street button is present', async ({ page }) => {
    await expect(page.locator('#school-street-button')).toBeVisible();
  });
});
