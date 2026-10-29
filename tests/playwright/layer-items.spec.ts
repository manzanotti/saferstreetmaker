import { expect, test, type Page } from '@playwright/test';
import type { App } from 'vue';
import type { Pinia } from 'pinia';
import type { useImportedLayerStore } from '../../src/stores/importedLayerStore';
import type { useMapStore } from '../../src/stores/mapStore';
import type { useSettingsStore } from '../../src/stores/settingsStore';
import type { useGroupStore } from '../../src/stores/groupStore';
import { addFirstNavigationStorageResetScript, waitForFreshStorage } from './indexedDbHelpers';

type AppElement = HTMLElement & { __vue_app__: App };
type TestPinia = Pinia & { _s: Map<string, unknown> };
type ImportedStore = ReturnType<typeof useImportedLayerStore>;
type MapStore = ReturnType<typeof useMapStore>;
type TestWindow = Window & {
    L: typeof import('leaflet');
    layerItemGeometryBuilds?: { count: number };
};

async function seedItems(page: Page) {
    await page.evaluate(() => {
        const stores = (
            (document.getElementById('app') as AppElement).__vue_app__.config.globalProperties
                .$pinia as TestPinia
        )._s;
        const imported = stores.get('importedLayers') as ImportedStore;
        const mapStore = stores.get('map') as MapStore;
        const polygon = (offset: number): GeoJSON.Polygon => ({
            type: 'Polygon',
            coordinates: [
                [
                    [-1.905 + offset, 52.501],
                    [-1.904 + offset, 52.501],
                    [-1.904 + offset, 52.502],
                    [-1.905 + offset, 52.501]
                ]
            ]
        });
        imported.setLayers([
            {
                id: 'named',
                name: 'Named overlay',
                nameProperty: 'name',
                visible: true,
                featureCollection: {
                    type: 'FeatureCollection',
                    features: [
                        { type: 'Feature', properties: { name: 'Metadata' }, geometry: null },
                        { type: 'Feature', properties: { name: 'Alpha' }, geometry: polygon(0) },
                        { type: 'Feature', properties: { name: 'Beta' }, geometry: polygon(0.002) },
                        {
                            type: 'Feature',
                            properties: { name: 'Alpha' },
                            geometry: {
                                type: 'MultiPolygon',
                                coordinates: [polygon(0.004).coordinates]
                            }
                        },
                        {
                            type: 'Feature',
                            properties: { name: '  ' },
                            geometry: {
                                type: 'Point',
                                coordinates: [-1.9, 52.5]
                            }
                        },
                        {
                            type: 'Feature',
                            properties: { name: 'Mixed' },
                            geometry: {
                                type: 'GeometryCollection',
                                geometries: [
                                    { type: 'Point', coordinates: [-1.901, 52.5] },
                                    {
                                        type: 'LineString',
                                        coordinates: [
                                            [-1.901, 52.5],
                                            [-1.9, 52.501]
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            {
                id: 'other',
                name: 'Other overlay',
                nameProperty: 'name',
                visible: true,
                featureCollection: {
                    type: 'FeatureCollection',
                    features: [
                        { type: 'Feature', properties: { name: 'Other' }, geometry: polygon(0.006) }
                    ]
                }
            }
        ]);
        mapStore.map!.setView([52.501, -1.9], 18, { animate: false });
        mapStore.layers.find((layer) => layer.id === 'ModalFilters')!.loadFeature!({
            type: 'Feature',
            properties: { historyId: 'planning', name: 'Planning feature' },
            geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
        });
        mapStore.markLayerUpdated();
    });
    await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(7);
}

async function openItems(page: Page) {
    await page.locator('#layers-button').click();
    await page.getByRole('button', { name: 'Open layer Named overlay', exact: true }).click();
    await expect(page.getByLabel('Search by name')).toBeFocused();
}

async function trackGeometryBuilds(page: Page) {
    await page.evaluate(() => {
        const testWindow = window as TestWindow;
        const original = testWindow.L.geoJSON;
        const counter = { count: 0 };
        testWindow.layerItemGeometryBuilds = counter;
        testWindow.L.geoJSON = <P, G extends GeoJSON.Geometry = GeoJSON.Geometry>(
            ...args: Parameters<typeof original<P, G>>
        ) => {
            counter.count++;
            return original<P, G>(...args);
        };
    });
}

async function seedPlanningGroup(page: Page) {
    await page.evaluate(() => {
        const stores = (
            (document.getElementById('app') as AppElement).__vue_app__.config.globalProperties
                .$pinia as TestPinia
        )._s;
        const mapStore = stores.get('map') as MapStore;
        const featureId = mapStore.layers.find((layer) => layer.id === 'ModalFilters')!
            .loadFeature!({
            type: 'Feature',
            properties: { name: 'Grouped feature' },
            geometry: { type: 'Point', coordinates: [-1.902, 52.5] }
        });
        if (!featureId) {
            throw new Error('Failed to seed the planning group member.');
        }
        (stores.get('group') as ReturnType<typeof useGroupStore>).setGroups([
            {
                id: 'planning-group',
                name: 'Planning group',
                members: [{ layerId: 'ModalFilters', historyId: featureId }]
            }
        ]);
        (stores.get('importedLayers') as ImportedStore).toggleVisibility('other');
        mapStore.markLayerUpdated();
    });
    await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
}

async function soloPlanningGroup(page: Page) {
    await page.locator('#groups-button').click();
    await page.getByRole('button', { name: 'Hide group Planning group', exact: true }).click();
    await page.getByRole('button', { name: 'Show only group Planning group', exact: true }).click();
    await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(0);
}

test.describe('Named items in imported layers', () => {
    test.beforeEach(async ({ page, context }) => {
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: 52.5, longitude: -1.9 });
        await addFirstNavigationStorageResetScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
        await page.addStyleTag({ content: '#help { display: none !important; }' });
        await page.waitForFunction(() =>
            Array.from(document.getElementById('map')?.classList ?? []).some((name) =>
                name.startsWith('zoom-')
            )
        );
        await seedItems(page);
    });

    test('opens accessible details, searches named features, renames, and restores keyboard focus', async ({
        page
    }) => {
        await openItems(page);
        await expect(page.getByRole('dialog')).toHaveCount(1);
        await expect(page.locator('#layer-items-list li')).toHaveCount(5);
        await page.locator('#layer-items-list button').last().focus();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Back to layers' })).toBeFocused();
        const search = page.getByLabel('Search by name');
        await search.fill(' ALp ');
        await expect(page.locator('#layer-items-list li')).toHaveCount(2);
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(7);
        await search.fill('nothing');
        await expect(page.getByText('No items match your search.')).toBeVisible();
        await search.fill('l');
        await expect(page.locator('#layer-items-panel')).toBeVisible();
        await page.getByLabel('Rename Named overlay').fill('Renamed overlay');
        await search.click();
        await expect(page.getByRole('dialog', { name: 'Renamed overlay' })).toBeVisible();
        await search.press('Escape');
        await expect(page.getByLabel('Open layer Renamed overlay')).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(search).toBeFocused();
        await search.press('Shift+Tab');
        await expect(page.getByLabel('Rename Renamed overlay')).toBeFocused();
        await page.getByRole('button', { name: 'Close layers' }).click();
        await expect(page.locator('#layers-button')).toBeFocused();
    });

    test('cycles actual map features and isolates only the chosen layer without rebuilding geometry', async ({
        page
    }) => {
        await openItems(page);
        await trackGeometryBuilds(page);
        const alpha = page.locator(
            '#layer-items-list li[data-feature-index="1"] button[data-visibility]'
        );
        const duplicate = page.locator(
            '#layer-items-list li[data-feature-index="3"] button[data-visibility]'
        );
        await alpha.click();
        await expect(alpha).toHaveAttribute('data-visibility', 'hidden');
        await expect(duplicate).toHaveAttribute('data-visibility', 'visible');
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
        await alpha.click();
        await expect(alpha).toHaveAttribute('data-visibility', 'solo');
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(2);
        await expect(page.locator('.leaflet-filters-pane .modal-filter-marker')).toHaveCount(1);
        await duplicate.click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(7);
        await expect(alpha).toHaveAttribute('data-visibility', 'visible');
        const mixed = page.locator(
            '#layer-items-list li[data-feature-index="5"] button[data-visibility]'
        );
        await mixed.click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(5);
        await mixed.click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(3);
        await page.getByRole('button', { name: 'Show all items', exact: true }).last().click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(7);
        await page.getByLabel('Search by name').fill('Beta');
        await page.getByRole('button', { name: 'Hide all items', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
        await page.getByRole('button', { name: 'Show all items', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(7);
        expect(
            await page.evaluate(() => (window as TestWindow).layerItemGeometryBuilds?.count)
        ).toBe(0);
    });

    test('preserves item state across closing and parent hiding, and keeps visibility in Presentation mode', async ({
        page
    }) => {
        await openItems(page);
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        await page.getByRole('button', { name: 'Back to layers' }).click();
        await page.getByRole('button', { name: 'Hide layer Named overlay', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
        await page.getByRole('button', { name: 'Open layer Named overlay', exact: true }).click();
        await expect(page.getByText('This layer is hidden.', { exact: false })).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Show only item Beta', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Show layer Named overlay', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
        await page.getByRole('button', { name: 'Close layers' }).click();
        await page.evaluate(() => {
            const stores = (
                (document.getElementById('app') as AppElement).__vue_app__.config.globalProperties
                    .$pinia as TestPinia
            )._s;
            (stores.get('settings') as ReturnType<typeof useSettingsStore>).readOnly = true;
        });
        await openItems(page);
        await expect(page.locator('#layer-details-name')).not.toBeAttached();
        await expect(
            page.getByRole('button', { name: 'Show only item Beta', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Show only item Beta', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(2);
    });

    test('resets item choices when map data is restored and after a persisted map is reloaded', async ({
        page
    }) => {
        await openItems(page);
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        await page.evaluate(() => {
            const stores = (
                (document.getElementById('app') as AppElement).__vue_app__.config.globalProperties
                    .$pinia as TestPinia
            )._s;
            const store = stores.get('importedLayers') as ImportedStore;
            const source = JSON.parse(JSON.stringify(store.layers)) as typeof store.layers;
            store.setLayers(source);
        });
        await expect(
            page.getByRole('button', { name: 'Hide item Beta', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        await expect(page.locator('#undo-button')).toBeEnabled();
        await page.reload();
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
        await openItems(page);
        await expect(
            page.getByRole('button', { name: 'Hide item Beta', exact: true })
        ).toBeVisible();
    });

    test('keeps details usable at narrow viewport sizes', async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 640 });
        await openItems(page);
        const dialog = page.getByRole('dialog', { name: 'Named overlay' });
        const bounds = await dialog.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
        await page.getByLabel('Search by name').fill('Mixed');
        await page.getByRole('button', { name: 'Hide item Mixed', exact: true }).click();
        await expect(
            page.getByRole('button', { name: 'Show only item Mixed', exact: true })
        ).toBeVisible();
    });

    test('centres named features by click and keyboard while preserving zoom, visibility and the panel', async ({
        page
    }) => {
        await openItems(page);
        const view = () =>
            page.evaluate(() => {
                const stores = (
                    (document.getElementById('app') as AppElement).__vue_app__.config
                        .globalProperties.$pinia as TestPinia
                )._s;
                const map = (stores.get('map') as MapStore).map!;
                const centre = map.getCenter();
                return { lat: centre.lat, lng: centre.lng, zoom: map.getZoom() };
            });
        const expectCentre = async (lat: number, lng: number) => {
            await expect.poll(async () => (await view()).lat).toBeCloseTo(lat, 4);
            await expect.poll(async () => (await view()).lng).toBeCloseTo(lng, 4);
            expect((await view()).zoom).toBe(18);
        };
        await expect(
            page.getByRole('button', { name: 'Centre map on Metadata', exact: true })
        ).toBeDisabled();
        const before = await view();
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        expect(await view()).toEqual(before);
        await page.getByRole('button', { name: 'Centre map on Beta', exact: true }).click();
        await expectCentre(52.5015, -1.9025);
        await expect(
            page.getByRole('button', { name: 'Show only item Beta', exact: true })
        ).toBeVisible();

        await page.getByLabel('Search by name').fill('Alpha');
        const names = page.getByRole('button', { name: 'Centre map on Alpha', exact: true });
        await names.nth(1).focus();
        await page.keyboard.press('Enter');
        await expectCentre(52.5015, -1.9005);
        await names.first().focus();
        await page.keyboard.press('Space');
        await expectCentre(52.5015, -1.9045);
        await expect(page.locator('#layer-items-panel')).toBeVisible();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
    });

    test('restores hidden item and parent-layer choices after group solo without rebuilding geometry', async ({
        page
    }) => {
        await seedPlanningGroup(page);
        await trackGeometryBuilds(page);
        await openItems(page);
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(5);
        await page.getByRole('button', { name: 'Close layers' }).click();
        await soloPlanningGroup(page);
        await page.getByRole('button', { name: 'Show all groups', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(5);

        await page.locator('#layers-button').click();
        await expect(
            page.getByRole('button', { name: 'Show layer Other overlay', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Open layer Named overlay', exact: true }).click();
        await expect(
            page.getByRole('button', { name: 'Show only item Beta', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Hide all items', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(0);
        await page.getByRole('button', { name: 'Show all items', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
        expect(
            await page.evaluate(() => (window as TestWindow).layerItemGeometryBuilds?.count)
        ).toBe(0);
    });

    test('allows item solo changes during group solo without revealing suppressed or hidden layers', async ({
        page
    }) => {
        await seedPlanningGroup(page);
        await trackGeometryBuilds(page);
        await openItems(page);
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        await page.getByRole('button', { name: 'Close layers' }).click();
        await soloPlanningGroup(page);
        await openItems(page);
        await page.getByRole('button', { name: 'Show only item Beta', exact: true }).click();
        await expect(page.locator('#layer-items-list [data-visibility="solo"]')).toHaveCount(1);
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(0);
        await page.getByRole('button', { name: 'Close layers' }).click();
        await page.locator('#groups-button').click();
        await page.getByRole('button', { name: 'Show all groups', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
        await openItems(page);
        await expect(page.locator('#layer-items-list [data-visibility="solo"]')).toHaveCount(1);
        await page.getByRole('button', { name: 'Show all items', exact: true }).first().click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
        expect(
            await page.evaluate(() => (window as TestWindow).layerItemGeometryBuilds?.count)
        ).toBe(0);
    });

    test('searches and controls a 1000-item layer within UI deadlines without rebuilding geometry', async ({
        page
    }) => {
        await trackGeometryBuilds(page);
        await page.evaluate(() => {
            const stores = (
                (document.getElementById('app') as AppElement).__vue_app__.config.globalProperties
                    .$pinia as TestPinia
            )._s;
            (stores.get('importedLayers') as ImportedStore).setLayers([
                {
                    id: 'large',
                    name: 'Large overlay',
                    nameProperty: 'name',
                    featureCollection: {
                        type: 'FeatureCollection',
                        features: Array.from({ length: 1000 }, (_, index) => ({
                            type: 'Feature',
                            properties: { name: `Street ${String(index).padStart(4, '0')}` },
                            geometry: {
                                type: 'Point',
                                coordinates: [
                                    -1.905 + (index % 50) * 0.0001,
                                    52.5 + Math.floor(index / 50) * 0.0001
                                ]
                            }
                        }))
                    }
                }
            ]);
        });
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1000);
        await page.locator('#layers-button').click();
        await page.getByRole('button', { name: 'Open layer Large overlay', exact: true }).click();
        await expect(page.locator('#layer-items-list li')).toHaveCount(1000);
        const search = page.getByLabel('Search by name');
        await search.fill('Street 099');
        await expect(page.locator('#layer-items-list li')).toHaveCount(10);
        await page.getByRole('button', { name: 'Hide item Street 0990', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(999);
        await page.getByRole('button', { name: 'Show only item Street 0990', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
        await page.getByRole('button', { name: 'Show all items', exact: true }).first().click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1000);
        await search.clear();
        await expect(page.locator('#layer-items-list li')).toHaveCount(1000);
        expect(
            await page.evaluate(() => (window as TestWindow).layerItemGeometryBuilds?.count)
        ).toBe(1);
    });
});
