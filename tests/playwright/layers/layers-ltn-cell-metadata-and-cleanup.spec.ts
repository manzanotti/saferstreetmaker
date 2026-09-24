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

test.describe('Layer: LTN Cell (polygon): metadata-and-cleanup', () => {
    setupFreshPage();

    test('undo restores an edited LTN label and redo reapplies it', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        await page.locator('#ltn-button').click();

        await page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first()
            .dispatchEvent('click');
        await page.waitForTimeout(200);

        await page.locator('.label-editor').fill('Zone A');
        await page.keyboard.press('Enter');

        await page.locator('#undo-button').click();
        await page.waitForTimeout(200);

        // After undo the label should revert to the original value
        await page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first()
            .dispatchEvent('click');
        await page.waitForTimeout(200);
        await expect(page.locator('.label-editor')).toHaveValue('1');

        await page.locator('#redo-button').click();
        await page.waitForTimeout(200);

        await page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first()
            .dispatchEvent('click');
        await page.waitForTimeout(200);
        await expect(page.locator('.label-editor')).toHaveValue('Zone A');
    });

    test('deleting an LTN polygon removes its selection vertex handles', async ({ page }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        await page.locator('#ltn-button').click();

        // Click the polygon to select it — vertex handles (blue circle markers)
        // appear in the overlay pane.
        await page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first()
            .dispatchEvent('click');
        await page.waitForTimeout(200);

        const handles = page.locator('.leaflet-overlay-pane path[stroke="#3b82f6"]');
        expect(await handles.count()).toBeGreaterThan(0);

        // Delete the polygon via its popup.
        await page.waitForSelector('.popup-buttons .delete-button');
        await page.locator('.popup-buttons .delete-button').first().dispatchEvent('click');
        await page.waitForTimeout(200);

        // The vertex handles must be gone once the polygon is deleted.
        expect(await handles.count()).toBe(0);
    });

    test('hovering an existing point feature shows a pointer cursor while another tool is active', async ({
        page
    }) => {
        await page.locator('#modal-filter-button').click({ button: 'right' });
        await page.locator('#bus-gate-button').click();
        await clickMap(page);

        await page.locator('#mobility-lane-button').click();

        const marker = page.locator('.leaflet-marker-icon.bus-gate-icon');
        await hoverLocatorCenter(page, marker);

        const cursor = await getCursorAtLocatorCenter(marker);
        expect(cursor).toBe('pointer');
    });
});
