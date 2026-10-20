import { expect, test, type Page } from '@playwright/test';
import type { Group } from '../../../src/models/Group';
import { getLayerFeatureCount } from '../indexedDbHelpers';
import {
    setupPage,
    placeTwoModalFilters,
    selectBothFilters,
    createGroup,
    openGroupsPanel,
    openGroupDetails,
    createGroupVersion
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
