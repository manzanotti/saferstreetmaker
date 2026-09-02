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

    test('initializes the map before the optional ward layer finishes loading', async ({
        page
    }) => {
        let releaseWards!: () => void;
        const wardsBlocked = new Promise<void>((resolve) => {
            releaseWards = resolve;
        });
        await page.route('**/Birmingham%20Wards.geojson', async (route) => {
            await wardsBlocked;
            await route.fulfill({
                contentType: 'application/geo+json',
                body: JSON.stringify({
                    type: 'FeatureCollection',
                    features: []
                })
            });
        });
        await page.goto('/');

        await expect(page.locator('#map')).toBeVisible();
        await expect(page.locator('.toolbar')).toBeVisible();
        releaseWards();
    });
});
