import { test, expect } from '@playwright/test';
import { getHistoryEntryCount } from '../indexedDbHelpers';
import { setupFreshPage } from './layerTestSetup';
import {
    getLayerFeatureCount,
    clickMap,
    deleteOpenFeaturePopup,
    waitForHistoryButtons,
    waitForMapReady
} from './layerMapTestHelpers';
import {
    setMapZoom,
    getPointIconState,
    expectPointAtLeafletCoordinate
} from './layerPointTestHelpers';

test.describe('Layer: Modal Filter (point, primary button)', () => {
    setupFreshPage();

    test('panning and zooming the map does not create an undo checkpoint', async ({ page }) => {
        // Place a filter then undo it so redo is available.
        await page.locator('#modal-filter-button').click();
        await clickMap(page);
        await page.locator('#modal-filter-button').click(); // deactivate tool
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });

        // Pan the map by dragging, then zoom in.
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 120, cy + 120, { steps: 10 });
        await page.mouse.up();
        await page.keyboard.press('+');
        // Wait past the 500ms debounced view save.
        await page.waitForTimeout(800);

        // A view-only change must NOT record a checkpoint: the redo entry must
        // still be available and no new undo entry created.
        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });

        // Redo still restores the feature, proving the redo stack was intact.
        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);
    });

    test('undo and redo centre the map on an off-screen change', async ({ page }) => {
        // Place a modal filter at the map centre.
        await page.locator('#modal-filter-button').click();
        await clickMap(page);
        await page.locator('#modal-filter-button').click(); // deactivate
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        // Record the filter location, then jump the view far away so the
        // filter leaves the viewport.
        const filterLatLng = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const map = pinia?._s?.get('map')?.map;
            const c = map.getCenter();
            map.setView([c.lat + 5, c.lng + 5], map.getZoom(), { animate: false });
            return { lat: c.lat, lng: c.lng };
        });
        await page.waitForTimeout(300);

        // Confirm the filter location is now outside the viewport.
        const offScreen = await page.evaluate(({ lat, lng }) => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const map = pinia?._s?.get('map')?.map;
            return !map.getBounds().contains([lat, lng]);
        }, filterLatLng);
        expect(offScreen).toBe(true);

        // Undo — the map should move back to reveal the affected area.
        await page.locator('#undo-button').click();
        await page.waitForTimeout(400);

        const centredOnChange = await page.evaluate(({ lat, lng }) => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const map = pinia?._s?.get('map')?.map;
            const centre = map.getCenter();
            return Math.abs(centre.lat - lat) < 0.0001 && Math.abs(centre.lng - lng) < 0.0001;
        }, filterLatLng);
        expect(centredOnChange).toBe(true);

        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const map = pinia?._s?.get('map')?.map;
            const centre = map.getCenter();
            map.setView([centre.lat + 5, centre.lng + 5], map.getZoom(), { animate: false });
        });
        await page.waitForTimeout(300);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(400);

        const redoCentredOnChange = await page.evaluate(({ lat, lng }) => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const map = pinia?._s?.get('map')?.map;
            const centre = map.getCenter();
            return Math.abs(centre.lat - lat) < 0.0001 && Math.abs(centre.lng - lng) < 0.0001;
        }, filterLatLng);
        expect(redoCentredOnChange).toBe(true);
    });

    test('undo restores a deleted modal filter and redo removes it again', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);

        await page.locator('#modal-filter-button').click();
        await page.waitForSelector('.leaflet-filters-pane path');
        await page.locator('.leaflet-filters-pane path').first().dispatchEvent('click');
        await deleteOpenFeaturePopup(page);
        await expect.poll(() => getLayerFeatureCount(page, 'ModalFilters')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await expect.poll(() => getLayerFeatureCount(page, 'ModalFilters')).toBe(1);

        await page.locator('#redo-button').click();
        await expect.poll(() => getLayerFeatureCount(page, 'ModalFilters')).toBe(0);
    });

    test('history persists when reopening the same stored map in a new page', async ({
        page,
        context
    }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);
        await expect.poll(() => getHistoryEntryCount(page)).toBeGreaterThan(0);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        const secondPage = await context.newPage();
        try {
            await secondPage.goto('/');
            await waitForMapReady(secondPage);

            await waitForHistoryButtons(secondPage, { canUndo: true, canRedo: false });
            await secondPage.locator('#undo-button').click();
            await secondPage.waitForTimeout(700);
            expect(await getLayerFeatureCount(secondPage, 'ModalFilters')).toBe(0);
        } finally {
            await secondPage.close();
        }
    });
});
