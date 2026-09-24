import { test, expect } from '@playwright/test';
import {
    setupPage,
    dragSelectCenter,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    openGroupDetails,
    createGroup,
    createGroupVersion,
    drawNamedLtnCell
} from './groupTestHelpers';

test.describe('Groups — Version-specific LTN cells', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
        await placeTwoModalFilters(page, 90);
        await selectBothFilters(page);
        await createGroup(page, 'Versioned LTN');
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned LTN');
        await createGroupVersion(page, 'Versioned LTN', 'Alternative');
        const detailsDialog = page.getByRole('dialog', { name: 'Group details' });
        if (await detailsDialog.isVisible()) {
            await detailsDialog.getByRole('button', { name: 'Close group details' }).click();
        }
    });

    test('hides the cell title and excludes the cell from selection in other versions', async ({
        page
    }) => {
        const closeGroupsButton = page.getByRole('button', { name: 'Close groups panel' });
        if (await closeGroupsButton.isVisible()) {
            await closeGroupsButton.click();
        }
        await drawNamedLtnCell(page, 'New cell');
        await expect(page.getByText('New cell', { exact: true })).toBeVisible();

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned LTN');
        await page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .dispatchEvent('click');
        await page.getByRole('button', { name: 'Close group details' }).click();

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned LTN');
        await page.getByRole('button', { name: 'Select version Default' }).click();
        await page.waitForTimeout(300);

        const cellPath = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await expect(cellPath).toHaveAttribute('stroke-opacity', '0');
        await expect(cellPath).toHaveAttribute('fill-opacity', '0');
        await expect(cellPath).toHaveCSS('pointer-events', 'none');
        await expect(page.getByText('New cell', { exact: true })).not.toBeVisible();

        const finalCloseGroupsButton = page.getByRole('button', { name: 'Close groups panel' });
        if (await finalCloseGroupsButton.isVisible()) {
            await finalCloseGroupsButton.click();
        }
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 55);

        const selectedLtnCount = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const selectionStore = pinia?._s?.get('selection');
            return (selectionStore?.selected ?? []).filter(
                (entry: any) => entry.layerId === 'LtnCells'
            ).length;
        });
        expect(selectedLtnCount).toBe(0);
    });
});
