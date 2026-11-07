import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

const transparentPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
);

test.describe('Satellite view toggle', () => {
    test.beforeEach(async ({ page }) => {
        await page.route(/google\.com\/vt/, (route) =>
            route.fulfill({ contentType: 'image/png', body: transparentPng })
        );
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.addStyleTag({ content: '#help { display: none !important; }' });
        await page.waitForSelector('#satellite-view-button');
    });

    test('switches the base map to Google satellite tiles and back', async ({ page }) => {
        const button = page.locator('#satellite-view-button');
        const tiles = page.locator('#map .leaflet-tile-pane img.leaflet-tile');

        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(tiles.first()).toHaveAttribute('src', /tile\.openstreetmap\.fr/);

        await button.click();

        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await expect(button).toHaveAttribute('title', 'Switch to street map view');
        await expect(tiles.first()).toHaveAttribute('src', /mt\d\.google\.com\/vt\/lyrs=s/);
        await expect(page.locator('#map img.leaflet-tile[src*="openstreetmap"]')).toHaveCount(0);
        await expect(page.locator('.leaflet-control-attribution')).toContainText('Google');

        await button.click();

        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(tiles.first()).toHaveAttribute('src', /tile\.openstreetmap\.fr/);
        await expect(page.locator('#map img.leaflet-tile[src*="google.com"]')).toHaveCount(0);
    });
});
