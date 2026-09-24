import { test, expect } from '@playwright/test';
import {
    setupPage,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    openGroupDetails,
    createGroup
} from './groupTestHelpers';

test.describe('Groups — Rename', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('renaming a group updates its name in the panel', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Old Name');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Old Name');
        const nameInput = page.getByLabel('Group name');
        await nameInput.fill('');
        await nameInput.pressSequentially('New Name');
        await page
            .getByRole('dialog', { name: 'Group details' })
            .getByRole('button', { name: 'Close group details' })
            .click();

        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group New Name/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Select group Old Name/ })).not.toBeVisible();

        await page.getByRole('button', { name: 'Close groups panel' }).click();
        await page.locator('#undo-button').click();
        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group Old Name/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Select group New Name/ })).toHaveCount(0);
    });
});
