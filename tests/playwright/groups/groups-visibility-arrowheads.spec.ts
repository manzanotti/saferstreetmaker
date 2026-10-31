import { test, expect } from '@playwright/test';
import { setupPage, openGroupsPanel } from './groupTestHelpers';

test.describe('Groups — Visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('one-way street arrowheads follow hide, solo and show, including after zooming', async ({
        page
    }) => {
        await page.evaluate(() => {
            const stores = (document.getElementById('app') as any).__vue_app__.config
                .globalProperties.$pinia._s;
            const mapStore = stores.get('map');
            mapStore.map.setView([52.5, -1.9], 16, { animate: false });
            mapStore.layers
                .find((layer: any) => layer.id === 'OneWayStreets')
                .loadFromGeoJSON({
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: { historyId: 'one-way' },
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [-1.903, 52.5],
                                    [-1.897, 52.5]
                                ]
                            }
                        },
                        {
                            type: 'Feature',
                            properties: { historyId: 'other-one-way' },
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [-1.903, 52.502],
                                    [-1.897, 52.502]
                                ]
                            }
                        }
                    ]
                });
            stores.get('group').setGroups([
                {
                    id: 'first',
                    name: 'First',
                    members: [{ layerId: 'OneWayStreets', historyId: 'one-way' }]
                },
                {
                    id: 'second',
                    name: 'Second',
                    members: [{ layerId: 'OneWayStreets', historyId: 'other-one-way' }]
                }
            ]);
        });
        const arrowheadOpacities = (historyId: string) =>
            page.evaluate((id) => {
                const mapStore = (
                    document.getElementById('app') as any
                ).__vue_app__.config.globalProperties.$pinia._s.get('map');
                const opacities: string[] = [];
                mapStore.layers
                    .find((layer: any) => layer.id === 'OneWayStreets')
                    .getLayer()
                    .eachLayer((line: any) => {
                        if (line.feature?.properties?.historyId === id) {
                            line._arrowheads.eachLayer((head: any) =>
                                opacities.push(head.getElement().getAttribute('stroke-opacity'))
                            );
                        }
                    });
                return [...new Set(opacities)];
            }, historyId);
        const setZoom = (zoom: number) =>
            page.evaluate(
                (value) =>
                    (
                        document.getElementById('app') as any
                    ).__vue_app__.config.globalProperties.$pinia._s
                        .get('map')
                        .map.setZoom(value, { animate: false }),
                zoom
            );

        expect(await arrowheadOpacities('one-way')).toEqual(['1']);

        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Hide group First', exact: true }).click();
        expect(await arrowheadOpacities('one-way')).toEqual(['0']);
        expect(await arrowheadOpacities('other-one-way')).toEqual(['1']);
        await setZoom(17);
        expect(await arrowheadOpacities('one-way')).toEqual(['0']);

        await page.getByRole('button', { name: 'Show only group First' }).click();
        expect(await arrowheadOpacities('one-way')).toEqual(['1']);
        expect(await arrowheadOpacities('other-one-way')).toEqual(['0']);

        await page.locator('[data-visibility="solo"]').click();
        expect(await arrowheadOpacities('one-way')).toEqual(['1']);
        expect(await arrowheadOpacities('other-one-way')).toEqual(['1']);
        await setZoom(16);
        expect(await arrowheadOpacities('one-way')).toEqual(['1']);
    });
});
