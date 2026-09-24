import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import {
    getLayerFeatureCount,
    waitForHistoryButtons,
    drawPolyline,
    deleteFirstShape
} from './layerMapTestHelpers';

test.describe('Layer: Car-Free Street (polyline)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#car-free-street-button').click();
        await expect(page.locator('#car-free-street-button')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    test('drawing a polyline creates a car-free street and persists it', async ({ page }) => {
        await page.locator('#car-free-street-button').click();
        await drawPolyline(page);
        const count = await getLayerFeatureCount(page, 'CarFreeStreets');
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('undo removes a newly drawn car-free street and redo restores it', async ({ page }) => {
        await page.locator('#car-free-street-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'CarFreeStreets')).toBeGreaterThanOrEqual(1);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'CarFreeStreets')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });
        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'CarFreeStreets')).toBeGreaterThanOrEqual(1);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });

    test('undo restores a deleted car-free street and redo removes it again', async ({ page }) => {
        await page.locator('#car-free-street-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'CarFreeStreets')).toBeGreaterThanOrEqual(1);

        await deleteFirstShape(page);
        expect(await getLayerFeatureCount(page, 'CarFreeStreets')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'CarFreeStreets')).toBeGreaterThanOrEqual(1);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'CarFreeStreets')).toBe(0);
    });
});
