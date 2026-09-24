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

test.describe('Groups — Create group: hover', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('polygon hover popup renders the descriptions of its groups', async ({ page }) => {
        await drawNamedLtnCell(page, 'School cell');

        await page.locator('#select-area-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click', { shiftKey: true });
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await polygon.dispatchEvent('mouseover');

        const popup = page.locator('.leaflet-popup');
        await expect(popup).toBeVisible();
        await expect(popup.locator('.feature-popup-group-description')).toContainText(
            'School Zone'
        );
        await expect(popup.locator('.feature-popup-description')).toContainText(
            'Slow down near school'
        );

        await popup.hover();
        await expect(popup).toBeVisible();
        await popup.getByRole('button', { name: 'School Zone' }).click();
        await expect(page.getByRole('dialog', { name: 'Group details' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save group changes' })).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: 'Add selected features to a group' })
        ).toHaveCount(0);
        await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
    });

    test('polygon hover popup closes when the pointer leaves the polygon', async ({ page }) => {
        await drawNamedLtnCell(page, 'School cell');

        await page.locator('#select-area-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click', { shiftKey: true });
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await polygon.dispatchEvent('mouseover');
        await expect(page.locator('.leaflet-popup')).toBeVisible();

        await polygon.dispatchEvent('mouseout');
        await expect(page.locator('.leaflet-popup')).toHaveCount(0);
    });

    test('polyline hover popup shows while its editor is open', async ({ page }) => {
        await placeModalFilter(page, 110);
        await drawNamedMobilityLane(page, 'Mobility lane');

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 160);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        const polyline = page
            .locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive')
            .first();
        await page.locator('#mobility-lane-button').click();
        await polyline.dispatchEvent('click');
        await expect(page.locator('.leaflet-popup')).toBeVisible();

        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        await marker.hover();
        await expect(page.locator('.leaflet-popup.feature-popup-hover')).toBeVisible();
    });

    test('polyline hover popup shows while its editor is open on the same feature', async ({
        page
    }) => {
        await drawNamedMobilityLane(page, 'Mobility lane');

        await page.locator('#select-area-button').click();
        const polyline = page
            .locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive')
            .first();
        await polyline.dispatchEvent('click', { shiftKey: true });
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await page.locator('#mobility-lane-button').click();
        await polyline.dispatchEvent('click');
        await expect(page.locator('.leaflet-popup')).toBeVisible();

        await polyline.dispatchEvent('mouseover');
        await expect(page.locator('.leaflet-popup.feature-popup-hover')).toBeVisible();
    });

    test('polygon hover popup shows while a polyline editor is open', async ({ page }) => {
        await drawNamedLtnCell(page, 'School cell');

        await page.locator('#select-area-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click', { shiftKey: true });
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await drawNamedMobilityLane(page, 'Mobility lane');
        const polyline = page
            .locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive')
            .first();
        await page.locator('#mobility-lane-button').click();
        await polyline.dispatchEvent('click');
        await expect(page.locator('.leaflet-popup')).toBeVisible();

        await polygon.dispatchEvent('mouseover');
        await expect(page.locator('.leaflet-popup.feature-popup-hover')).toBeVisible();
    });

    test('polygon click popup lists its groups', async ({ page }) => {
        await drawNamedLtnCell(page, 'School cell');

        await page.locator('#select-area-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click', { shiftKey: true });
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await page.locator('#ltn-button').click();
        await polygon.dispatchEvent('click');

        const popup = page.locator('.leaflet-popup');
        await expect(popup).toBeVisible();
        await expect(popup.locator('.feature-popup-groups')).toContainText('School Zone');
        const popupControls = popup.locator('.ltn-popup-buttons > *');
        await expect(popupControls.nth(0)).toHaveClass(/current-controls/);
        await expect(popupControls.nth(1)).toHaveClass(/feature-popup-group-content/);
        await expect(popupControls).toHaveCount(2);
        await expect(popup.locator('.label-editor')).toHaveCSS('border-top-width', '1px');
        await expect(popup.locator('.label-editor')).toHaveCSS(
            'border-top-color',
            'rgb(209, 213, 219)'
        );
        await expect(popup.locator('.colour-swatch')).toHaveCSS('border-top-width', '1px');
        await expect(popup.locator('.colour-swatch')).toHaveCSS(
            'border-top-color',
            'rgb(209, 213, 219)'
        );
        await expect(popup.locator('.label-editor')).toHaveCSS('padding-top', '4px');
        await expect(popup.locator('.label-editor')).toHaveCSS('padding-left', '8px');
        await expect(popup.locator('.ltn-popup-buttons > .feature-popup-group-content')).toHaveCSS(
            'margin-top',
            '12px'
        );
    });
});
