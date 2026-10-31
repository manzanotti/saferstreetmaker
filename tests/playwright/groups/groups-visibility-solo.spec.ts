import { test, expect } from '@playwright/test';
import { setupPage, openGroupsPanel } from './groupTestHelpers';
import { seedIsolationMap } from './groupVisibilityTestHelpers';

test.describe('Groups — Visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
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
            await expect(page.locator('#groups-master-toggle')).toHaveJSProperty(
                'indeterminate',
                true
            );
            await expect(page.locator('#groups-master-toggle')).toHaveAccessibleName(
                'Hide all groups'
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
        await expect(page.locator('#groups-master-toggle')).toBeChecked();
        await expect(page.locator('#groups-master-toggle')).toHaveAccessibleName('Hide all groups');
        await page.locator('#groups-master-toggle').uncheck();
        await expect(page.locator('[data-visibility="visible"]')).toHaveCount(2);
        await expect(page.locator('#groups-master-toggle')).not.toBeChecked();
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
});
