import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import {
    getLayerFeatureCount,
    waitForHistoryButtons,
    drawPolyline,
    deleteFirstShape
} from './layerMapTestHelpers';

test.describe('Layer: Tram Line (polyline)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#tram-line-button').click();
        await expect(page.locator('#tram-line-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('drawing a polyline creates a tram line and persists it', async ({ page }) => {
        await page.locator('#tram-line-button').click();
        await drawPolyline(page);
        const count = await getLayerFeatureCount(page, 'TramLines');
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('undo removes a newly drawn tram line and redo restores it', async ({ page }) => {
        await page.locator('#tram-line-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'TramLines')).toBeGreaterThanOrEqual(1);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'TramLines')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });
        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'TramLines')).toBeGreaterThanOrEqual(1);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });

    test('undo restores a deleted tram line and redo removes it again', async ({ page }) => {
        await page.locator('#tram-line-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'TramLines')).toBeGreaterThanOrEqual(1);

        await deleteFirstShape(page);
        expect(await getLayerFeatureCount(page, 'TramLines')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'TramLines')).toBeGreaterThanOrEqual(1);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'TramLines')).toBe(0);
    });
});
