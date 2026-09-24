import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import {
    getLayerFeatureCount,
    clickMap,
    deleteOpenFeaturePopup,
    waitForHistoryButtons
} from './layerMapTestHelpers';
import {
    setMapZoom,
    getPointIconState,
    expectPointAtLeafletCoordinate
} from './layerPointTestHelpers';

test.describe('Layer: Bus Gate (point, submenu button)', () => {
    setupFreshPage();

    test('point icons scale and hide at their zoom thresholds', async ({ page }) => {
        await page.locator('#modal-filter-button').dispatchEvent('contextmenu');
        await page.locator('#bus-gate-button').click();
        await clickMap(page);

        const icons = page.locator('.leaflet-marker-icon.bus-gate-icon');
        await expect(icons).toHaveCount(1);

        await setMapZoom(page, 20);
        await expect
            .poll(() =>
                getPointIconState(page, '.leaflet-marker-icon.bus-gate-icon').then(
                    (state) => state.size
                )
            )
            .toBe('1');
        await setMapZoom(page, 17);
        await expect
            .poll(() =>
                getPointIconState(page, '.leaflet-marker-icon.bus-gate-icon').then(
                    (state) => state.size
                )
            )
            .toBe('1');
        await setMapZoom(page, 16);
        const busGateState = await getPointIconState(page, '.leaflet-marker-icon.bus-gate-icon');
        expectPointAtLeafletCoordinate(busGateState);
        expect(busGateState.size).toBe('1');
        expect(busGateState.width).toBe(23);
        expect(busGateState.height).toBe(23);
        expect(busGateState.visualTransform).toBe('matrix(0.5, 0, 0, 0.5, 0, 0)');
        expect(busGateState.visualTransformOrigin).toBe('11.5px 11.5px');

        for (const zoom of [15, 14]) {
            await setMapZoom(page, zoom);
            const state = await getPointIconState(page, '.leaflet-marker-icon.bus-gate-icon');
            expectPointAtLeafletCoordinate(state);
            expect(state.visualTransform).toBe('matrix(0.5, 0, 0, 0.5, 0, 0)');
            expect(state.visibility).toBe('visible');
        }

        await setMapZoom(page, 13);
        await expect
            .poll(() =>
                getPointIconState(page, '.leaflet-marker-icon.bus-gate-icon').then(
                    (state) => state.size
                )
            )
            .toBe('1');
        expectPointAtLeafletCoordinate(
            await getPointIconState(page, '.leaflet-marker-icon.bus-gate-icon')
        );
        await setMapZoom(page, 12);
        const hiddenBusGateState = await getPointIconState(
            page,
            '.leaflet-marker-icon.bus-gate-icon'
        );
        expectPointAtLeafletCoordinate(hiddenBusGateState);
        expect(hiddenBusGateState.visibility).toBe('hidden');
    });

    test('multiple icons stay at their coordinates at every visible zoom', async ({ page }) => {
        await page.locator('#modal-filter-button').dispatchEvent('contextmenu');
        await page.locator('#bus-gate-button').click();
        await clickMap(page, -80);
        await clickMap(page);
        await clickMap(page, 80);

        const selector = '.leaflet-marker-icon.bus-gate-icon';
        await expect(page.locator(selector)).toHaveCount(3);
        for (const zoom of [20, 19, 18, 17, 16, 15, 14, 13]) {
            await setMapZoom(page, zoom);
            for (let index = 0; index < 3; index++) {
                expectPointAtLeafletCoordinate(await getPointIconState(page, selector, index));
            }
        }
    });

    test('right-clicking the filter button reveals the bus gate button', async ({ page }) => {
        // Bus Gate is in the 'filters' subgroup; revealed by right-click on the parent
        await page.locator('#modal-filter-button').dispatchEvent('contextmenu');
        await expect(page.locator('#bus-gate-button')).toBeVisible();
    });

    test('clicking the map places a bus gate marker and persists it', async ({ page }) => {
        await page.locator('#modal-filter-button').dispatchEvent('contextmenu');
        await page.locator('#bus-gate-button').click();
        await clickMap(page);
        const count = await getLayerFeatureCount(page, 'BusGates');
        expect(count).toBe(1);
        // .leaflet-marker-icon scopes the selector to actual map markers only
        // (the legend also uses .bus-gate-icon, so we must be specific)
        await expect(page.locator('.leaflet-marker-icon.bus-gate-icon')).toHaveCount(1);
    });

    test('clicking a placed bus gate marker removes it', async ({ page }) => {
        await page.locator('#modal-filter-button').dispatchEvent('contextmenu');
        await page.locator('#bus-gate-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(1);

        await page.locator('#bus-gate-button').click(); // deactivate
        await page.waitForSelector('.leaflet-marker-icon.bus-gate-icon');
        await page.locator('.leaflet-marker-icon.bus-gate-icon').first().dispatchEvent('click');
        await deleteOpenFeaturePopup(page);
        await page.waitForTimeout(100);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(0);
    });

    test('undo removes a newly placed bus gate and redo restores it', async ({ page }) => {
        await page.locator('#modal-filter-button').dispatchEvent('contextmenu');
        await page.locator('#bus-gate-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(1);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });
        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(1);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });

    test('undo restores a deleted bus gate and redo removes it again', async ({ page }) => {
        await page.locator('#modal-filter-button').dispatchEvent('contextmenu');
        await page.locator('#bus-gate-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(1);

        await page.locator('#bus-gate-button').click(); // deactivate
        await page.waitForSelector('.leaflet-marker-icon.bus-gate-icon');
        await page.locator('.leaflet-marker-icon.bus-gate-icon').first().dispatchEvent('click');
        await deleteOpenFeaturePopup(page);
        await page.waitForTimeout(100);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(1);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'BusGates')).toBe(0);
    });
});
