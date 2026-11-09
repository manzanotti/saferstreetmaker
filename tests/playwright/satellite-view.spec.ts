import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';
import { setMapZoom } from './layers/layerPointTestHelpers';
import { STREET_TILE_URL_PATTERN } from './tileTestHelpers';

const transparentPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
);

test.describe('Satellite view toggle', () => {
    test.beforeEach(async ({ page }) => {
        await page.route(STREET_TILE_URL_PATTERN, (route) =>
            route.fulfill({
                contentType: 'image/png',
                headers: { 'access-control-allow-origin': '*' },
                body: transparentPng
            })
        );
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
        const attribution = page.locator('#map .leaflet-control-attribution');

        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(tiles.first()).toHaveAttribute('src', STREET_TILE_URL_PATTERN);
        await expect(tiles.first()).toHaveAttribute('crossorigin', 'anonymous');
        await expect(attribution).toContainText('\u00a9 OpenStreetMap contributors');
        await expect(attribution.getByRole('link', { name: 'OpenStreetMap' })).toHaveAttribute(
            'href',
            'https://www.openstreetmap.org/copyright'
        );

        await button.click();

        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await expect(button).toHaveAttribute('title', 'Switch to street map view');
        await expect(tiles.first()).toHaveAttribute('src', /mt\d\.google\.com\/vt\/lyrs=s/);
        await expect(page.locator('#map img.leaflet-tile[src*="openstreetmap"]')).toHaveCount(0);
        await expect(page.locator('.leaflet-control-attribution')).toContainText('Google');

        await button.click();

        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(tiles.first()).toHaveAttribute('src', STREET_TILE_URL_PATTERN);
        await expect(attribution).toContainText('\u00a9 OpenStreetMap contributors');
        await expect(page.locator('#map img.leaflet-tile[src*="google.com"]')).toHaveCount(0);
    });

    test('keeps zoom 20 while using zoom-19 street tiles', async ({ page }) => {
        const button = page.locator('#satellite-view-button');
        const tiles = page.locator('#map .leaflet-tile-pane img.leaflet-tile');
        const nativeZoomTiles = page.locator(
            '#map img.leaflet-tile[src^="https://tile.openstreetmap.org/19/"]'
        );

        await setMapZoom(page, 20);
        await expect(nativeZoomTiles.first()).toBeVisible();
        await expect(nativeZoomTiles.first()).toHaveJSProperty('naturalWidth', 1);
        await expect(
            page.locator('#map img.leaflet-tile[src^="https://tile.openstreetmap.org/20/"]')
        ).toHaveCount(0);

        await button.click();
        await expect(page.locator('#map')).toHaveClass(/(?:^|\s)zoom-20(?:\s|$)/);
        await expect(tiles.first()).toHaveAttribute('src', /mt\d\.google\.com\/vt\/.*&z=20$/);

        await button.click();
        await expect(page.locator('#map')).toHaveClass(/(?:^|\s)zoom-20(?:\s|$)/);
        await expect(nativeZoomTiles.first()).toHaveJSProperty('naturalWidth', 1);
    });

    test('remains visible and toggles the base map in read-only mode', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.locator('#undo-button')).not.toBeAttached();

        const button = page.locator('#satellite-view-button');
        const tiles = page.locator('#map .leaflet-tile-pane img.leaflet-tile');

        await expect(button).toBeVisible();
        await expect(button).toHaveAttribute('aria-pressed', 'false');

        await button.click();

        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await expect(tiles.first()).toHaveAttribute('src', /mt\d\.google\.com\/vt\/lyrs=s/);
        await expect(page.locator('#map img.leaflet-tile[src*="openstreetmap"]')).toHaveCount(0);

        await button.click();

        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(tiles.first()).toHaveAttribute('src', STREET_TILE_URL_PATTERN);
    });

    test('M toggles satellite view from the focused map, including in read-only mode', async ({
        page
    }) => {
        const button = page.locator('#satellite-view-button');
        const tiles = page.locator('#map .leaflet-tile-pane img.leaflet-tile');

        await page.locator('#map').focus();
        await page.keyboard.press('m');
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await expect(tiles.first()).toHaveAttribute('src', /mt\d\.google\.com\/vt\/lyrs=s/);

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.locator('#read-only')).not.toBeAttached();
        await page.locator('#map').focus();
        await page.keyboard.press('m');
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(tiles.first()).toHaveAttribute('src', STREET_TILE_URL_PATTERN);
    });
});
