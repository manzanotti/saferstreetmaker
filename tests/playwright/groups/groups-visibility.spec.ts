import { test, expect, type Page } from '@playwright/test';
import {
    setupPage,
    dragSelectCenter,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    createGroup
} from './groupTestHelpers';

async function seedIsolationMap(page: Page) {
    await page.evaluate(() => {
        const stores = (document.getElementById('app') as any).__vue_app__.config.globalProperties
            .$pinia._s;
        const mapStore = stores.get('map');
        const groupStore = stores.get('group');
        const feature = (id: string, type: string, coordinates: unknown) => ({
            type: 'Feature',
            properties: { historyId: id, label: id, name: id },
            geometry: { type, coordinates }
        });
        const point = (id: string, offset: number) => feature(id, 'Point', [-1.9 + offset, 52.5]);
        const data: Record<string, unknown[]> = {
            ModalFilters: [
                point('target', -0.001),
                point('other', 0.001),
                point('ungrouped', 0.002),
                point('alternative', -0.002)
            ],
            BusGates: [point('outside-gate', 0.003)],
            MobilityLanes: [
                feature('lane', 'LineString', [
                    [-1.901, 52.501],
                    [-1.899, 52.501]
                ])
            ],
            LtnCells: [
                feature('shared-cell', 'Polygon', [
                    [
                        [-1.901, 52.499],
                        [-1.899, 52.499],
                        [-1.9, 52.4995],
                        [-1.901, 52.499]
                    ]
                ])
            ]
        };
        for (const layer of mapStore.layers) {
            if (data[layer.id]) {
                layer.loadFromGeoJSON({ type: 'FeatureCollection', features: data[layer.id] });
                layer.getLayer().eachLayer((marker: any) => {
                    const id =
                        marker.feature?.properties?.historyId ?? marker.properties?.historyId;
                    marker.getElement?.()?.setAttribute('data-fixture', id);
                });
            }
        }
        const member = (layerId: string, historyId: string) => ({ layerId, historyId });
        const shared = member('LtnCells', 'shared-cell');
        groupStore.setGroups([
            {
                id: 'solo-target',
                name: 'Proposal',
                color: '#00aa00',
                defaultVersionId: 'v1',
                versions: [
                    {
                        id: 'v1',
                        name: 'Current',
                        members: [
                            member('ModalFilters', 'target'),
                            member('MobilityLanes', 'lane'),
                            shared
                        ]
                    },
                    {
                        id: 'v2',
                        name: 'Alternative',
                        members: [member('ModalFilters', 'alternative'), shared]
                    }
                ]
            },
            {
                id: 'other-group',
                name: 'Other',
                color: '#aa0000',
                members: [member('ModalFilters', 'other'), shared]
            }
        ]);
        stores.get('importedLayers').setLayers([
            {
                id: 'visible-import',
                name: 'Visible overlay',
                visible: true,
                featureCollection: { type: 'FeatureCollection', features: [point('import', 0)] }
            },
            {
                id: 'hidden-import',
                name: 'Hidden overlay',
                visible: false,
                featureCollection: {
                    type: 'FeatureCollection',
                    features: [point('hidden-import', 0)]
                }
            }
        ]);
        mapStore.map.closePopup();
        mapStore.markLayerUpdated();
    });
    await expect(page.locator('[data-fixture="target"]')).toHaveAttribute('stroke-opacity', '1');
    await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
}

