import { test, expect } from '@playwright/test';
import { setupFreshPage } from './layerTestSetup';
import { getLayerFeatureCount, clickMap, drawPolyline, drawPolygon } from './layerMapTestHelpers';

test.describe('Layer exclusivity', () => {
    setupFreshPage();

    test('activating a second layer deactivates the first', async ({ page }) => {
        await page.locator('#modal-filter-button').click();
        await expect(page.locator('#modal-filter-button')).toHaveAttribute('aria-pressed', 'true');

        await page.locator('#traffic-lights-button').click();
        await expect(page.locator('#traffic-lights-button')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await expect(page.locator('#modal-filter-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('features from different layers are stored independently', async ({ page }) => {
        // Place a modal filter
        await page.locator('#modal-filter-button').click();
        await clickMap(page, -80, 0);

        // Place a traffic light
        await page.locator('#traffic-lights-button').click();
        await clickMap(page, 80, 0);

        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);
        expect(await getLayerFeatureCount(page, 'TrafficLights')).toBe(1);
    });

    test('clicking on an existing polyline keeps an active point layer selected and places the point', async ({
        page
    }) => {
        // Create one mobility lane to edit later.
        await page.locator('#mobility-lane-button').click();
        await drawPolyline(page);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBeGreaterThanOrEqual(1);

        // Switch to a point layer.
        await page.locator('#modal-filter-button').click();
        await expect(page.locator('#modal-filter-button')).toHaveAttribute('aria-pressed', 'true');

        await clickMap(page, 0, 0);

        await expect(page.locator('#modal-filter-button')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#mobility-lane-button')).toHaveAttribute(
            'aria-pressed',
            'false'
        );

        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);
        expect(await getLayerFeatureCount(page, 'MobilityLanes')).toBeGreaterThanOrEqual(1);
    });

    test('clicking inside an existing LTN cell keeps an active point layer selected and places the point', async ({
        page
    }) => {
        await page.locator('#ltn-button').click();
        await drawPolygon(page);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);

        // Switch to modal filter tool; this also closes the auto-opened label popup.
        await page.locator('#modal-filter-button').click();
        await expect(page.locator('#modal-filter-button')).toHaveAttribute('aria-pressed', 'true');
        // The naming popup must be closed before clicking to place a filter.
        await expect(page.locator('.popup-buttons')).toHaveCount(0);

        // The popup should now be closed. Clicking the rendered polygon center
        // should place a modal filter, not open the LTN popup.
        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        const polygonBox = await polygon.first().boundingBox();
        if (!polygonBox) throw new Error('LTN polygon bounding box not found');
        await page.mouse.click(
            polygonBox.x + polygonBox.width / 2,
            polygonBox.y + polygonBox.height / 2
        );
        await page.waitForTimeout(100);

        await expect(page.locator('#modal-filter-button')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#ltn-button')).toHaveAttribute('aria-pressed', 'false');
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);
        expect(await getLayerFeatureCount(page, 'LtnCells')).toBe(1);
    });

    test('clicking an imported feature while a point layer is active places the point', async ({
        page
    }) => {
        await page.locator('#layers-button').click();
        await page.getByLabel('Show layer Birmingham Wards').click();
        await page.locator('#layers-button').click();

        await page.locator('#modal-filter-button').click();
        await expect(page.locator('#modal-filter-button')).toHaveAttribute('aria-pressed', 'true');

        const importedFeature = page
            .locator('.leaflet-imported-pane path.leaflet-interactive')
            .first();
        await importedFeature.dispatchEvent('click');
        await page.waitForTimeout(100);

        await expect(page.locator('.popup-buttons')).toHaveCount(0);
        expect(await getLayerFeatureCount(page, 'ModalFilters')).toBe(1);
    });
});
