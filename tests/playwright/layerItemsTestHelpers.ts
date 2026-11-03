import { expect, type Page } from '@playwright/test';
import type { App } from 'vue';
import type { Pinia } from 'pinia';
import type { useImportedLayerStore } from '../../src/stores/importedLayerStore';
import type { useMapStore } from '../../src/stores/mapStore';
import type { useGroupStore } from '../../src/stores/groupStore';

export type AppElement = HTMLElement & { __vue_app__: App };
export type TestPinia = Pinia & { _s: Map<string, unknown> };
export type ImportedStore = ReturnType<typeof useImportedLayerStore>;
export type MapStore = ReturnType<typeof useMapStore>;
export type TestWindow = Window & {
    L: typeof import('leaflet');
    layerItemGeometryBuilds?: { count: number };
};

export async function seedItems(page: Page) {
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

export async function openItems(page: Page) {
    await page.locator('#layers-button').click();
    await page.getByRole('button', { name: 'Open layer Named overlay', exact: true }).click();
    await expect(page.getByLabel('Search by name')).toBeFocused();
}

export async function trackGeometryBuilds(page: Page) {
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

export async function seedPlanningGroup(page: Page) {
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

export async function soloPlanningGroup(page: Page) {
    await page.locator('#groups-button').click();
    await page.getByRole('button', { name: 'Hide group Planning group', exact: true }).click();
    await page.getByRole('button', { name: 'Show only group Planning group', exact: true }).click();
    await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(0);
}
