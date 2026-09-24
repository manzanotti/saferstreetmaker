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

test.describe('Groups — Create group: editing', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('removing the final member offers to delete the empty group', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectLastModalFilter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroup(page, 'Single Member Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Single Member Group');
        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        const markerBox = await marker.boundingBox();
        if (!markerBox) throw new Error('Grouped modal filter not found');
        await page.mouse.click(
            markerBox.x + markerBox.width / 2,
            markerBox.y + markerBox.height / 2
        );

        await expect(page.getByText('Single Member Group is now empty.')).toBeVisible();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(
            page.getByRole('button', { name: /Select group Single Member Group/ })
        ).toHaveCount(0);
        await expect(marker).toHaveCount(1);
    });

    test('undoing final-member removal hides the empty-group deletion prompt', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectLastModalFilter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroup(page, 'Undo Empty Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Undo Empty Group');
        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        const markerBox = await marker.boundingBox();
        if (!markerBox) throw new Error('Grouped modal filter not found');
        await page.mouse.click(
            markerBox.x + markerBox.width / 2,
            markerBox.y + markerBox.height / 2
        );
        await expect(page.getByText('Undo Empty Group is now empty.')).toBeVisible();

        await page.locator('#undo-button').click();

        await expect(page.getByText('Undo Empty Group is now empty.')).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: /Select group Undo Empty Group/ })
        ).toContainText('(1)');
        await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
    });

    test('the map remains pannable while group details are open', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Pannable Group');
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Pannable Group');

        const map = page.locator('.leaflet-container');
        const mapPane = page.locator('.leaflet-map-pane');
        const mapBox = await map.boundingBox();
        if (!mapBox) throw new Error('Map bounding box not found');
        const beforeTransform = await mapPane.evaluate((pane) => pane.getAttribute('style'));
        const startX = mapBox.x + 90;
        const startY = mapBox.y + 120;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 100, startY + 40, { steps: 10 });
        await page.mouse.up();

        await expect
            .poll(() => mapPane.evaluate((pane) => pane.getAttribute('style')))
            .not.toBe(beforeTransform);
        await expect(page.getByRole('dialog', { name: 'Group details' })).toBeVisible();
    });

    test('feature hover popup renders the descriptions of its groups', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        await marker.dispatchEvent('mouseover');

        const popup = page.locator('.leaflet-popup');
        await expect(popup).toBeVisible();
        await expect(popup.locator('.feature-popup-group-description')).toContainText(
            'School Zone'
        );
        await expect(popup.locator('.feature-popup-description')).toContainText(
            'Slow down near school'
        );
    });

    test('ungrouped feature hover does not show a popup in either mode', async ({ page }) => {
        await placeModalFilter(page, 110);
        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();

        await marker.hover();
        await expect(page.locator('.leaflet-popup.feature-popup-hover')).toHaveCount(0);

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();

        await marker.hover();
        await expect(page.locator('.leaflet-popup.feature-popup-hover')).toHaveCount(0);
        await expect
            .poll(() => marker.evaluate((element) => getComputedStyle(element).cursor))
            .toBe('default');
    });
});
