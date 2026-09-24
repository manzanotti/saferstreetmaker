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

test.describe('Groups — Create group: feature-popups', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('keeps a grouped LTN outline colour after leaving edit mode', async ({ page }) => {
        await drawNamedLtnCell(page, 'School cell');
        await placeModalFilter(page, 120);

        await page.locator('#select-area-button').click();
        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        const modalFilter = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await dragSelectCenter(page, 180);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroup(page, 'School Zone');
        await openGroupsPanel(page);
        await openGroupDetails(page, 'School Zone');
        const originalGroupedStroke = await polygon.getAttribute('stroke');
        await page.locator('#group-details-colour').fill('#0088aa');
        await expect(polygon).toHaveAttribute('stroke', '#0088aa');
        await page
            .getByRole('dialog', { name: 'Group details' })
            .getByRole('button', { name: 'Close group details' })
            .click();
        await page.waitForTimeout(150);

        const groupedStroke = await polygon.getAttribute('stroke');
        expect(originalGroupedStroke).toBeTruthy();
        expect(groupedStroke).toBe('#0088aa');
        expect(groupedStroke).not.toBe('#cc00cc');
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
        await expect(page.locator('.leaflet-filters-pane path[stroke="green"]')).toHaveCount(
            await modalFilter.count()
        );

        await page.locator('#undo-button').click();
        await expect(polygon).toHaveAttribute('stroke', originalGroupedStroke!);
        await page.locator('#redo-button').click();
        await expect(polygon).toHaveAttribute('stroke', groupedStroke!);

        await page.locator('#ltn-button').click();
        await polygon.dispatchEvent('click');
        await expect(page.locator('.popup-buttons')).toHaveCount(1);
        await expect(polygon).toHaveAttribute('stroke', groupedStroke!);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);

        await expect(polygon).toHaveAttribute('stroke', groupedStroke!);
    });

    test('ungrouped feature editor uses selection mode to add to a group', async ({ page }) => {
        await placeModalFilter(page, -120);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 80, -120);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroup(page, 'Alpha Zone');

        await drawNamedLtnCell(page, 'School cell');
        await page.locator('#ltn-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click');

        const popup = page.locator('.leaflet-popup');
        await expect(popup.locator('.feature-popup-groups')).toContainText('None');
        const groupSelect = popup.locator('.add-feature-to-group-select');
        await expect(groupSelect).toBeVisible();
        await expect(groupSelect.locator('option')).toHaveText([
            'Add to group…',
            'Create new group…',
            'Alpha Zone'
        ]);

        await groupSelect.selectOption({ label: 'Alpha Zone' });
        await expect(popup.locator('.feature-popup-groups')).toContainText('Alpha Zone');
        await expect(popup.locator('.feature-popup-group-none')).toHaveCount(0);
    });

    test('adds a newly created LTN group immediately from the LTN popup', async ({ page }) => {
        await drawNamedLtnCell(page, 'Immediate group cell');
        await page.locator('#ltn-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click');

        const popup = page.locator('.leaflet-popup');
        const groupSelect = popup.locator('.add-feature-to-group-select');
        await groupSelect.selectOption({ label: 'Create new group…' });
        await page.getByLabel('Group name').fill('Immediate LTN Group');
        await page.getByRole('button', { name: 'Save' }).click();

        await expect(groupSelect.locator('option:checked')).toHaveText('Immediate LTN Group');
        await expect(popup.locator('.feature-popup-groups')).toContainText('Immediate LTN Group');
        await expect(popup.locator('.feature-popup-group-none')).toHaveCount(0);
        await expect(popup.getByRole('button', { name: 'Apply LTN cell changes' })).toHaveCount(0);
        await expect(popup.getByRole('button', { name: 'Cancel LTN cell changes' })).toHaveCount(0);
    });

    test('creates a group from the selected feature popup', async ({ page }) => {
        await placeModalFilter(page);

        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        await marker.dispatchEvent('click');
        const popup = page.locator('.leaflet-popup');
        const groupSelect = popup.locator('.add-feature-to-group-select');

        await expect(groupSelect.locator('option')).toHaveText([
            'Add to group…',
            'Create new group…'
        ]);
        await groupSelect.selectOption({ label: 'Create new group…' });
        await page.getByLabel('Group name').fill('Single Feature Group');
        await page.getByRole('button', { name: 'Save' }).click();

        await expect(groupSelect.locator('option:checked')).toHaveText('Single Feature Group');
        await expect(popup.locator('.feature-popup-groups')).toContainText('Single Feature Group');
        await expect(popup.locator('.feature-popup-group-none')).toHaveCount(0);
    });
});
