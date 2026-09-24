import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import {
    getLayerFeatureCount,
    clickMap,
    waitForHistoryButtons,
    drawPolyline,
    drawPolygon,
    deleteFirstShape
} from './layerMapTestHelpers';
import { hoverSvgPath, clickSvgPath } from './layerSvgTestHelpers';
import { hoverLocatorCenter } from './layerHoverTestHelpers';
import {
    getCursorAtPathPoint,
    getCursorAtLocatorCenter,
    getCursorAtPagePoint,
    moveToMapOffset
} from './layerCursorTestHelpers';

test.describe('Layer: Mobility Lane (polyline)', () => {
    setupFreshPage();

    test('undo removes a newly drawn mobility lane and redo restores it', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBeGreaterThanOrEqual(1);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBeGreaterThanOrEqual(1);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });

    test('undo restores a deleted mobility lane and redo removes it again', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBeGreaterThanOrEqual(1);

        await deleteFirstShape(page);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBeGreaterThanOrEqual(1);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBe(0);
    });
});
