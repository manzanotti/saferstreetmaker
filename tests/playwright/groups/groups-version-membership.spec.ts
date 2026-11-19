import { expect, test, type Page } from '@playwright/test';
import type { Group } from '../../../src/models/Group';
import { getLayerFeatureCount } from '../indexedDbHelpers';
import {
    setupPage,
    placeModalFilter,
    placeTwoModalFilters,
    selectBothFilters,
    createGroup,
    openGroupsPanel,
    openGroupDetails,
    createGroupVersion,
    drawNamedMobilityLane,
    drawNamedLtnCell
} from './groupTestHelpers';

async function readGroup(page: Page): Promise<Group> {
    return page.evaluate(() => {
        const root = document.getElementById('app') as
            | (HTMLElement & {
                  __vue_app__: {
                      config: {
                          globalProperties: {
                              $pinia: { _s: Map<string, { groups: Group[] }> };
                          };
                      };
                  };
              })
            | null;
        const group = root?.__vue_app__.config.globalProperties.$pinia._s.get('group')?.groups[0];
        if (!group) {
            throw new Error('Expected versioned group');
        }
        return JSON.parse(JSON.stringify(group)) as Group;
    });
}

test.describe('Group version membership', () => {
    // Draw above the bottom-docked Group details dialog.
    const drawingOffsetY = -150;
    for (const { name, layerId, selector, draw } of [
        {
            name: 'mobility lane',
            layerId: 'MobilityLanes',
            selector: '.leaflet-overlay-pane path.mobility-lane.leaflet-interactive',
            draw: (page: Page) => drawNamedMobilityLane(page, 'Alternative lane', drawingOffsetY)
        },
        {
            name: 'LTN cell',
            layerId: 'LtnCells',
            selector: '.leaflet-ltns-pane path.ltn-cell.leaflet-interactive',
            // Keep the default label so the first undo targets drawing, not renaming.
            draw: (page: Page) => drawNamedLtnCell(page, '1', 0, drawingOffsetY)
        }
    ]) {
        test(`assigns a drawn ${name} to the selected version and restores it with undo/redo`, async ({
            page,
            context
        }) => {
            await setupPage(page, context);
            await placeTwoModalFilters(page);
            await selectBothFilters(page);
            await createGroup(page, 'Draw alternatives');
            await openGroupDetails(page, 'Draw alternatives');
            await createGroupVersion(page, 'Draw alternatives', 'Alternative');
            const before = (await readGroup(page)).versions;
            const dialog = page.getByRole('dialog', { name: 'Group details' });
            await expect(
                dialog.getByRole('button', { name: 'Select version Alternative' })
            ).toHaveAttribute('aria-pressed', 'true');

            await draw(page);
            const feature = page.locator(selector);
            await expect(feature).toBeVisible();
            await expect(dialog.getByText('(1 feature)', { exact: true })).toBeVisible();
            const after = (await readGroup(page)).versions;
            expect(after?.map((version) => version.members)).toEqual([
                before?.[0].members,
                [{ layerId, historyId: expect.any(String) }]
            ]);

            await dialog.getByRole('button', { name: 'Close group details' }).click();
            await page.locator('#undo-button').click();
            await expect(feature).toHaveCount(0);
            await expect.poll(async () => (await readGroup(page)).versions).toEqual(before);
            await page.locator('#redo-button').click();
            await expect(feature).toHaveCount(1);
            await expect.poll(async () => (await readGroup(page)).versions).toEqual(after);

            await openGroupDetails(page, 'Draw alternatives');
            await dialog.getByRole('button', { name: 'Select version Default' }).click();
            await expect(feature).toHaveCSS('pointer-events', 'none');
            await dialog.getByRole('button', { name: 'Select version Alternative' }).click();
            await expect(feature).not.toHaveCSS('pointer-events', 'none');
        });
    }

    test('assigns newly placed features to the selected version, not the default', async ({
        page,
        context
    }) => {
        await setupPage(page, context);
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Draw alternatives');
        await openGroupDetails(page, 'Draw alternatives');
        await createGroupVersion(page, 'Draw alternatives', 'Alternative');

        await placeModalFilter(page, 35, -150);
        await page.locator('#modal-filter-button').click();
        const dialog = page.getByRole('dialog', { name: 'Group details' });
        const defaultVersion = dialog.getByRole('button', { name: 'Select version Default' });
        const alternative = dialog.getByRole('button', { name: 'Select version Alternative' });
        await expect(alternative).toHaveAttribute('aria-pressed', 'true');
        await expect(dialog.getByText('(1 feature)', { exact: true })).toBeVisible();
        await expect(dialog.getByText('(2 features)', { exact: true })).toBeVisible();

        const markers = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        const newMarker = markers.last();
        await expect(markers.first()).toHaveCSS('pointer-events', 'none');
        await expect(newMarker).not.toHaveCSS('pointer-events', 'none');
        await defaultVersion.click();
        await expect(markers.first()).not.toHaveCSS('pointer-events', 'none');
        await expect(newMarker).toHaveCSS('pointer-events', 'none');
        await alternative.click();
        await expect(newMarker).not.toHaveCSS('pointer-events', 'none');

        await dialog.getByRole('button', { name: 'Close group details' }).click();
        await newMarker.dispatchEvent('mouseover');
        await expect(page.locator('.feature-popup-group-description')).toContainText(
            'Draw alternatives'
        );
        await newMarker.dispatchEvent('mouseout');
        await openGroupsPanel(page);
        await expect(
            page.getByRole('button', { name: 'Select group Draw alternatives' })
        ).toHaveText('Draw alternatives (3)');

        await page.locator('#undo-button').click();
        await expect(markers).toHaveCount(2);
        await expect.poll(async () => (await readGroup(page)).versions?.[1].members).toEqual([]);
        await page.locator('#redo-button').click();
        await expect(markers).toHaveCount(3);
        await expect
            .poll(async () => (await readGroup(page)).versions?.[1].members)
            .toHaveLength(1);
    });

    test('seeds only unassigned features and preserves membership, totals, and history after deleting a third version', async ({
        page,
        context
    }) => {
        await setupPage(page, context);
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Design options');
        await placeTwoModalFilters(page, 170);
        await placeTwoModalFilters(page, 260);
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Design options');

        await createGroupVersion(page, 'Design options', 'Second');
        let group = await readGroup(page);
        expect(group.versions?.map((version) => version.members.length)).toEqual([2, 0]);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(6);
        for (const index of [2, 3]) {
            await page
                .locator('.leaflet-filters-pane path.modal-filter-marker')
                .nth(index)
                .dispatchEvent('click');
        }
        await createGroupVersion(page, 'Design options', 'Third');
        group = await readGroup(page);
        expect(group.versions?.map((version) => version.members.length)).toEqual([2, 2, 0]);
        for (const index of [4, 5]) {
            await page
                .locator('.leaflet-filters-pane path.modal-filter-marker')
                .nth(index)
                .dispatchEvent('click');
        }
        const beforeDeletion = await readGroup(page);
        const thirdMembers = beforeDeletion.versions?.[2].members;
        expect(thirdMembers).toHaveLength(2);
        await page.getByRole('button', { name: 'Delete version Third' }).click();
        await page.getByRole('button', { name: 'Delete version only', exact: true }).click();
        await expect
            .poll(async () => (await readGroup(page)).unassignedMembers)
            .toEqual(thirdMembers);
        expect((await readGroup(page)).versions).toEqual(beforeDeletion.versions?.slice(0, 2));
        await expect
            .poll(() => getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters'))
            .toBe(6);
        await openGroupDetails(page, 'Design options');
        await page.getByRole('button', { name: 'Close group details' }).click();
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .last()
            .dispatchEvent('click');
        await expect(page.locator('.feature-popup-groups .group-link')).toHaveText(
            'Design options (2 versions)'
        );
        await page.locator('.leaflet-popup-close-button').dispatchEvent('click');
        await expect(page.locator('.leaflet-popup')).toHaveCount(0);

        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: 'Select group Design options' })).toHaveText(
            'Design options (6)'
        );
        await page.getByRole('button', { name: 'Close groups panel' }).click();

        const reloadedPage = await context.newPage();
        await reloadedPage.goto('/');
        await reloadedPage.addStyleTag({ content: '#help { display: none !important; }' });
        await expect
            .poll(async () => (await readGroup(reloadedPage)).unassignedMembers)
            .toEqual(thirdMembers);
        await openGroupsPanel(reloadedPage);
        await expect(
            reloadedPage.getByRole('button', { name: 'Select group Design options' })
        ).toHaveText('Design options (6)');
        await reloadedPage.close();

        await expect(page.locator('#undo-button')).toBeEnabled();
        await page.locator('#undo-button').click();
        await expect.poll(async () => (await readGroup(page)).versions?.length).toBe(3);
        await page.locator('#redo-button').click();
        await expect
            .poll(async () => (await readGroup(page)).unassignedMembers)
            .toEqual(thirdMembers);

        await openGroupDetails(page, 'Design options');
        await createGroupVersion(page, 'Design options', 'Fourth');
        group = await readGroup(page);
        expect(group.versions?.map((version) => version.members.length)).toEqual([2, 2, 2]);
        expect(group.versions?.[2].members).toEqual(thirdMembers);
        expect(group.unassignedMembers).toEqual([]);
        await createGroupVersion(page, 'Design options', 'Empty');
        expect((await readGroup(page)).versions?.map((version) => version.members.length)).toEqual([
            2, 2, 2, 0
        ]);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(6);
    });
});
