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

test.describe('Layer: LTN Cell (polygon): editing', () => {
    setupFreshPage();

    test('LTN draw mode keeps its cursor over an existing modal filter', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page);

        const modalFilter = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await expect(modalFilter).toHaveCount(1);

        await page.locator('#ltn-button').click();
        await hoverLocatorCenter(page, modalFilter);

        const cursor = await getCursorAtLocatorCenter(modalFilter);
        expect(cursor).not.toContain('data:image/svg+xml');
        expect(cursor).toBe('crosshair');
    });

    test('clicking an existing LTN polygon while draw mode is active switches into edit mode', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);

        // Drawing opens the naming popup focused on the title. Close it, then
        // clicking the polygon switches to edit mode.
        await expect(page.locator('.label-editor')).toBeVisible();
        await page
            .locator('.leaflet-popup.feature-popup-editor:visible .leaflet-popup-close-button')
            .click();
        await expect(page.locator('.popup-buttons')).toHaveCount(0);

        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await clickSvgPath(page, polygon);

        expect(await page.locator('.leaflet-editing-icon').count()).toBeGreaterThan(0);
        await expect(page.locator('.popup-buttons')).toHaveCount(1);

        await clickMap(page, 0, -140);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);
    });

    test('Escape exits LTN edit mode after the popup has been closed', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        await page.locator('#ltn-button').click();

        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await polygon.first().dispatchEvent('click');
        await expect(page.locator('.popup-buttons')).toHaveCount(1);
        expect(await page.locator('.leaflet-editing-icon').count()).toBeGreaterThan(0);

        await page
            .locator('.leaflet-popup.feature-popup-editor .leaflet-popup-close-button')
            .click();
        await expect(page.locator('.popup-buttons')).toHaveCount(0);
        expect(await page.locator('.leaflet-editing-icon').count()).toBeGreaterThan(0);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);

        await expect(page.locator('.popup-buttons')).toHaveCount(0);
        await expect(page.locator('.leaflet-editing-icon')).toHaveCount(0);
        await expect(page.locator('#ltn-button')).toHaveAttribute('aria-pressed', 'false');
    });
});
