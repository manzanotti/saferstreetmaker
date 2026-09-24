import { test, expect } from '@playwright/test';
import { getHistoryEntryCount } from '../indexedDbHelpers';
import {
    setupPage,
    placeModalFilter,
    dragSelectCenter,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    openGroupDetails,
    createGroup,
    drawNamedLtnCell
} from './groupTestHelpers';

test.describe('Groups — Phases', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('edits phase membership and offers to delete a phase made empty', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        const markers = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await createGroup(page, 'Editable Phase Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Editable Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        await expect(page.getByText('Edit Phase 1', { exact: true })).toBeVisible();
        const historyEntryCount = await getHistoryEntryCount(page);
        await markers.first().dispatchEvent('click');
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();
        await expect.poll(() => getHistoryEntryCount(page)).toBeGreaterThan(historyEntryCount);
        await expect(page.getByRole('button', { name: 'Save group changes' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Undo' }).click();
        await expect(page.getByText('2 features', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Redo' }).click();
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Close phases' }).click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Editable Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Edit Phase 1' }).click();
        await markers.last().dispatchEvent('click');

        await expect(page.getByText('Select at least one feature.')).toBeVisible();
        await expect(page.getByText('This phase has no features. Delete the phase?')).toBeVisible();
        await page.getByRole('button', { name: 'Delete phase' }).click();
        await expect(page.getByRole('button', { name: 'Edit Phase 1' })).toHaveCount(0);
        await expect(page.getByText('No phases have been saved for this version.')).toBeVisible();
    });

    test('adds multiple unassigned point features to a mixed phase with plain clicks', async ({
        page
    }) => {
        await drawNamedLtnCell(page, 'First phase cell', -60);
        await drawNamedLtnCell(page, 'Second phase cell', 60);
        await page.locator('#modal-filter-button').click();
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) {
            throw new Error('Map bounding box not found');
        }
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.click(cx - 80, cy);
        await page.waitForTimeout(150);
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(150);
        await page.mouse.click(cx + 80, cy);
        await page.waitForTimeout(150);
        await page.locator('#modal-filter-button').click();

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 190);
        await expect(page.getByText('5 features selected')).toBeVisible();
        await createGroup(page, 'Mixed Phase Group');
        await page.waitForTimeout(200);

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Mixed Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        await expect(page.getByRole('button', { name: 'Edit Phase 1' })).toBeVisible();
        await expect(page.getByRole('listitem').getByText('5 features')).toBeVisible();

        const cells = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        const filters = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await cells.first().dispatchEvent('click');
        await cells.nth(1).dispatchEvent('click');
        await expect(page.getByRole('listitem').getByText('3 features')).toBeVisible();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
        const firstFilterBox = await filters.first().boundingBox();
        if (!firstFilterBox) {
            throw new Error('Modal filter bounding box not found');
        }
        await page.mouse.click(
            firstFilterBox.x + firstFilterBox.width / 2,
            firstFilterBox.y + firstFilterBox.height / 2
        );
        await expect(page.getByRole('listitem').getByText('2 features')).toBeVisible();
        await filters.nth(1).dispatchEvent('click');
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();

        await filters.first().dispatchEvent('click');
        await expect(page.getByRole('listitem').getByText('2 features')).toBeVisible();
        await filters.nth(1).dispatchEvent('click');
        await expect(page.getByRole('listitem').getByText('3 features')).toBeVisible();
    });

    test('keeps an LTN cell coloured when removing it from a phase draft', async ({ page }) => {
        await drawNamedLtnCell(page, 'Phase cell');
        await placeModalFilter(page, 120);
        const cell = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 180);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroup(page, 'LTN Phase Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'LTN Phase Group');
        await page.locator('#group-details-colour').fill('#0088aa');
        await page
            .getByRole('dialog', { name: 'Group details' })
            .getByRole('button', { name: 'Close group details' })
            .click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'LTN Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();

        await expect
            .poll(() =>
                page.evaluate(() => {
                    const app = (document.getElementById('app') as any).__vue_app__;
                    const selectionStore =
                        app?.config?.globalProperties?.$pinia?._s?.get('selection');
                    return {
                        isPhaseEditing: selectionStore?.isPhaseEditing,
                        isGroupSelection: selectionStore?.isGroupSelection
                    };
                })
            )
            .toEqual({ isPhaseEditing: true, isGroupSelection: true });
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            pinia?._s?.get('selection')?.setPhaseEditing(false);
        });
        const cellBox = await cell.boundingBox();
        if (!cellBox) {
            throw new Error('LTN cell bounding box not found');
        }
        await page.mouse.click(cellBox.x + 25, cellBox.y + 10);
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');

        await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
        await expect(page.getByText(/features? selected/)).toHaveCount(0);
        await expect(cell).toBeVisible();
        await expect(cell).toHaveAttribute('stroke', '#0088aa');
        await expect(cell).toHaveAttribute('fill', '#0088aa');
        await expect(cell).toHaveAttribute('stroke-opacity', '0.28');
        expect(Number(await cell.getAttribute('fill-opacity'))).toBeCloseTo(0.056);
        await expect(cell).toHaveCSS('opacity', '1');
    });
});
