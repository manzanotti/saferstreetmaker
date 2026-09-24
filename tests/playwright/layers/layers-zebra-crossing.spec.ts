import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import {
    getLayerFeatureCount,
    clickMap,
    deleteOpenFeaturePopup,
    waitForHistoryButtons
} from './layerMapTestHelpers';

test.describe('Layer: Zebra Crossing (point, submenu button)', () => {
    setupFreshPage();

    test('right-clicking traffic lights button reveals zebra crossing button', async ({ page }) => {
        await page.locator('#traffic-lights-button').dispatchEvent('contextmenu');
        await expect(page.locator('#zebra-crossing-button')).toBeVisible();
    });

    test('clicking the map places a zebra crossing and persists it', async ({ page }) => {
        await page.locator('#traffic-lights-button').dispatchEvent('contextmenu');
        await page.locator('#zebra-crossing-button').click();
        await clickMap(page);
        const count = await getLayerFeatureCount(page, 'ZebraCrossing');
        expect(count).toBe(1);
        await expect(page.locator('.leaflet-marker-icon.zebra-crossing-icon')).toHaveCount(1);
    });

    test('undo removes a newly placed zebra crossing and redo restores it', async ({ page }) => {
        await page.locator('#traffic-lights-button').dispatchEvent('contextmenu');
        await page.locator('#zebra-crossing-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'ZebraCrossing')).toBe(1);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'ZebraCrossing')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: false, canRedo: true });
        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'ZebraCrossing')).toBe(1);
        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });
    });

    test('undo restores a deleted zebra crossing and redo removes it again', async ({ page }) => {
        await page.locator('#traffic-lights-button').dispatchEvent('contextmenu');
        await page.locator('#zebra-crossing-button').click();
        await clickMap(page);
        expect(await getLayerFeatureCount(page, 'ZebraCrossing')).toBe(1);

        await page.locator('#zebra-crossing-button').click(); // deactivate
        await page.waitForSelector('.leaflet-marker-icon.zebra-crossing-icon');
        await page
            .locator('.leaflet-marker-icon.zebra-crossing-icon')
            .first()
            .dispatchEvent('click');
        await deleteOpenFeaturePopup(page);
        await page.waitForTimeout(100);
        expect(await getLayerFeatureCount(page, 'ZebraCrossing')).toBe(0);

        await waitForHistoryButtons(page, { canUndo: true, canRedo: false });

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'ZebraCrossing')).toBe(1);

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        expect(await getLayerFeatureCount(page, 'ZebraCrossing')).toBe(0);
    });
});

// ===========================================================================
// POLYLINE LAYERS  (click toolbar button → draw with leaflet.draw)
// ===========================================================================
