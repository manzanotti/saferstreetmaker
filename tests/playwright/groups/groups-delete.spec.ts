import { test, expect } from '@playwright/test';
import { getLayerFeatureCount } from '../indexedDbHelpers';
import {
    setupPage,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    createGroup
} from './groupTestHelpers';

test.describe('Groups — Delete group with elements', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('deleting a group removes it and its features from the map', async ({ page }) => {
        await placeTwoModalFilters(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);

        await selectBothFilters(page);
        await createGroup(page, 'Delete Me');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Delete group Delete Me' }).click();

        // Choose "delete group + elements".
        await page.getByRole('button', { name: 'Delete group + elements' }).click();
        await page.waitForTimeout(300);

        // Group should be gone.
        await expect(
            page.getByRole('button', { name: /Select group Delete Me/ })
        ).not.toBeVisible();

        // Features should be removed from the map.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(0);
    });

    test('deleting a group only keeps its features on the map', async ({ page }) => {
        await placeTwoModalFilters(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);

        await selectBothFilters(page);
        await createGroup(page, 'Keep Features');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Delete group Keep Features' }).click();

        // Choose "delete group only".
        await page.getByRole('button', { name: 'Delete group only' }).click();
        await page.waitForTimeout(300);

        // Group should be gone.
        await expect(
            page.getByRole('button', { name: /Select group Keep Features/ })
        ).not.toBeVisible();

        // Features should remain on the map.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
    });

    test('deleting a group only clears the selection highlight from its elements', async ({
        page
    }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Keep');

        // Select the group so its members are highlighted.
        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Keep/ }).click();
        await page.waitForTimeout(300);
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);

        // Delete the group only.
        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Delete group Keep' }).click();
        await page.getByRole('button', { name: 'Delete group only' }).click();
        await page.waitForTimeout(300);

        // Highlight is cleared, but the two filters remain on the map.
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
    });

    test('delete group with elements is undoable', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Undo Delete');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Delete group Undo Delete' }).click();
        await page.getByRole('button', { name: 'Delete group + elements' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(0);

        // Close the Groups panel so the undo button is accessible.
        const finalCloseGroupsButton = page.getByRole('button', { name: 'Close groups panel' });
        if (await finalCloseGroupsButton.isVisible()) {
            await finalCloseGroupsButton.click();
        }
        await page.waitForTimeout(100);

        // Undo.
        await page.locator('#undo-button').click();
        await page.waitForTimeout(500);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
        // Group should be restored — re-open the panel to verify.
        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group Undo Delete/ })).toBeVisible();
    });
});
