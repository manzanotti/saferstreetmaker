import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import {
    getLayerFeatureCount,
    clickMap,
    waitForHistoryButtons,
    drawPolyline,
    drawPolygon,
    drawPolygonClosingAtFirstVertex,
    deleteFirstShape
} from './layerMapTestHelpers';
import { clickSvgPath, hoverSvgPathStroke } from './layerSvgTestHelpers';
import { hoverLocatorCenter } from './layerHoverTestHelpers';
import {
    getInlineCursor,
    getCursorAtLocatorCenter,
    getCursorAtPagePoint,
    moveToMapOffset
} from './layerCursorTestHelpers';

test.describe('Layer: LTN Cell (polygon): history', () => {
    setupFreshPage();

    test('undo removes a newly drawn LTN cell and redo restores it', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBeGreaterThanOrEqual(1);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBeGreaterThanOrEqual(1);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });

    test('changing an LTN cell colour supports undo and redo', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);

        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        const previousColour = await polygon.getAttribute('stroke');
        expect(previousColour).toBeTruthy();

        const nextColour = '#00aa55';
        await page.locator('.colour-swatch').fill(nextColour);
        await expect(polygon).toHaveAttribute('stroke', nextColour);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        await expect(polygon).toHaveAttribute('stroke', previousColour!);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: true });

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        await expect(polygon).toHaveAttribute('stroke', nextColour);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });

    test('can draw a new LTN cell immediately after undoing the previous creation', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(0);
        await expect(page.locator('#ltn-button')).toHaveAttribute('aria-pressed', 'true');

        await drawPolygon(page);

        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });

    test('undo restores a deleted LTN cell and redo removes it again', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBeGreaterThanOrEqual(1);

        await deleteFirstShape(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBeGreaterThanOrEqual(1);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(0);
    });
});
