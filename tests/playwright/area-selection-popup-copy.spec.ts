import { test, expect } from '@playwright/test';
import { getLayerFeatureCount } from './indexedDbHelpers';
import { setupPage, drawMobilityLane, drawLtnPolygon } from './areaSelectionTestHelpers';

// ---------------------------------------------------------------------------
// Popup copy (polyline / polygon)
// ---------------------------------------------------------------------------
test.describe('Area selection — popup copy (polyline/polygon)', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('polyline popup contains a Copy button', async ({ page }) => {
        await drawMobilityLane(page);
        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-overlay-pane path.leaflet-interactive');
        await path.first().dispatchEvent('click');
        await page.waitForSelector('.popup-buttons');

        await expect(page.locator('.popup-buttons .copy-button')).toBeVisible();
    });

    test('Delete key removes a polyline selected through its command popup', async ({ page }) => {
        await drawMobilityLane(page);
        await page.locator('#mobility-lane-button').click();
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);

        const path = page.locator('.leaflet-overlay-pane path.leaflet-interactive');
        await path.first().dispatchEvent('click');
        await page.waitForSelector('.popup-buttons');

        await page.keyboard.press('Delete');
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(0);
        await expect(page.locator('.popup-buttons')).not.toBeVisible();
        await expect(page.locator('.leaflet-editing-icon')).toHaveCount(0);
        await expect(page.locator('#undo-button')).toBeEnabled();
    });

    test('clicking Copy in the polyline popup shows the Paste button', async ({ page }) => {
        await drawMobilityLane(page);
        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-overlay-pane path.leaflet-interactive');
        await path.first().dispatchEvent('click');
        await page.waitForSelector('.popup-buttons .copy-button');
        await page.locator('.popup-buttons .copy-button').first().dispatchEvent('click');
        await page.waitForTimeout(200);

        await expect(page.getByRole('button', { name: 'Paste copied features' })).toBeVisible();
    });

    test('pasting after popup-copy of a polyline increases the layer feature count', async ({
        page
    }) => {
        await drawMobilityLane(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);

        await page.locator('#mobility-lane-button').click();
        const path = page.locator('.leaflet-overlay-pane path.leaflet-interactive');
        await path.first().dispatchEvent('click');
        await page.waitForSelector('.popup-buttons .copy-button');
        await page.locator('.popup-buttons .copy-button').first().dispatchEvent('click');
        await page.waitForTimeout(200);

        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await page.waitForTimeout(500);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(2);
    });

    test('LTN polygon popup contains a Copy button', async ({ page }) => {
        await drawLtnPolygon(page);
        await page.locator('#ltn-button').click();

        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await polygon.first().dispatchEvent('click');
        await page.waitForSelector('.popup-buttons');

        await expect(page.locator('.popup-buttons .copy-button')).toBeVisible();
    });

    test('clicking Copy in the LTN popup shows the Paste button', async ({ page }) => {
        await drawLtnPolygon(page);
        await page.locator('#ltn-button').click();

        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await polygon.first().dispatchEvent('click');
        await page.waitForSelector('.popup-buttons .copy-button');
        await page.locator('.popup-buttons .copy-button').first().dispatchEvent('click');
        await page.waitForTimeout(200);

        await expect(page.getByRole('button', { name: 'Paste copied features' })).toBeVisible();
    });

    test('pasting after popup-copy of an LTN polygon increases the layer feature count', async ({
        page
    }) => {
        await drawLtnPolygon(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(1);

        await page.locator('#ltn-button').click();
        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await polygon.first().dispatchEvent('click');
        await page.waitForSelector('.popup-buttons .copy-button');
        await page.locator('.popup-buttons .copy-button').first().dispatchEvent('click');
        await page.waitForTimeout(200);

        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await page.waitForTimeout(500);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(2);
    });
});
