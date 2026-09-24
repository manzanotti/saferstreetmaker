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

    test('creates the first phase and initializes an additional phase from unassigned features', async ({
        page
    }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Phased Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Phased Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(2 features)', {
                exact: true
            })
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Phases for version Default' })).toHaveText(
            'Phases (0)'
        );
        await page.getByRole('button', { name: 'Phases for version Default' }).click();

        await expect(page.getByText('Edit Phase 1', { exact: true })).toBeVisible();
        await expect(
            page.getByRole('dialog', { name: /Phased Group \/ Default phases/ })
        ).toBeVisible();
        await expect(
            page.getByRole('dialog', { name: /Phased Group \/ Default phases/ })
        ).not.toHaveAttribute('aria-modal');
        const phaseDialog = page.getByRole('dialog', {
            name: /Phased Group \/ Default phases/
        });
        await expect
            .poll(async () => (await phaseDialog.boundingBox())?.width ?? Number.POSITIVE_INFINITY)
            .toBeLessThanOrEqual(448);
        await expect
            .poll(async () => {
                const dialogBox = await phaseDialog.boundingBox();
                const viewport = page.viewportSize();
                return dialogBox && viewport
                    ? Math.round(viewport.height - (dialogBox.y + dialogBox.height))
                    : null;
            })
            .toBe(0);
        await expect
            .poll(async () => {
                const dialogBox = await phaseDialog.boundingBox();
                const featureBoxes = await page
                    .locator('.leaflet-filters-pane path.modal-filter-marker')
                    .evaluateAll((features) =>
                        features.map((feature) => feature.getBoundingClientRect().bottom)
                    );
                return dialogBox
                    ? featureBoxes.every((featureBottom) => featureBottom <= dialogBox.y)
                    : false;
            })
            .toBe(true);
        await expect(page.getByRole('button', { name: 'Save phase' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');

        await expect(page.getByRole('button', { name: 'Edit Phase 1' })).toBeVisible();
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');

        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');
        await expect(page.getByText('2 features', { exact: true })).toBeVisible();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');

        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'New phase' }).click();
        await expect(page.getByText('Edit Phase 2', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit Phase 2' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Move Phase/ })).toHaveCount(0);
        const phaseIdsBeforeMove = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const groupStore = app?.config?.globalProperties?.$pinia?._s?.get('group');
            return groupStore.groups[0].versions[0].phases.map((phase: any) => phase.id);
        });
        await page.getByRole('button', { name: 'Edit Phase 2' }).press('ArrowUp');
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const app = (document.getElementById('app') as any).__vue_app__;
                    const groupStore = app?.config?.globalProperties?.$pinia?._s?.get('group');
                    return groupStore.groups[0].versions[0].phases.map((phase: any) => phase.id);
                })
            )
            .toEqual([...phaseIdsBeforeMove].reverse());
        await page.waitForTimeout(100);

        await page.getByRole('button', { name: 'Close phases' }).click();
        await expect(
            page.getByRole('dialog', { name: /Phased Group \/ Default phases/ })
        ).not.toBeVisible();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
        await expect(page.locator('.leaflet-filters-pane path[stroke="green"]')).toHaveCount(2);
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Phased Group');
        await expect(page.getByRole('button', { name: 'Phases for version Default' })).toHaveText(
            'Phases (2)'
        );
        await page.getByRole('button', { name: 'Close group details' }).click();
        await page.getByRole('button', { name: 'Undo' }).click();
        await page.getByRole('button', { name: 'Undo' }).click();

        await expect(
            page.getByRole('dialog', { name: /Phased Group \/ Default phases/ })
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit Phase 1' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit Phase 2' })).toHaveCount(0);
    });
});
