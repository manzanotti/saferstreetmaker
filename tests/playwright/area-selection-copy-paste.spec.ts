import { test, expect } from '@playwright/test';
import { getLayerFeatureCount } from './indexedDbHelpers';
import {
    setupPage,
    placeModalFilter,
    dragSelectCenter,
    drawMobilityLane
} from './areaSelectionTestHelpers';

test.describe('Area selection — copy and paste', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('Copy button is not visible before any features are selected', async ({ page }) => {
        await page.locator('#select-area-button').click();
        await expect(
            page.getByRole('button', { name: 'Copy selected features' })
        ).not.toBeVisible();
    });

    test('Copy button appears when features are selected', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByRole('button', { name: 'Copy selected features' })).toBeVisible();
    });

    test('Paste button is not visible before copying', async ({ page }) => {
        await page.locator('#select-area-button').click();
        await expect(page.getByRole('button', { name: 'Paste copied features' })).not.toBeVisible();
    });

    test('copying a point shows the Paste button', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Copy selected features' }).click();
        await expect(page.getByRole('button', { name: 'Paste copied features' })).toBeVisible();
    });

    test('pasting a copied point increases the layer feature count', async ({ page }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Copy selected features' }).click();
        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
    });

    test('Ctrl+C copies selected features and Ctrl+V pastes them', async ({ page }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.keyboard.press('Control+c');
        await page.keyboard.press('Control+v');
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
    });

    test('Paste is available after deselecting (clipboard persists)', async ({ page }) => {
        await placeModalFilter(page);

        // Copy then drag away from the feature to clear the selection
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Copy selected features' }).click();

        // Drag an empty area to clear selection without leaving mode
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        await page.mouse.move(box.x + 10, box.y + 10);
        await page.mouse.down();
        await page.mouse.move(box.x + 30, box.y + 30, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(200);

        // Paste button should still be present (clipboard not cleared)
        await expect(page.getByRole('button', { name: 'Paste copied features' })).toBeVisible();
    });

    test('pasted features get independent historyIds (undo removes only the paste)', async ({
        page
    }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Copy selected features' }).click();
        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await page.waitForTimeout(300);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);

        // Undo the paste — only the pasted copy should be removed
        await page.locator('#undo-button').click();
        await page.waitForTimeout(300);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);
    });

    test('copy/paste of a selected polyline subset pastes only that subset', async ({ page }) => {
        await drawMobilityLane(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);

        await page.locator('#select-area-button').click();
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        // Select the middle and right-hand vertices of the three-point line.
        await page.mouse.move(cx - 10, cy - 30);
        await page.mouse.down();
        await page.mouse.move(cx + 80, cy + 30, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Copy selected features' }).click();
        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await page.waitForTimeout(500);

        // A copied subset becomes a second polyline feature.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(2);
    });

    test('pasting into a hidden layer makes that layer visible again', async ({ page }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Copy selected features' }).click();

        // Hide the target layer before paste.
        await page.locator('#ModalFilters-legend').dispatchEvent('click');
        await page.waitForTimeout(100);

        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await page.waitForTimeout(300);

        // The layer should be visible again and contain the pasted copy.
        await expect(page.locator('#ModalFilters-legend')).toHaveAttribute('aria-pressed', 'true');
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
    });
});
