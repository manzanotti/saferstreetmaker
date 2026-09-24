import { test, expect } from '@playwright/test';
import { getLayerFeatures } from '../indexedDbHelpers';
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

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await expect(page.locator('#mobility-lane-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('drawing a polyline creates a mobility lane and persists it', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        const count = await getLayerFeatureCount(page, 'MobilityLanes');
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('editing a mobility lane persists its name', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive');
        await path.first().dispatchEvent('click');

        const nameInput = page.locator('.leaflet-popup .name-editor');
        await expect(nameInput).toBeVisible();
        await nameInput.fill('Canal route');
        await page.getByRole('button', { name: 'Save name' }).click();
        await page.waitForTimeout(500);

        const features = await getLayerFeatures(page, 'Hello Cleveland', 'MobilityLanes');
        expect(features[0]?.properties?.name).toBe('Canal route');
    });

    test('closing the mobility lane editor deselects the polyline', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive');
        await path.first().dispatchEvent('click');
        await expect(page.locator('.popup-buttons')).toBeVisible();
        await page
            .locator('.leaflet-popup.feature-popup-editor .leaflet-popup-close-button')
            .dispatchEvent('click');

        await expect(page.locator('#mobility-lane-button')).toHaveAttribute(
            'aria-pressed',
            'false'
        );
        await expect(page.locator('.leaflet-editing-icon')).toHaveCount(0);
    });

    test('deleting a drawn mobility lane removes it from storage', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBeGreaterThanOrEqual(1);

        await deleteFirstShape(page);

        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBe(0);
    });

    test('deactivating the button removes selected state', async ({ page }) => {
        const btn = page.locator('#mobility-lane-button');
        await btn.click();
        await btn.click();
        await expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    test('active mobility tool shows a selectable cursor on existing mobility lines', async ({
        page
    }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);

        const path = page.locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive');
        await hoverSvgPath(page, path);

        const cursor = await getCursorAtPathPoint(path);
        expect(cursor).toBe('pointer');
    });

    test('editing a mobility line falls back to a grab cursor away from features', async ({
        page
    }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive');
        await path.first().dispatchEvent('click');
        await page.waitForTimeout(200);

        const point = await moveToMapOffset(page, 0, 180);
        const cursor = await getCursorAtPagePoint(page, point.x, point.y);
        expect(cursor).toBe('grab');
    });

    test('clicking an existing mobility line exposes edit handles', async ({ page }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive');
        await clickSvgPath(page, path);

        await expect(page.locator('.leaflet-editing-icon')).toHaveCount(1);
    });

    test('clicking an existing mobility line while draw mode is active switches into edit mode', async ({
        page
    }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);

        const path = page.locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive');
        await clickSvgPath(page, path);

        expect(await page.locator('.leaflet-editing-icon').count()).toBeGreaterThan(0);

        await clickMap(page, 0, 180);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBe(1);
    });

    test('active mobility tool keeps the tool cursor on different layer shapes', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);

        await page.locator('#mobility-lane-button').click();

        const path = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await hoverLocatorCenter(page, path);

        const cursor = await getCursorAtLocatorCenter(path);
        expect(cursor).toBe('crosshair');
    });

    test('an in-progress mobility draw keeps the crosshair over existing lines and point features', async ({
        page
    }) => {
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);

        await page.locator('#modal-filter-button').click();
        await clickMap(page, -120, 0);

        await page.locator('#mobility-lane-button').click();

        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) {
            throw new Error('Map bounding box not found');
        }

        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.waitForTimeout(200);
        await page.mouse.click(cx - 140, cy - 20);
        await page.waitForTimeout(200);

        const mobilityPath = page.locator(
            '.leaflet-overlay-pane path.mobility-lane.leaflet-interactive'
        );
        await hoverSvgPath(page, mobilityPath);
        expect(await getCursorAtPathPoint(mobilityPath)).toBe('crosshair');

        const modalFilter = page.locator('.leaflet-interactive.modal-filter-marker');
        await hoverLocatorCenter(page, modalFilter);
        expect(await getCursorAtLocatorCenter(modalFilter)).toBe('crosshair');
    });
});
