import { test, expect } from '@playwright/test';
import {
    setupPage,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    openGroupDetails,
    createGroup
} from './groupTestHelpers';

test.describe('Groups — Select and zoom', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('clicking a group name selects all members and shows them as selected', async ({
        page
    }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Zoom Group');

        // Creating the group closes selection mode.
        await expect(page.getByText('features selected', { exact: false })).not.toBeVisible();

        // Click group name to highlight + zoom (without manually activating the
        // selection tool first).
        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Zoom Group/ }).click();
        await page.waitForTimeout(300);

        // Members are highlighted...
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);
        // ...but the map is NOT put into selection mode (no selection panel).
        await expect(page.getByText('features selected', { exact: false })).not.toBeVisible();
    });

    test('clicking a group member removes it from the group', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Toggle Group');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Toggle Group/ }).click();
        await page.waitForTimeout(300);

        const selectedFilters = page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]');
        await expect(selectedFilters).toHaveCount(2);

        const selectedFilterBox = await selectedFilters.first().boundingBox();
        if (!selectedFilterBox) throw new Error('Selected modal filter not found');
        await page.mouse.click(
            selectedFilterBox.x + selectedFilterBox.width / 2,
            selectedFilterBox.y + selectedFilterBox.height / 2
        );
        await page.waitForTimeout(200);

        await expect(selectedFilters).toHaveCount(1);
        await page.getByRole('button', { name: 'Close group details' }).click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Toggle Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(1 feature)', {
                exact: true
            })
        ).toBeVisible();

        await page.getByRole('button', { name: 'Close group details' }).click();
        await page.locator('#undo-button').click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Toggle Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(2 features)', {
                exact: true
            })
        ).toBeVisible();

        await page.getByRole('button', { name: 'Close group details' }).click();
        await page.locator('#redo-button').click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Toggle Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(1 feature)', {
                exact: true
            })
        ).toBeVisible();
    });

    test('Escape clears all highlights after selecting a group', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Escape Group');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Escape Group/ }).click();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);

        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');

        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
    });

    test('Escape while typing does not clear group highlights', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Typing Group');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Typing Group/ }).click();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);

        await page.locator('#settings-button').click();
        await page.locator('#title').focus();
        await page.keyboard.press('Escape');

        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);
    });

    test('switching groups clears the previous point highlights', async ({ page }) => {
        await placeTwoModalFilters(page, 70);
        await selectBothFilters(page);
        await createGroup(page, 'First Group');

        await placeTwoModalFilters(page, 70, 180);
        await selectBothFilters(page, 0, 180);
        await createGroup(page, 'Second Group');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group First Group/ }).click();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Second Group/ }).click();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);
        await expect(page.locator('.leaflet-filters-pane path[stroke="green"]')).toHaveCount(2);
    });
});
