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

test.describe('Layer: Traffic Lights (point, primary button)', () => {
    setupFreshPage();

    test('toolbar button activates the layer', async ({ page }) => {
        await page.locator('#traffic-lights-button').click();
        await expect(page.locator('#traffic-lights-button')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    test('traffic-light icons scale and hide at their zoom thresholds', async ({ page }) => {
        await page.locator('#traffic-lights-button').click();
        await clickMap(page);

        const icons = page.locator('.leaflet-marker-icon.traffic-lights-icon');
        await expect(icons).toHaveCount(1);

        await setMapZoom(page, 20);
        await expect
            .poll(() =>
                getPointIconState(page, '.leaflet-marker-icon.traffic-lights-icon').then(
                    (state) => state.size
                )
            )
            .toBe('1');
        await setMapZoom(page, 17);
        await expect
            .poll(() =>
                getPointIconState(page, '.leaflet-marker-icon.traffic-lights-icon').then(
                    (state) => state.size
                )
            )
            .toBe('1');
        await setMapZoom(page, 16);
        const trafficLightState = await getPointIconState(
            page,
            '.leaflet-marker-icon.traffic-lights-icon'
        );
        expectPointAtLeafletCoordinate(trafficLightState);
        expect(trafficLightState.size).toBe('1');
        expect(trafficLightState.width).toBe(30);
        expect(trafficLightState.height).toBe(30);
        expect(trafficLightState.visualTransform).toBe('matrix(0.5, 0, 0, 0.5, 0, 0)');
        expect(trafficLightState.visualTransformOrigin).toBe('15px 15px');

        for (const zoom of [15, 14]) {
            await setMapZoom(page, zoom);
            const state = await getPointIconState(page, '.leaflet-marker-icon.traffic-lights-icon');
            expectPointAtLeafletCoordinate(state);
            expect(state.visualTransform).toBe('matrix(0.5, 0, 0, 0.5, 0, 0)');
            expect(state.visibility).toBe('visible');
        }

        await setMapZoom(page, 13);
        await expect
            .poll(() =>
                getPointIconState(page, '.leaflet-marker-icon.traffic-lights-icon').then(
                    (state) => state.size
                )
            )
            .toBe('1');
        expectPointAtLeafletCoordinate(
            await getPointIconState(page, '.leaflet-marker-icon.traffic-lights-icon')
        );

        await setMapZoom(page, 12);
        const hiddenTrafficLightState = await getPointIconState(
            page,
            '.leaflet-marker-icon.traffic-lights-icon'
        );
        expectPointAtLeafletCoordinate(hiddenTrafficLightState);
        expect(hiddenTrafficLightState.visibility).toBe('hidden');
    });

    test('multiple icons stay at their coordinates at every visible zoom', async ({ page }) => {
        await page.locator('#traffic-lights-button').click();
        await clickMap(page, -80);
        await clickMap(page);
        await clickMap(page, 80);

        const selector = '.leaflet-marker-icon.traffic-lights-icon';
        await expect(page.locator(selector)).toHaveCount(3);
        for (const zoom of [20, 19, 18, 17, 16, 15, 14, 13]) {
            await setMapZoom(page, zoom);
            for (let index = 0; index < 3; index++) {
                expectPointAtLeafletCoordinate(await getPointIconState(page, selector, index));
            }
        }
    });

    test('clicking the map places a traffic light and persists it', async ({ page }) => {
        await page.locator('#traffic-lights-button').click();
        await clickMap(page);
        const count = await getLayerFeatureCount(page, 'TrafficLights');
        expect(count).toBe(1);
        // Use .leaflet-marker-icon to distinguish the map marker from the legend icon
        await expect(page.locator('.leaflet-marker-icon.traffic-lights-icon')).toHaveCount(1);
    });

    test('clicking a placed traffic light removes it', async ({ page }) => {
        await page.locator('#traffic-lights-button').click();
        await clickMap(page);
        await page.locator('#traffic-lights-button').click(); // deactivate
        await page.waitForSelector('.leaflet-marker-icon.traffic-lights-icon');
        await page
            .locator('.leaflet-marker-icon.traffic-lights-icon')
            .first()
            .dispatchEvent('click');
        await deleteOpenFeaturePopup(page);
        await page.waitForTimeout(100);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(0);
    });

    test('deactivating the button removes selected state', async ({ page }) => {
        const btn = page.locator('#traffic-lights-button');
        await btn.click();
        await btn.click();
        await expect(btn).toHaveAttribute('aria-pressed', 'false');
    });

    test('undo removes a newly placed traffic light and redo restores it', async ({ page }) => {
        await page.locator('#traffic-lights-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(1);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });
        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(1);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });

    test('undo restores a deleted traffic light and redo removes it again', async ({ page }) => {
        await page.locator('#traffic-lights-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(1);

        await page.locator('#traffic-lights-button').click(); // deactivate
        await page.waitForSelector('.leaflet-marker-icon.traffic-lights-icon');
        await page
            .locator('.leaflet-marker-icon.traffic-lights-icon')
            .first()
            .dispatchEvent('click');
        await deleteOpenFeaturePopup(page);
        await page.waitForTimeout(100);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(1);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(0);
    });
});
