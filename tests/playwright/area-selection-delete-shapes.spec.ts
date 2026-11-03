import { test, expect } from '@playwright/test';
import { getLayerFeatureCount } from './indexedDbHelpers';
import {
    setupPage,
    dragSelectCenter,
    drawMobilityLane,
    drawLtnPolygon
} from './areaSelectionTestHelpers';

test.describe('Area selection — select and delete', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('dragging over a polyline vertex selects it and delete trims only that vertex', async ({
        page
    }) => {
        await drawMobilityLane(page);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 40);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(500);

        // The mobility lane feature should still exist after trimming one vertex.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);
    });

    test('undo after polyline vertex deletion restores the trimmed vertex', async ({ page }) => {
        await drawMobilityLane(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 40);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(500);

        // The polyline is trimmed but still present.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);

        await page.locator('#undo-button').click();
        await page.waitForTimeout(300);

        // After undo the full-length polyline is still present (not removed).
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);
    });

    test('dragging over polygon interior selects the polygon and delete removes it', async ({
        page
    }) => {
        await drawLtnPolygon(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(1);

        await page.locator('#select-area-button').click();
        // Drag over the interior, not a corner vertex.
        await dragSelectCenter(page, 45);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(500);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(0);
    });

    test('undo after polygon batch delete restores the polygon', async ({ page }) => {
        await drawLtnPolygon(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 45);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(500);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(0);

        await page.locator('#undo-button').click();
        await page.waitForTimeout(300);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(1);
    });
});
