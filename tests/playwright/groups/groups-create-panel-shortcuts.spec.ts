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
        await placeTwoModalFilters(page, 170);
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned Group');
        await createGroupVersion(page, 'Versioned Group', 'Alternative');
        for (const index of [2, 3]) {
            await page
                .locator('.leaflet-filters-pane path.modal-filter-marker')
                .nth(index)
                .dispatchEvent('click');
        }
        await page.getByRole('button', { name: 'Close group details' }).click();

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .last()
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
        await expect(page.getByText('No groups yet')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByText('No groups yet')).not.toBeVisible();
    });

    test('the G key toggles the Groups popup', async ({ page }) => {
        // Ensure the map has focus context for the shortcut.
        await page.locator('#map').click();
        await page.keyboard.press('g');
        await expect(page.getByText('No groups yet')).toBeVisible();

        await page.keyboard.press('g');
        await expect(page.getByText('No groups yet')).not.toBeVisible();
    });

    for (const focusTarget of ['dialog', 'map', 'groups panel'] as const) {
        test(`Escape from the ${focusTarget} preserves selected group members`, async ({
            page
        }) => {
            await placeTwoModalFilters(page);
            await selectBothFilters(page);
            await createGroup(page, 'Escape Safety Group');
            await openGroupsPanel(page);
            await openGroupDetails(page, 'Escape Safety Group');
            const dialog = page.getByRole('dialog', { name: 'Group details' });
            await expect(dialog.getByText('(2 features)', { exact: true })).toBeVisible();
            const originalMembers = await page.evaluate(() => {
                const app = (document.getElementById('app') as any).__vue_app__;
                return app.config.globalProperties.$pinia._s.get('group').groups[0].members;
            });

            if (focusTarget === 'map') {
                await page.locator('#map').focus();
            } else if (focusTarget === 'groups panel') {
                await openGroupsPanel(page);
                await expect(dialog).not.toBeVisible();
            } else {
                await dialog.getByRole('button', { name: 'Close group details' }).focus();
            }
            await page.keyboard.press('Escape');

            const groupState = await page.evaluate(() => {
                const app = (document.getElementById('app') as any).__vue_app__;
                const pinia = app.config.globalProperties.$pinia;
                const store = pinia._s.get('group');
                return {
                    members: store.groups[0].members,
                    pendingEmptyGroupDeletionId: store.pendingEmptyGroupDeletionId
                };
            });
            expect(groupState.members).toEqual(originalMembers);
            expect(groupState.members).toHaveLength(2);
            expect(groupState.pendingEmptyGroupDeletionId).toBeNull();
            await expect(page.getByText('Escape Safety Group is now empty.')).toHaveCount(0);
            await expect(
                page.locator('.leaflet-filters-pane path.modal-filter-marker')
            ).toHaveCount(2);

            if (await dialog.isVisible()) {
                await dialog.getByRole('button', { name: 'Close group details' }).click();
            }
            await openGroupDetails(page, 'Escape Safety Group');
            await expect(dialog.getByText('(2 features)', { exact: true })).toBeVisible();
        });
    }

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
