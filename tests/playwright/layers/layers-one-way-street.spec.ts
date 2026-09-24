import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import { getLayerFeatureCount, waitForHistoryButtons, drawPolyline } from './layerMapTestHelpers';

test.describe('Layer: One-Way Street (polyline)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#one-way-street-button').click();
        await expect(page.locator('#one-way-street-button')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    test('drawing a polyline creates a one-way street and persists it', async ({ page }) => {
        await page.locator('#one-way-street-button').click();
        await drawPolyline(page);
        const count = await getLayerFeatureCount(page, 'OneWayStreets');
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('undo removes a newly drawn one-way street and redo restores it', async ({ page }) => {
        await page.locator('#one-way-street-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'OneWayStreets')).toBeGreaterThanOrEqual(1);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'OneWayStreets')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });
        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'OneWayStreets')).toBeGreaterThanOrEqual(1);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });

    test('undo restores a deleted one-way street and redo removes it again', async ({ page }) => {
        await page.locator('#one-way-street-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'OneWayStreets')).toBeGreaterThanOrEqual(1);

        // One-way streets use the arrowheads plugin which adds polylines to a
        // different SVG group. Click the line's path directly in the overlay pane.
        const path = page.locator('.leaflet-overlay-pane path.one-way-street.leaflet-interactive');
        await path.first().dispatchEvent('click');
        await page.waitForSelector('.popup-buttons .delete-button');
        await page.locator('.popup-buttons .delete-button').first().dispatchEvent('click');
        await page.waitForTimeout(100);
        expect(await getLayerFeatureCount(page, 'OneWayStreets')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'OneWayStreets')).toBeGreaterThanOrEqual(1);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'OneWayStreets')).toBe(0);
    });
});
