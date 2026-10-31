import { test, expect } from '@playwright/test';
import { getLayerFeatureCount } from './indexedDbHelpers';
import { setupPage, drawMobilityLane, drawLtnPolygon } from './areaSelectionTestHelpers';

// ---------------------------------------------------------------------------
// Modifier-click additive selection (polyline / polygon)
// Note: dispatchEvent is used instead of page.mouse.click({modifiers}) because
// SVG path strokes are not reliably hit-tested by Playwright's coordinate-based
// click — the same reason the existing delete tests use dispatchEvent.
// ---------------------------------------------------------------------------
test.describe('Area selection — modifier-click additive selection (polyline/polygon)', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('Shift-clicking a polyline activates selection mode and selects it', async ({ page }) => {
        await drawMobilityLane(page);
        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-overlay-pane path.leaflet-interactive');
        // Shift-click: modifier triggers additive selection instead of opening the popup
        await path.first().dispatchEvent('click', { shiftKey: true });
        await page.waitForTimeout(200);

        await expect(page.getByText('feature selected', { exact: false })).toBeVisible();
    });

    test('Ctrl-clicking a polyline activates selection mode and selects it', async ({ page }) => {
        await drawMobilityLane(page);
        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-overlay-pane path.leaflet-interactive');
        await path.first().dispatchEvent('click', { ctrlKey: true });
        await page.waitForTimeout(200);

        await expect(page.getByText('feature selected', { exact: false })).toBeVisible();
    });

    test('Shift-clicking a second polyline while in selection mode adds it to the selection', async ({
        page
    }) => {
        // drawMobilityLane leaves the tool active — draw the second lane immediately
        await drawMobilityLane(page);
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.waitForTimeout(200);
        await page.mouse.click(cx - 60, cy + 80);
        await page.waitForTimeout(200);
        await page.mouse.click(cx + 60, cy + 80);
        await page.waitForTimeout(200);
        await page.mouse.dblclick(cx + 60, cy + 100);
        await page.waitForTimeout(500);
        await page.locator('#mobility-lane-button').click(); // deactivate after second draw

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(2);

        // Enter selection mode and select the first polyline with a drag
        await page.locator('#select-area-button').click();
        await page.mouse.move(cx - 80, cy - 30);
        await page.mouse.down();
        await page.mouse.move(cx + 80, cy + 30, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        // Shift-click the second polyline to add it
        const paths = page.locator('.leaflet-overlay-pane path.leaflet-interactive');
        await paths.last().dispatchEvent('click', { shiftKey: true });
        await page.waitForTimeout(200);

        await expect(page.getByText('2 features selected')).toBeVisible();
    });

    test('Shift-clicking an LTN polygon activates selection mode and selects it', async ({
        page
    }) => {
        await drawLtnPolygon(page);
        await page.locator('#ltn-button').click();

        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await polygon.first().dispatchEvent('click', { shiftKey: true });
        await page.waitForTimeout(200);

        await expect(page.getByText('feature selected', { exact: false })).toBeVisible();
    });

    test('Ctrl-clicking an LTN polygon activates selection mode and selects it', async ({
        page
    }) => {
        await drawLtnPolygon(page);
        await page.locator('#ltn-button').click();

        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await polygon.first().dispatchEvent('click', { ctrlKey: true });
        await page.waitForTimeout(200);

        await expect(page.getByText('feature selected', { exact: false })).toBeVisible();
    });

    test('normal click on a polyline then Shift-click on a second selects both', async ({
        page
    }) => {
        // drawMobilityLane leaves the tool active — draw a second lane immediately
        await drawMobilityLane(page);
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.waitForTimeout(200);
        await page.mouse.click(cx - 60, cy + 80);
        await page.waitForTimeout(200);
        await page.mouse.click(cx + 60, cy + 80);
        await page.waitForTimeout(200);
        await page.mouse.dblclick(cx + 60, cy + 100);
        await page.waitForTimeout(500);
        await page.locator('#mobility-lane-button').click(); // deactivate

        const paths = page.locator('.leaflet-overlay-pane path.leaflet-interactive');

        // Normal click on the first polyline — popup opens, edit mode
        await paths.first().dispatchEvent('click');
        await page.waitForSelector('.popup-buttons');

        // Closing an editor intentionally clears its implicit selection, so
        // enter explicit area-selection mode before adding the second line.
        await page.locator('#select-area-button').click();

        // Shift-click the second polyline — should add to the implicit selection
        await paths.last().dispatchEvent('click', { shiftKey: true });
        await page.waitForTimeout(200);

        await expect(page.getByText('2 features selected')).toBeVisible();
    });

    test('normal click while in selection mode then Shift-click selects both', async ({ page }) => {
        // drawMobilityLane leaves the tool active — draw a second lane immediately
        await drawMobilityLane(page);
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.waitForTimeout(200);
        await page.mouse.click(cx - 60, cy + 80);
        await page.waitForTimeout(200);
        await page.mouse.click(cx + 60, cy + 80);
        await page.waitForTimeout(200);
        await page.mouse.dblclick(cx + 60, cy + 100);
        await page.waitForTimeout(500);
        await page.locator('#mobility-lane-button').click(); // deactivate

        const paths = page.locator('.leaflet-overlay-pane path.leaflet-interactive');

        // Activate area-selection mode FIRST (empty selection)
        await page.locator('#select-area-button').click();

        // Normal click on first polyline while in selection mode — pre-selects it, popup opens
        await paths.first().dispatchEvent('click');
        await page.waitForTimeout(100);
        // Do not press Escape here — that would deactivate area-selection mode and clear selection.
        // The popup can remain open; the Shift-click on the second path still works.

        // Shift-click the second polyline — should add to the remembered selection
        await paths.last().dispatchEvent('click', { shiftKey: true });
        await page.waitForTimeout(200);

        await expect(page.getByText('2 features selected')).toBeVisible();
    });
});
