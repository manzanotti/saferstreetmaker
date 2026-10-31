import { test, expect } from '@playwright/test';
import { getLayerFeatureCount } from './indexedDbHelpers';
import {
    setupPage,
    placeModalFilter,
    dragSelectCenter,
    placeTwoModalFilters
} from './areaSelectionTestHelpers';

// ---------------------------------------------------------------------------
// Additive drag selection (Shift / Ctrl)
// ---------------------------------------------------------------------------
test.describe('Area selection — additive drag (Shift/Ctrl)', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('Shift-drag adds newly found features to an existing selection', async ({ page }) => {
        await placeTwoModalFilters(page, 70);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);

        await page.locator('#select-area-button').click();

        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        // First drag: select only the left filter
        await page.mouse.move(cx - 120, cy - 50);
        await page.mouse.down();
        await page.mouse.move(cx - 20, cy + 50, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        // Shift-drag: add the right filter without clearing the first
        await page.keyboard.down('Shift');
        await page.mouse.move(cx + 20, cy - 50);
        await page.mouse.down();
        await page.mouse.move(cx + 120, cy + 50, { steps: 10 });
        await page.mouse.up();
        await page.keyboard.up('Shift');
        await page.waitForTimeout(200);

        await expect(page.getByText('2 features selected')).toBeVisible();
    });

    test('Ctrl-drag adds newly found features to an existing selection', async ({ page }) => {
        await placeTwoModalFilters(page, 70);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);

        await page.locator('#select-area-button').click();

        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        // Select left filter
        await page.mouse.move(cx - 120, cy - 50);
        await page.mouse.down();
        await page.mouse.move(cx - 20, cy + 50, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        // Ctrl-drag to add the right filter
        await page.keyboard.down('Control');
        await page.mouse.move(cx + 20, cy - 50);
        await page.mouse.down();
        await page.mouse.move(cx + 120, cy + 50, { steps: 10 });
        await page.mouse.up();
        await page.keyboard.up('Control');
        await page.waitForTimeout(200);

        await expect(page.getByText('2 features selected')).toBeVisible();
    });

    test('plain drag replaces an existing selection', async ({ page }) => {
        await placeTwoModalFilters(page, 70);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);

        await page.locator('#select-area-button').click();

        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        // Select both
        await dragSelectCenter(page, 120);
        await page.waitForTimeout(200);
        await expect(page.getByText('2 features selected')).toBeVisible();

        // Plain drag over only the right feature replaces the selection
        await page.mouse.move(cx + 20, cy - 50);
        await page.mouse.down();
        await page.mouse.move(cx + 120, cy + 50, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(200);

        await expect(page.getByText('1 feature selected')).toBeVisible();
    });

    test('additive drag over an already-selected feature does not duplicate it', async ({
        page
    }) => {
        await placeModalFilter(page);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.waitForTimeout(200);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        // Shift-drag over the same feature again — count must stay 1
        await page.keyboard.down('Shift');
        await dragSelectCenter(page);
        await page.keyboard.up('Shift');
        await page.waitForTimeout(200);

        await expect(page.getByText('1 feature selected')).toBeVisible();
    });
});
