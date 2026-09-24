import { test, expect } from '@playwright/test';
import { getLayerFeatureCount } from '../indexedDbHelpers';
import {
    setupPage,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    openGroupDetails,
    createGroup,
    createGroupVersion,
    expectSelectedVersion
} from './groupTestHelpers';

test.describe('Groups — Delete version', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Versioned Group');
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned Group');
        await createGroupVersion(page, 'Alternative');
        await expectSelectedVersion(page, 'Alternative');
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);
    });

    test('deleting a version only prompts, keeps its elements, and clears highlights', async ({
        page
    }) => {
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(4);

        await page.getByRole('button', { name: 'Delete version Alternative' }).click();

        await expect(page.getByText('Delete version Alternative?')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete version only' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete version + elements' })).toBeVisible();
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(4);

        await page.getByRole('button', { name: 'Delete version only' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(4);
        await expect(
            page.getByRole('button', { name: 'Select version Alternative' })
        ).not.toBeVisible();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
    });

    test('deleting a version with its elements removes its features and clears highlights', async ({
        page
    }) => {
        await page.getByRole('button', { name: 'Delete version Alternative' }).click();
        await page.getByRole('button', { name: 'Delete version + elements' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
        await expect(
            page.getByRole('button', { name: 'Select version Alternative' })
        ).not.toBeVisible();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
    });
});
