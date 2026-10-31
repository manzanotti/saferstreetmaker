import { expect, type Page } from '@playwright/test';

export async function seedIsolationMap(page: Page) {
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
