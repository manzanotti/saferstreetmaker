import { test, expect } from '@playwright/test';
import {
    setupPage,
    placeModalFilter,
    dragSelectCenter,
    placeTwoModalFilters,
    selectBothFilters
} from './groupTestHelpers';

test.describe('Groups — Group button visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('Group button is visible when one feature is selected', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Add selected features to a group' })
        ).toBeVisible();
    });

    test('Group button IS visible when 2 or more features are selected', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await expect(
            page.getByRole('button', { name: 'Add selected features to a group' })
        ).toBeVisible();
    });
});
