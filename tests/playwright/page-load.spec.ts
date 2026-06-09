import { test, expect } from '@playwright/test';

test.describe('Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Safer Street Maker');
  });

  test('map container is present', async ({ page }) => {
    const map = page.locator('#map');
    await expect(map).toBeVisible();
  });

  test('Leaflet map is initialised', async ({ page }) => {
    // Leaflet adds .leaflet-container to the map div
    const leafletContainer = page.locator('.leaflet-container');
    await expect(leafletContainer).toBeVisible();
  });

  test('OpenStreetMap tile layer is loaded', async ({ page }) => {
    // Leaflet renders tiles inside .leaflet-tile-pane
    const tilePane = page.locator('.leaflet-tile-pane');
    await expect(tilePane).toBeAttached();
  });
});
