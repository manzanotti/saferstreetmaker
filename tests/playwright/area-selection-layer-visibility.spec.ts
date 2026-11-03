import { test, expect } from '@playwright/test';
import {
    setupPage,
    placeModalFilter,
    dragSelectCenter,
    drawMobilityLane
} from './areaSelectionTestHelpers';

test.describe('Area selection — layer visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('hidden layers are ignored by the selection tool', async ({ page }) => {
        await placeModalFilter(page);

        // Hide the ModalFilters layer via the legend toggle
        await page.locator('#ModalFilters-legend').dispatchEvent('click');
        await page.waitForTimeout(100);

        // Enter selection mode and drag over the area where the marker sits
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.waitForTimeout(200);

        // The panel should not appear because the layer is hidden
        await expect(page.getByText('feature selected', { exact: false })).not.toBeVisible();
    });

    test('visible layers are still selected when some layers are hidden', async ({ page }) => {
        // Draw a mobility lane and place a modal filter at the map centre.
        // Both will be inside the drag-select area.
        await drawMobilityLane(page);
        await placeModalFilter(page);

        // Verify both are selectable when everything is visible
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 80);
        await page.waitForTimeout(200);
        await expect(page.getByText('2 features selected')).toBeVisible();

        // Cancel and hide the MobilityLanes layer
        await page.getByRole('button', { name: 'Cancel area selection' }).click();
        await page.locator('#MobilityLanes-legend').dispatchEvent('click');
        await page.waitForTimeout(100);

        // Drag-select again — only the modal filter should be found (polyline hidden)
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 80);
        await page.waitForTimeout(200);
        await expect(page.getByText('1 feature selected')).toBeVisible();
    });
});
