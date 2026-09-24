import { test, expect } from '@playwright/test';
import {
    setupPage,
    dragSelectCenter,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    createGroup
} from './groupTestHelpers';

test.describe('Groups — Visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('toggling a group invisible hides the visibility indicator', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Visible Group');

        await openGroupsPanel(page);
        const toggleBtn = page.getByRole('button', { name: 'Hide group Visible Group' });
        await expect(toggleBtn).toBeVisible();
        await toggleBtn.click();
        await page.waitForTimeout(100);

        await expect(page.getByRole('button', { name: 'Show group Visible Group' })).toBeVisible();
    });

    test('master show-all/hide-all toggle appears when there are groups', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Group A');

        await openGroupsPanel(page);
        await expect(page.locator('#groups-master-toggle')).toBeVisible();
    });

    test('master toggle hides all groups at once', async ({ page }) => {
        // Create two groups in sequence.
        await placeTwoModalFilters(page, 40);
        await selectBothFilters(page);
        await createGroup(page, 'Group One');

        // Creating a group now closes the selection pop-up, so a single click
        // re-activates area selection for the next group.
        await page.waitForTimeout(200);
        await page.locator('#select-area-button').click(); // activate
        await dragSelectCenter(page, 120);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroup(page, 'Group Two');

        await openGroupsPanel(page);
        // Master toggle is unchecked by default.
        await expect(page.locator('#groups-master-toggle')).not.toBeChecked();

        // Check (hide all).
        await page.locator('#groups-master-toggle').check();
        await page.waitForTimeout(100);

        await expect(page.getByRole('button', { name: 'Show group Group One' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show group Group Two' })).toBeVisible();
    });
});
