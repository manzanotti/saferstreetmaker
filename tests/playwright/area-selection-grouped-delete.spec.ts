import { test, expect } from '@playwright/test';
import { getLayerFeatureCount } from './indexedDbHelpers';
import { setupPage, drawMobilityLane } from './areaSelectionTestHelpers';

// ---------------------------------------------------------------------------
// Popup copy (polyline / polygon)
// ---------------------------------------------------------------------------
test.describe('Area selection — popup copy (polyline/polygon)', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    for (const scope of ['selected version', 'everywhere'] as const) {
        test(`grouped polyline deletion lists memberships and deletes ${scope}`, async ({
            page
        }) => {
            await drawMobilityLane(page);
            await page.locator('#mobility-lane-button').click();
            await page.evaluate((deletionScope) => {
                const app = (document.getElementById('app') as any).__vue_app__;
                const pinia = app?.config?.globalProperties?.$pinia;
                const mapStore = pinia?._s?.get('map');
                const groupStore = pinia?._s?.get('group');
                const mobilityLayer = mapStore.layers.find(
                    (layer: any) => layer.id === 'MobilityLanes'
                );
                let historyId = '';
                mobilityLayer.getLayer().eachLayer((marker: any) => {
                    historyId = marker.feature?.properties?.historyId ?? '';
                });
                const member = { layerId: 'MobilityLanes', historyId };
                groupStore.setGroups([
                    {
                        id: 'town-centre',
                        name: 'Town centre',
                        defaultVersionId: 'current',
                        versions: [
                            { id: 'current', name: 'Current', members: [member] },
                            { id: 'alternative', name: 'Alternative', members: [{ ...member }] }
                        ]
                    },
                    { id: 'school-route', name: 'School route', members: [{ ...member }] }
                ]);
                if (deletionScope === 'everywhere') {
                    groupStore.addGroup({
                        id: 'retained',
                        name: 'Retained features',
                        versions: [{ id: 'retained-version', name: 'Current', members: [] }],
                        unassignedMembers: [member]
                    });
                }
            }, scope);

            await page
                .locator('.leaflet-overlay-pane path.leaflet-interactive')
                .first()
                .dispatchEvent('click');
            await page.locator('.popup-buttons .delete-button').dispatchEvent('click');

            const dialog = page.getByRole('dialog', { name: 'Delete grouped line' });
            await expect(dialog).toBeVisible();
            await expect(dialog.getByText('Town centre', { exact: true })).toHaveCount(2);
            await expect(dialog.getByText('Current', { exact: true })).toBeVisible();
            await expect(dialog.getByText('Alternative', { exact: true })).toBeVisible();
            await expect(dialog.getByText('School route')).toBeVisible();
            await expect(dialog.getByText('Default', { exact: true })).toBeVisible();
            await expect(
                dialog.getByRole('button', { name: 'Remove from selected version' })
            ).toBeVisible();
            await expect(
                dialog.getByRole('button', { name: 'Remove from all Town centre versions' })
            ).toBeVisible();
            await expect(dialog.getByRole('button', { name: 'Delete everywhere' })).toBeVisible();

            await dialog
                .getByRole('button', {
                    name:
                        scope === 'everywhere'
                            ? 'Delete everywhere'
                            : 'Remove from selected version'
                })
                .click();
            if (scope === 'everywhere') {
                const remainingMembers = await page.evaluate(() => {
                    const app = (document.getElementById('app') as any).__vue_app__;
                    const groups = app.config.globalProperties.$pinia._s.get('group').groups;
                    return groups.flatMap((group: any) => [
                        ...(group.unassignedMembers ?? []),
                        ...(group.versions ?? []).flatMap((version: any) => version.members)
                    ]);
                });
                expect(remainingMembers).toEqual([]);
                await expect
                    .poll(() => getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes'))
                    .toBe(0);
                await expect(dialog).not.toBeVisible();
                return;
            }
            await page.waitForTimeout(300);

            expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);
            const memberships = await page.evaluate(() => {
                const app = (document.getElementById('app') as any).__vue_app__;
                const pinia = app?.config?.globalProperties?.$pinia;
                const groups = pinia?._s?.get('group')?.groups ?? [];
                return groups.map((group: any) => ({
                    name: group.name,
                    versions: (group.versions ?? [{ name: 'Default', members: group.members }]).map(
                        (version: any) => ({
                            name: version.name,
                            memberCount: version.members.length
                        })
                    )
                }));
            });
            expect(memberships).toEqual([
                {
                    name: 'Town centre',
                    versions: [
                        { name: 'Current', memberCount: 0 },
                        { name: 'Alternative', memberCount: 1 }
                    ]
                },
                { name: 'School route', versions: [{ name: 'Default', memberCount: 1 }] }
            ]);
            await expect(dialog).not.toBeVisible();
            await expect(page.locator('#undo-button')).toBeEnabled();
        });
    }
});
