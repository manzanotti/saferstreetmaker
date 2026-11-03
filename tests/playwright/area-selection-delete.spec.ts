import { test, expect } from '@playwright/test';
import { getLayerFeatureCount } from './indexedDbHelpers';
import { setupPage, placeModalFilter, dragSelectCenter } from './areaSelectionTestHelpers';

test.describe('Area selection — select and delete', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('area-selection panel is not visible before mode is active', async ({ page }) => {
        // The panel only renders when isActive && selected.length > 0
        await expect(page.getByText('selected', { exact: false })).not.toBeVisible();
    });

    test('dragging over a placed point shows the area selection panel', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();
    });

    test('cancel button hides the panel without deleting', async ({ page }) => {
        await placeModalFilter(page);
        const countBefore = await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters');

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Cancel area selection' }).click();
        await expect(page.getByText('selected', { exact: false })).not.toBeVisible();

        const countAfter = await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters');
        expect(countAfter).toBe(countBefore);
    });

    test('delete button removes selected points and persists the deletion', async ({ page }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(0);
    });

    test('delete enables the undo button', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(300);
        await expect(page.locator('#undo-button')).toBeEnabled();
    });

    test('undo after batch delete restores the deleted points', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(300);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(0);

        await page.locator('#undo-button').click();
        await page.waitForTimeout(300);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);
    });

    test('panel disappears and mode deactivates after delete', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(200);

        await expect(page.getByText('selected', { exact: false })).not.toBeVisible();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('dragging over multiple points selects all of them', async ({ page }) => {
        // Activate modal filter once, place two points, then deactivate
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await page.locator('#modal-filter-button').click(); // activate layer
        await page.mouse.click(cx - 60, cy); // place point 1
        await page.waitForTimeout(150);
        await page.mouse.click(cx + 60, cy); // place point 2 (layer still active)
        await page.waitForTimeout(150);
        await page.locator('#modal-filter-button').click(); // deactivate

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 150);

        await expect(page.getByText('2 features selected')).toBeVisible();
    });

    test('pressing s outside the map does not toggle area-select mode', async ({ page }) => {
        await page.locator('#settings-button').focus();
        await page.keyboard.press('s');
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('pressing s with body focus toggles area-select mode', async ({ page }) => {
        await page.locator('body').focus();
        await page.keyboard.press('s');
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('pressing s after deselecting a layer button toggles area-select mode', async ({
        page
    }) => {
        // Activate then immediately deactivate a layer button — focus stays on
        // the button.  The 's' shortcut must still work.
        await page.locator('#modal-filter-button').click();
        await page.locator('#modal-filter-button').click();
        await page.keyboard.press('s');
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('Delete key does not fire when a toolbar button has focus', async ({ page }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        // Activate selection mode and select the point
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        // Move focus to a toolbar button (non-map element) and press Delete
        await page.locator('#select-area-button').focus();
        await page.keyboard.press('Delete');
        await page.waitForTimeout(150);

        // Point should still exist — Delete was blocked by the isMapContext guard
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);
    });
});
