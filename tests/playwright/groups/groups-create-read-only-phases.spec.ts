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

test.describe('Groups — Create group: read-only-phases', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('read-only group details shows the single-phase summary', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Single Phase Group');
        await setGroupPhases(page, 1);

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');

        const dialog = page.getByRole('dialog', { name: 'Single Phase Group' });
        await expect(dialog.getByText('Implemented in one phase', { exact: true })).toBeVisible();
        await expect(dialog.getByRole('list', { name: 'Group phases' })).toHaveCount(0);
    });

    test('read-only group details embeds the multi-phase player', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Multi Phase Group');
        await setGroupPhases(page, 2);

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');

        const dialog = page.getByRole('dialog', { name: 'Multi Phase Group' });
        await expect(dialog.getByRole('list', { name: 'Group phases' })).toBeVisible();
        await expect(dialog.getByRole('heading', { name: 'Implementation Phases' })).toBeVisible();
        const dialogBox = await dialog.boundingBox();
        expect(dialogBox).not.toBeNull();
        expect(dialogBox!.width).toBeCloseTo(336, 0);
        await expect(dialog.getByRole('listitem')).toHaveCount(2);
        await expect(dialog.getByRole('button', { name: 'Play phases' })).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Previous phase' })).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Next phase' })).toBeVisible();
        await expect(page.getByRole('dialog', { name: /phases/ })).toHaveCount(0);
    });
});
