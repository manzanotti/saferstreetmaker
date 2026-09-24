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

test.describe('Layer: LTN Cell (polygon): basics', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await expect(page.locator('#ltn-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('drawing a polygon creates an LTN cell and persists it', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        const count = await getLayerFeatureCount(page, 'LtnCells');
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('completing a polygon opens the LTN popup with the title input focused', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygonClosingAtFirstVertex(page);

        // The naming popup appears immediately, focused so the user can type a
        // title straight away.
        await expect(page.locator('.label-editor')).toBeVisible();
        await expect(page.locator('.label-editor')).toBeFocused();
    });

    test('deleting a drawn LTN cell removes it from storage', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBeGreaterThanOrEqual(1);

        await deleteFirstShape(page);

        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(0);
    });

    test('deactivating the button removes selected state', async ({ page }) => {
        const btn = page.locator('#ltn-button');
        await btn.click();
        await btn.click();
        await expect(btn).toHaveAttribute('aria-pressed', 'false');
    });
});
