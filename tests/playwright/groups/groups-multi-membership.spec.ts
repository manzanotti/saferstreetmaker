import { test, expect } from '@playwright/test';
import {
    setupPage,
    dragSelectCenter,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    createGroup
} from './groupTestHelpers';

test.describe('Groups — Multi-group membership', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('an element can belong to more than one group', async ({ page }) => {
        await placeTwoModalFilters(page, 40);

        // Select both, create Group A.
        await selectBothFilters(page);
        await createGroup(page, 'Group A');

        // Creating a group now closes the selection pop-up, so a single click
        // re-activates area selection for the next group.
        await page.waitForTimeout(200);
        await page.locator('#select-area-button').click(); // activate
        await dragSelectCenter(page, 120);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroup(page, 'Group B');

        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group Group A/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Select group Group B/ })).toBeVisible();
        // Both groups have 2 members.
        await expect(page.locator('text=(2)').first()).toBeVisible();
    });
});
