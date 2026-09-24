import { test, expect } from '@playwright/test';
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

    test('does not add a feature outside the group version to a phase', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Bounded Phase Group');
        await placeModalFilter(page, 180);

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Bounded Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        const phaseRow = page.getByRole('listitem').filter({ hasText: 'Phase 1' });
        await expect(phaseRow).toContainText('2 features');

        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .last()
            .dispatchEvent('click');

        await expect(phaseRow).toContainText('2 features');
        await page.getByRole('button', { name: 'Close phases' }).click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Bounded Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        await expect(page.getByRole('listitem').filter({ hasText: 'Phase 1' })).toContainText(
            '2 features'
        );
    });

    test('opening group details closes active phase editing', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Exclusive Editors');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Exclusive Editors');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        await expect(
            page.getByRole('dialog', { name: /Exclusive Editors \/ Default phases/ })
        ).toBeVisible();

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Exclusive Editors/ }).click();

        await expect(
            page.getByRole('dialog', { name: /Exclusive Editors \/ Default phases/ })
        ).toHaveCount(0);
        await expect(page.getByRole('dialog', { name: 'Group details' })).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const app = (document.getElementById('app') as any).__vue_app__;
                    const groupStore = app?.config?.globalProperties?.$pinia?._s?.get('group');
                    const selectionStore =
                        app?.config?.globalProperties?.$pinia?._s?.get('selection');
                    return {
                        phaseDraftActive: groupStore.phaseDraftActive,
                        isPhaseEditing: selectionStore.isPhaseEditing
                    };
                })
            )
            .toEqual({ phaseDraftActive: false, isPhaseEditing: false });
    });
});
