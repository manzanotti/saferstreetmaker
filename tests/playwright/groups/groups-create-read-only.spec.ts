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

test.describe('Groups — Create group: read-only', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('read-only simple feature click does not open the group viewer', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();

        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        await marker.dispatchEvent('click');

        await expect(page.getByRole('dialog', { name: 'School Zone' })).toHaveCount(0);
    });

    test('read-only simple groups do not open the group panel', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Simple Group');

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();

        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');

        await expect(page.getByRole('dialog', { name: 'Simple Group' })).toHaveCount(0);
        await expect(page.locator('.group-popup-title')).toHaveCount(0);
    });

    test('turning read-only off restores features faded by a selected group', async ({ page }) => {
        await placeTwoModalFilters(page, 70, -120);
        await selectBothFilters(page, 0, -120);
        await createGroup(page, 'Focused Group');
        await placeModalFilter(page, 0, 120);

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();

        const markers = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await markers.first().dispatchEvent('click');
        await expect(markers.nth(2)).toHaveAttribute('stroke-opacity', '0.12');

        await page.locator('#settings-button').click();
        await page.locator('#read-only').uncheck();
        await page.getByRole('button', { name: 'Save' }).click();

        await expect(markers.nth(2)).toHaveAttribute('stroke-opacity', '1');
    });

    test('clicking a simple group closes an open phased group viewer', async ({ page }) => {
        await placeTwoModalFilters(page, 70, -120);
        await selectBothFilters(page, 0, -120);
        await createGroupWithDescription(page, 'Phased Group', '<p>Build in phases</p>');
        await setGroupPhases(page, 1);

        await placeTwoModalFilters(page, 70, 120);
        await selectBothFilters(page, 0, 120);
        await createGroup(page, 'Simple Group');

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();

        const markers = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await markers.nth(0).dispatchEvent('click');
        await expect(page.getByRole('dialog', { name: 'Phased Group' })).toBeVisible();

        await markers.nth(2).dispatchEvent('click');
        await expect(page.getByRole('dialog', { name: 'Phased Group' })).toHaveCount(0);
        await expect(page.getByRole('dialog', { name: 'Simple Group' })).toHaveCount(0);
    });

    test('read-only grouped feature hover shows the group popup', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');
        await setGroupPhases(page, 1);

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();

        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        await marker.hover();

        const popup = page.locator('.leaflet-popup.group-popup').last();
        await expect(popup).toBeVisible();
        const firstPopupBox = await popup.boundingBox();
        await expect(popup.locator('.group-popup-title')).toHaveText('School Zone');
        await expect(popup.locator('.feature-popup-description')).toContainText(
            'Slow down near school'
        );
        await expect(page.locator('.leaflet-popup.feature-popup-hover')).toHaveCount(0);

        await page.locator('.leaflet-filters-pane path.modal-filter-marker').nth(1).hover();
        const secondPopupBox = await page
            .locator('.leaflet-popup.group-popup')
            .last()
            .boundingBox();
        expect(firstPopupBox).not.toBeNull();
        expect(secondPopupBox).not.toBeNull();
        expect(secondPopupBox!.x).toBeCloseTo(firstPopupBox!.x, 0);
        expect(secondPopupBox!.y).toBeCloseTo(firstPopupBox!.y, 0);

        await page
            .locator('.leaflet-popup.group-popup')
            .last()
            .getByRole('button', { name: 'Open group School Zone' })
            .click();
        await expect(page.getByRole('dialog', { name: 'School Zone' })).toBeVisible();
    });

    test('read-only group details cannot edit metadata, membership, or phases', async ({
        page
    }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Read-only Group');
        await setGroupPhases(page, 1);

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');

        const dialog = page.getByRole('dialog', { name: 'Read-only Group' });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('textbox')).toHaveCount(0);
        await expect(dialog.getByRole('heading', { name: 'Versions' })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: /Phases for version/ })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Create version' })).toHaveCount(0);
    });
});
