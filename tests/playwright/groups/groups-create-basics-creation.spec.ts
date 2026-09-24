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

    test('creating a group adds it to the Groups panel', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'School Zone');

        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group School Zone/ })).toBeVisible();
    });

    test('created group shows member count', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'My Group');

        await openGroupsPanel(page);
        await expect(page.locator('text=My Group')).toBeVisible();
        await expect(page.locator('text=(2)')).toBeVisible();
    });
    test('group details dialog docks at the bottom and keeps all members visible', async ({
        page
    }) => {
        await placeTwoModalFilters(page, 120);
        await selectBothFilters(page);
        await createGroup(page, 'Viewport Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Viewport Group');

        const dialog = page.getByRole('dialog', { name: 'Group details' });
        await expect
            .poll(async () => {
                const dialogBox = await dialog.boundingBox();
                const viewport = page.viewportSize();
                return dialogBox && viewport
                    ? Math.round(viewport.height - (dialogBox.y + dialogBox.height))
                    : null;
            })
            .toBe(0);
        await expect
            .poll(async () => {
                const dialogBox = await dialog.boundingBox();
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
    });

    test('creates, sanitizes, renders, and edits a group description', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroupWithDescription(
            page,
            'School Zone',
            '<p><strong>Slow down</strong> <a href="javascript:alert(1)">here</a><script>alert(1)</script></p>'
        );

        await openGroupsPanel(page);
        await openGroupDetails(page, 'School Zone');
        const description = page
            .getByRole('dialog', { name: 'Group details' })
            .locator('.group-description-content');
        await expect(description).toContainText('Slow down');
        await expect(description.locator('strong')).toHaveText('Slow down');
        await expect(description.locator('script')).toHaveCount(0);
        await expect(description.locator('a')).not.toHaveAttribute('href');

        const dialog = page.getByRole('dialog', { name: 'Group details' });
        const editor = dialog.getByLabel('Description');
        await expect(editor).toHaveAttribute('maxlength', '500');
        await editor.fill('<p>Updated notes</p>');
        await expect(dialog.locator('.group-description-content')).toContainText('Updated notes');
        await dialog.getByRole('button', { name: 'Close group details' }).click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'School Zone');
        await expect(page.locator('.group-description-content')).toContainText('Updated notes');
    });
});