test.describe('Groups — Visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('toggling a group invisible hides the visibility indicator', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Visible Group');

        await openGroupsPanel(page);
        const toggleBtn = page.getByRole('button', { name: 'Hide group Visible Group' });
        await expect(toggleBtn).toBeVisible();
        await toggleBtn.click();
        await page.waitForTimeout(100);

        await expect(
            page.getByRole('button', { name: 'Show only group Visible Group' })
        ).toBeVisible();
    });

    test('master show-all/hide-all toggle appears when there are groups', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Group A');

        await openGroupsPanel(page);
        await expect(page.locator('#groups-master-toggle')).toBeVisible();
    });

    test('master toggle hides all groups at once', async ({ page }) => {
        // Create two groups in sequence.
        await placeTwoModalFilters(page, 40);
        await selectBothFilters(page);
        await createGroup(page, 'Group One');

        // Creating a group now closes the selection pop-up, so a single click
        // re-activates area selection for the next group.
        await page.waitForTimeout(200);
        await page.locator('#select-area-button').click(); // activate
        await dragSelectCenter(page, 120);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroup(page, 'Group Two');

        await openGroupsPanel(page);
        // Master toggle is unchecked by default.
        await expect(page.locator('#groups-master-toggle')).not.toBeChecked();

        // Check (hide all).
        await page.locator('#groups-master-toggle').check();
        await page.waitForTimeout(100);

        await expect(page.getByRole('button', { name: 'Show only group Group One' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show only group Group Two' })).toBeVisible();
    });

    for (const width of [1280, 390]) {
        test(`isolates all overlay types and exits from any eye at ${width}px`, async ({
            page
        }) => {
            await page.setViewportSize({ width, height: 900 });
            await seedIsolationMap(page);
            await openGroupsPanel(page);
            const proposal = page
                .getByRole('button', { name: 'Select group Proposal' })
                .locator('..');
            const other = page.getByRole('button', { name: 'Select group Other' }).locator('..');
            const revision = await page.evaluate(
                () =>
                    (
                        document.getElementById('app') as any
                    ).__vue_app__.config.globalProperties.$pinia._s.get('map').layerUpdateCount
            );
            await proposal.getByRole('button', { name: 'Hide group Proposal' }).click();
            await expect(page.locator('[data-fixture="target"]')).toHaveAttribute(
                'stroke-opacity',
                '0'
            );
            await expect(page.locator('[data-fixture="shared-cell"]')).toHaveAttribute(
                'stroke-opacity',
                '1'
            );
            await proposal.getByRole('button', { name: 'Show only group Proposal' }).press('Enter');
            await expect(proposal.locator('[data-visibility="solo"]')).toBeVisible();
            await expect(proposal.locator('[data-visibility="solo"] path')).toHaveAttribute(
                'fill',
                'currentColor'
            );
            await expect(other.locator('[data-visibility="hidden"]')).toBeVisible();
            for (const id of ['target', 'lane', 'shared-cell']) {
                await expect(page.locator(`[data-fixture="${id}"]`)).toHaveAttribute(
                    'stroke-opacity',
                    '1'
                );
            }
            for (const id of ['other', 'ungrouped', 'alternative']) {
                await expect(page.locator(`[data-fixture="${id}"]`)).toHaveAttribute(
                    'stroke-opacity',
                    '0'
                );
                await expect(page.locator(`[data-fixture="${id}"]`)).toHaveCSS(
                    'pointer-events',
                    'none'
                );
            }
            await expect(page.locator('[data-fixture="outside-gate"]')).toBeHidden();
            await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(0);
            await expect(page.locator('[data-fixture="shared-cell"]')).toHaveAttribute(
                'fill',
                '#00aa00'
            );
            await expect(page.locator('#groups-master-toggle')).toHaveAttribute(
                'aria-checked',
                'mixed'
            );
            await expect(page.locator('.leaflet-tile-pane img').first()).toBeVisible();
            await other.getByRole('button', { name: 'Show all groups' }).press('Space');
            await expect(proposal.locator('[data-visibility="visible"]')).toBeVisible();
            await expect(page.locator('[data-fixture="ungrouped"]')).toHaveAttribute(
                'stroke-opacity',
                '1'
            );
            await expect(page.locator('[data-fixture="outside-gate"]')).toBeVisible();
            await expect(page.locator('[data-fixture="alternative"]')).toHaveAttribute(
                'stroke-opacity',
                '0'
            );
            await expect(page.locator('[data-fixture="shared-cell"]')).toHaveAttribute(
                'fill',
                /url\(#ssm-ltn-stripes-/
            );
            await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
            expect(
                await page.evaluate(
                    () =>
                        (
                            document.getElementById('app') as any
                        ).__vue_app__.config.globalProperties.$pinia._s.get('map').layerUpdateCount
                )
            ).toBe(revision);
            const flags = await page.evaluate(() =>
                (
                    document.getElementById('app') as any
                ).__vue_app__.config.globalProperties.$pinia._s
                    .get('importedLayers')
                    .layers.map((layer: any) => layer.visible)
            );
            expect(flags).toEqual([true, false]);
        });
    }

    test('keeps solo across panel and version changes, and the master exits without enabling disabled layers', async ({
        page
    }) => {
        await seedIsolationMap(page);
        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Hide group Proposal', exact: true }).click();
        await page.getByRole('button', { name: 'Show only group Proposal' }).click();
        await page.locator('#groups-button').click();
        await page.evaluate(async () => {
            const modulePath = '/composables/useGroups.ts';
            const { switchGroupVersion } = await import(/* @vite-ignore */ modulePath);
            switchGroupVersion('solo-target', 'v2');
        });
        await expect(page.locator('[data-fixture="alternative"]')).toHaveAttribute(
            'stroke-opacity',
            '1'
        );
        await expect(page.locator('[data-fixture="target"]')).toHaveAttribute(
            'stroke-opacity',
            '0'
        );
        await page.evaluate(() => {
            const stores = (document.getElementById('app') as any).__vue_app__.config
                .globalProperties.$pinia._s;
            const mapStore = stores.get('map');
            mapStore.visibleLayerIds = new Set(
                [...mapStore.visibleLayerIds].filter((id) => id !== 'ModalFilters')
            );
        });
        await openGroupsPanel(page);
        await expect(page.locator('[data-visibility="solo"]')).toBeVisible();
        await page.locator('#groups-master-toggle').click();
        await expect(page.locator('[data-visibility="solo"]')).toHaveCount(0);
        await expect(page.locator('.leaflet-filters-pane path')).toHaveCount(0);
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
        await page.locator('#groups-master-toggle').check();
        await expect(page.locator('[data-visibility="hidden"]')).toHaveCount(2);
        await expect(page.locator('#groups-master-toggle')).toHaveAccessibleName('Show all groups');
        await page.locator('#groups-master-toggle').uncheck();
        await expect(page.locator('[data-visibility="visible"]')).toHaveCount(2);
        await expect(page.locator('#groups-master-toggle')).toHaveAccessibleName('Hide all groups');
    });

    test('solo updates for new features and exits when the isolated group is deleted', async ({
        page
    }) => {
        await seedIsolationMap(page);
        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Hide group Proposal', exact: true }).click();
        await page.getByRole('button', { name: 'Show only group Proposal' }).click();
        await page.evaluate(() => {
            const stores = (document.getElementById('app') as any).__vue_app__.config
                .globalProperties.$pinia._s;
            const mapStore = stores.get('map');
            const layer = mapStore.layers.find((item: any) => item.id === 'ModalFilters');
            layer.loadFromGeoJSON({
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: { historyId: 'new-outside' },
                        geometry: { type: 'Point', coordinates: [-1.9, 52.502] }
                    }
                ]
            });
            layer.getLayer().eachLayer((marker: any) => {
                if (marker.feature.properties.historyId === 'new-outside') {
                    marker.getElement().setAttribute('data-fixture', 'new-outside');
                }
            });
            mapStore.markLayerUpdated();
        });
        await expect(page.locator('[data-fixture="new-outside"]')).toHaveAttribute(
            'stroke-opacity',
            '0'
        );
        await page.getByRole('button', { name: 'Delete group Proposal', exact: true }).click();
        await page.getByRole('button', { name: 'Delete group only', exact: true }).click();
        await expect(page.locator('[data-fixture="new-outside"]')).toHaveAttribute(
            'stroke-opacity',
            '1'
        );
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
    });

    test('hiding an edited feature ends layer edit mode without reviving it on exit', async ({
        page
    }) => {
        await seedIsolationMap(page);
        await page.locator('[data-fixture="lane"]').dispatchEvent('click');
        await expect(page.locator('.leaflet-editing-icon').first()).toBeVisible();
        const activeLayer = () =>
            page.evaluate(
                () =>
                    (
                        document.getElementById('app') as any
                    ).__vue_app__.config.globalProperties.$pinia._s.get('map').activeLayerId
            );
        expect(await activeLayer()).toBe('mobility-lane');
        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Hide group Proposal', exact: true }).click();
        expect(await activeLayer()).toBeNull();
        await expect(page.locator('.leaflet-editing-icon')).toHaveCount(0);
        await page.getByRole('button', { name: 'Show only group Proposal' }).click();
        await page.locator('[data-visibility="solo"]').click();
        expect(await activeLayer()).toBeNull();
        await expect(page.locator('[data-fixture="lane"]')).toHaveAttribute('stroke-opacity', '1');
        await expect(page.locator('.leaflet-editing-icon')).toHaveCount(0);
    });

    test('opening Groups clears existing area-selection handles before isolation starts', async ({
        page
    }) => {
        await seedIsolationMap(page);
        await page.evaluate(() =>
            (document.getElementById('app') as any).__vue_app__.config.globalProperties.$pinia._s
                .get('map')
                .map.setView([52.5, -1.9], 16)
        );
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 200);
        const handles = page.locator('path[fill="#ffffff"][stroke="#3b82f6"]');
        await expect(handles).toHaveCount(5);
        const selectedIds = () =>
            page.evaluate(() =>
                (
                    document.getElementById('app') as any
                ).__vue_app__.config.globalProperties.$pinia._s
                    .get('selection')
                    .selected.map((entry: any) => entry.historyId)
            );
        expect(await selectedIds()).toContain('lane');
        expect(await selectedIds()).toContain('shared-cell');
        await page.locator('#map').press('g');
        await expect(handles).toHaveCount(0);
        expect(await selectedIds()).toEqual([]);
        await page.getByRole('button', { name: 'Hide group Proposal', exact: true }).click();
        await expect(handles).toHaveCount(0);
        await page.getByRole('button', { name: 'Show only group Proposal' }).click();
        await expect(handles).toHaveCount(0);
        await page.locator('[data-visibility="solo"]').click();
        await expect(handles).toHaveCount(0);
        expect(await selectedIds()).toEqual([]);
    });
});
