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

test.describe('Groups — Create group: basics', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('group details toggles membership directly without enabling area selection', async ({
        page
    }) => {
        await placeTwoModalFilters(page, 100);
        await page.locator('#select-area-button').click();
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroup(page, 'Editable Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Editable Group');
        const dialog = page.getByRole('dialog', { name: 'Group details' });
        await expect(dialog.locator('button.delete-button')).toHaveCount(1);
        await expect(dialog.locator('h2 + button.delete-button')).toHaveCount(1);
        await expect(dialog.locator('button.delete-button')).not.toHaveCSS(
            'background-image',
            'none'
        );
        await expect(page.locator('#map')).not.toHaveClass(/area-select/);
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
        await expect
            .poll(() => page.locator('#map').evaluate((map) => getComputedStyle(map).cursor))
            .toBe('grab');
        await expect
            .poll(() =>
                page
                    .locator('.leaflet-filters-pane path.modal-filter-marker')
                    .first()
                    .evaluate((feature) => getComputedStyle(feature).cursor)
            )
            .toBe('crosshair');
        await expect(dialog.getByRole('button', { name: 'Add features' })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Remove all' })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);

        const markers = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await markers.nth(1).dispatchEvent('click');
        await expect(dialog.getByText('(2 features)', { exact: true })).toBeVisible();
        await page.waitForTimeout(150);
        await markers.first().dispatchEvent('click');
        await expect(dialog.getByText('(1 feature)', { exact: true })).toBeVisible();

        await dialog.getByRole('button', { name: 'Close group details' }).click();
    });

    test('closing group details without editing preserves all members', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Unchanged Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Unchanged Group');
        const dialog = page.getByRole('dialog', { name: 'Group details' });
        await expect(dialog.getByText('(2 features)', { exact: true })).toBeVisible();
        await dialog.getByRole('button', { name: 'Close group details' }).click();

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Unchanged Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(2 features)', {
                exact: true
            })
        ).toBeVisible();
    });

    test('opening the Groups panel fully closes group editing', async ({ page }) => {
        await placeTwoModalFilters(page);
        await page.locator('#select-area-button').click();
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');
        await createGroup(page, 'Panel Close Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Panel Close Group');
        await page.locator('#groups-button').click();

        await expect(page.getByRole('dialog', { name: 'Group details' })).toHaveCount(0);
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
        const ungroupedMarker = page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .last();
        await ungroupedMarker.dispatchEvent('click');
        await expect(page.locator('.leaflet-popup')).toBeVisible();

        await page.keyboard.press('Escape');
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Panel Close Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(1 feature)', {
                exact: true
            })
        ).toBeVisible();
    });
});
