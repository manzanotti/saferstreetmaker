import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import { getLayerFeatureCount, drawPolyline } from './layerMapTestHelpers';

test.describe('Layer: Bus Lane (polyline)', () => {
    setupFreshPage();

    test('toolbar button is available in the tram and bus lanes group', async ({ page }) => {
        await expect(page.locator('#tram-line-button')).toBeVisible();
        await expect(page.locator('#bus-lane-button')).not.toBeVisible();

        await page.locator('#tram-line-button').click({ button: 'right' });
        await expect(page.locator('#bus-lane-button')).toBeVisible();
        await expect(page.locator('#bus-lane-button img')).toHaveAttribute('src', /bus-lane\.svg/);
    });

    test('drawing a bus lane creates a red polyline and persists it', async ({ page }) => {
        await page.locator('#tram-line-button').click({ button: 'right' });
        await page.locator('#bus-lane-button').click();
        await drawPolyline(page);

        const path = page.locator('.leaflet-overlay-pane path.bus-lane.leaflet-interactive');
        await expect(path).toBeVisible();
        await expect(path).toHaveAttribute('stroke', '#b91c1c');
        expect(await getLayerFeatureCount(page, 'BusLanes')).toBeGreaterThanOrEqual(1);
    });
});

// ===========================================================================
// POLYGON LAYER  (click toolbar button → draw polygon with leaflet.draw)
// ===========================================================================
