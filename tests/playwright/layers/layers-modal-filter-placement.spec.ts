import { test, expect } from '@playwright/test';
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

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await expect(page.locator('#modal-filter-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('marker resizes and stays at its coordinate from zoom 12 to 16', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page);

        const selector = '.leaflet-filters-pane path.modal-filter-marker';
        await setMapZoom(page, 17);
        const normalState = await getPointIconState(page, selector);

        for (const zoom of [16, 15, 14, 13]) {
            await setMapZoom(page, zoom);
            const state = await getPointIconState(page, selector);
            expectPointAtLeafletCoordinate(state);
            expect(state.width).toBeLessThan(normalState.width * 0.51);
            expect(state.height).toBeLessThan(normalState.height * 0.51);
            expect(state.visibility).toBe('visible');
        }

        await setMapZoom(page, 12);
        const hiddenState = await getPointIconState(page, selector);
        expectPointAtLeafletCoordinate(hiddenState);
        expect(hiddenState.visibility).toBe('hidden');
    });

    test('clicking the map places a marker and persists it', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page);
        const count = await getLayerFeatureCount(page, 'ModalFilters');
        expect(count).toBe(1);
    });

    test('multiple map clicks place multiple markers', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page, -60, 0);
        await clickMap(page, 60, 0);
        await clickMap(page, 0, 60);
        const count = await getLayerFeatureCount(page, 'ModalFilters');
        expect(count).toBe(3);
    });

    test('clicking a placed marker removes it', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);

        // Deactivate tool so no new marker is accidentally placed
        await page.locator('#modal-filter-button').click();

        // CircleMarker renders as an SVG path in the custom filters pane.
        // Use dispatchEvent to reliably trigger the Leaflet click handler.
        await page.waitForSelector('.leaflet-filters-pane path');
        await page.locator('.leaflet-filters-pane path').first().dispatchEvent('click');
        await deleteOpenFeaturePopup(page);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(0);
    });

    test('deactivating the button removes selected state', async ({ page }) => {
        const btn = page.locator('#modal-filter-button');
        await btn.click(); // activate
        await btn.click(); // deactivate
        await expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    test('undo removes a newly placed modal filter and redo restores it', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });
});
