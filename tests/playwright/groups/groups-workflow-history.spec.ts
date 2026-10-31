import { expect, test } from '@playwright/test';
import {
    setupPage,
    placeTwoModalFilters,
    selectBothFilters,
    createGroup,
    openGroupsPanel
} from './groupTestHelpers';

test('creating a group is one undoable workflow', async ({ page, context }) => {
    await setupPage(page, context);
    await placeTwoModalFilters(page);
    await selectBothFilters(page);
    await createGroup(page, 'School route');

    await expect(page.locator('#undo-button')).toBeEnabled();
    await page.locator('#undo-button').click();
    await openGroupsPanel(page);
    await expect(page.getByText('No groups yet')).toBeVisible();
    await openGroupsPanel(page);

    await expect(page.locator('#redo-button')).toBeEnabled();
    await page.locator('#redo-button').click();
    await openGroupsPanel(page);
    await expect(page.getByRole('button', { name: 'Select group School route' })).toBeVisible();
    await expect(page.locator('text=(2)').first()).toBeVisible();
});
