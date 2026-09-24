import { test, expect } from '@playwright/test';
import {
    setupPage,
    placeModalFilter,
    dragSelectCenter,
    dragSelectLastModalFilter,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    openGroupDetails,
    createGroup,
    createGroupWithDescription,
    setGroupPhases,
    createGroupVersion,
    drawNamedLtnCell,
    drawNamedMobilityLane
} from './groupTestHelpers';

test.describe('Groups — Create group: panel-shortcuts', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('read-only multi-version details hides View on the selected version', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Versioned Group');
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned Group');
        await createGroupVersion(page, 'Alternative');
        await page.getByRole('button', { name: 'Close group details' }).click();

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');

        const dialog = page.getByRole('dialog', { name: 'Versioned Group' });
        await expect(dialog.getByRole('heading', { name: 'Versions' })).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'View version Alternative' })).toHaveCount(
            0
        );
        await expect(dialog.getByRole('button', { name: 'View version Default' })).toBeVisible();
    });

    test('Groups panel shows empty state message when no groups', async ({ page }) => {
        await openGroupsPanel(page);
        await expect(page.getByText('No groups yet')).toBeVisible();
    });

    test('Escape key closes the Groups panel', async ({ page }) => {
        await openGroupsPanel(page);
        await expect(page.locator('#groups-button')).toHaveAttribute('title', 'Manage groups');
    });

    test('the G key toggles the Groups popup', async ({ page }) => {
        // Ensure the map has focus context for the shortcut.
        await page.locator('#map').click();
        await page.keyboard.press('g');
        await expect(page.getByText('No groups yet')).toBeVisible();

        await page.keyboard.press('g');
        await expect(page.getByText('No groups yet')).not.toBeVisible();
    });

    test('Escape closes the keyboard-opened panel and keeps shortcuts available', async ({
        page
    }) => {
        await page.locator('#map').click();
        await page.keyboard.press('g');
        await expect(page.getByText('No groups yet')).toBeVisible();
        await page.locator('#groups-button').focus();

        await page.keyboard.press('Escape');

        await expect(page.getByText('No groups yet')).not.toBeVisible();
        await expect(page.locator('#groups-button')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('#groups-button')).not.toBeFocused();

        await page.keyboard.press('s');
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'true');
    });
});
