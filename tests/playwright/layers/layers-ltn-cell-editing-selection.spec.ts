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

    test('clicking an existing LTN polygon enters edit mode without enabling draw mode', async ({
        page
    }) => {
        // Draw one polygon
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBeGreaterThanOrEqual(1);

        // Deselect the layer so the polygon click starts from a neutral state
        await page.locator('#ltn-button').click();
        await expect(page.locator('#ltn-button')).toHaveAttribute('aria-pressed', 'false');

        // Click the existing polygon — should enter edit mode but NOT activate the draw button
        await page
            .locator(
                '.leaflet-overlay-pane path, .leaflet-polygon-pane path, .leaflet-ltns-pane path'
            )
            .first()
            .dispatchEvent('click');
        await page.waitForTimeout(200);

        // LTN button should NOT be selected — feature clicks are edit-only, not draw-mode
        await expect(page.locator('#ltn-button')).toHaveAttribute('aria-pressed', 'false');

        // A map click should NOT create a new LTN cell (edit mode, not draw mode)
        await clickMap(page, 0, -150);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);
    });

    test('clicking a second LTN polygon deselects the first one', async ({ page }) => {
        // Draw first polygon at map center
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);

        // Deactivate then reactivate to clearly draw a second polygon
        await page.locator('#ltn-button').click(); // deselect
        await page.locator('#ltn-button').click(); // select for draw

        // Draw second polygon in the top-left quarter to avoid overlapping the first
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) {
            throw new Error('no map box');
        }
        const cx = box.x + box.width / 4;
        const cy = box.y + box.height / 4;
        await page.waitForTimeout(200);
        await page.mouse.click(cx - 40, cy - 25);
        await page.waitForTimeout(200);
        await page.mouse.click(cx + 40, cy - 25);
        await page.waitForTimeout(200);
        await page.mouse.click(cx, cy + 25);
        await page.waitForTimeout(200);
        await page.mouse.dblclick(cx, cy + 40);
        await page.waitForTimeout(500);

        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(2);

        // Deselect draw mode
        await page.locator('#ltn-button').click();

        // Click the first polygon to enter edit mode — a popup should open
        const polygons = page.locator(
            '.leaflet-overlay-pane path, .leaflet-polygon-pane path, .leaflet-ltns-pane path'
        );
        await polygons.first().dispatchEvent('click');
        await page.waitForTimeout(200);
        await expect(page.locator('#ltn-button')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('.popup-buttons')).toBeVisible();

        // Click the second polygon — popup should switch to the second polygon
        await polygons.last().dispatchEvent('click');
        await page.waitForTimeout(200);

        // LTN button remains inactive (edit mode, not draw mode)
        await expect(page.locator('#ltn-button')).toHaveAttribute('aria-pressed', 'false');

        // Only one popup open at a time
        await expect(page.locator('.popup-buttons')).toHaveCount(1);
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const app = (document.getElementById('app') as any).__vue_app__;
                    const mapStore = app?.config?.globalProperties?.$pinia?._s?.get('map');
                    const layer = mapStore.layers.find((item: any) => item.id === 'LtnCells');
                    let editableCount = 0;
                    layer.getLayer().eachLayer((polygon: any) => {
                        if (polygon.editing?.enabled?.()) {
                            editableCount++;
                        }
                    });
                    return editableCount;
                })
            )
            .toBe(1);
    });

    test('editing an LTN polygon uses pointer inside, crosshair on edges, and grab elsewhere', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        await page.locator('#ltn-button').click();

        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await polygon.first().dispatchEvent('click');
        await page.waitForTimeout(200);

        await hoverLocatorCenter(page, polygon);
        expect(await getCursorAtLocatorCenter(polygon)).toBe('pointer');

        await hoverSvgPathStroke(page, polygon);
        expect(await getInlineCursor(polygon)).toBe('crosshair');

        const point = await moveToMapOffset(page, 0, 180);
        expect(await getCursorAtPagePoint(page, point.x, point.y)).toBe('grab');
    });
});
