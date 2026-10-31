/**
 * Unit tests for LtnLayer composable — loadFromGeoJSON().
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createLtnLayer } from '../../../src/composables/layers/useLtnLayer';
import { makeMockMap, polygonFeatureCollection } from './LtnLayer.helpers';

describe('LtnLayer (composable)', () => {
    let map: L.Map;
    let layer: ReturnType<typeof createLtnLayer>;

    beforeEach(() => {
        setActivePinia(createPinia());
        map = makeMockMap();
        layer = createLtnLayer(map);
    });

    describe('loadFromGeoJSON()', () => {
        it('handles null gracefully', () => {
            expect(() => (layer as any).loadFromGeoJSON(null)).not.toThrow();
        });

        it('accepts an empty feature collection', () => {
            expect(() => layer.loadFromGeoJSON({ features: [] } as any)).not.toThrow();
        });

        it('loads polygon features', () => {
            const addLayerSpy = vi.spyOn(layer.getLayer(), 'addLayer');
            layer.loadFromGeoJSON(
                polygonFeatureCollection([
                    [
                        [
                            [0, 0],
                            [1, 0],
                            [1, 1],
                            [0, 1],
                            [0, 0]
                        ]
                    ]
                ]) as any
            );
            expect(addLayerSpy).toHaveBeenCalledTimes(1);
        });

        it('exposes historyId on loaded polygons so grouping can identify them', () => {
            layer.loadFromGeoJSON({
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: { label: 'A', color: '#cc00cc', historyId: 'ltn-xyz' },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [
                                [
                                    [0, 0],
                                    [1, 0],
                                    [1, 1],
                                    [0, 1],
                                    [0, 0]
                                ]
                            ]
                        }
                    }
                ]
            } as any);

            const polygon = layer.getLayer().getLayers()[0] as any;
            // Area-selection and grouping identify LTN polygons via
            // properties.historyId, so it must be present.
            expect(polygon.properties?.historyId).toBe('ltn-xyz');
        });

        it('loads multiple polygon features', () => {
            const addLayerSpy = vi.spyOn(layer.getLayer(), 'addLayer');
            layer.loadFromGeoJSON(
                polygonFeatureCollection([
                    [
                        [
                            [0, 0],
                            [1, 0],
                            [1, 1],
                            [0, 1],
                            [0, 0]
                        ]
                    ],
                    [
                        [
                            [2, 2],
                            [3, 2],
                            [3, 3],
                            [2, 3],
                            [2, 2]
                        ]
                    ]
                ]) as any
            );
            expect(addLayerSpy).toHaveBeenCalledTimes(2);
        });

        it('keeps labels hidden when loading at low zoom', () => {
            vi.spyOn(map, 'getZoom').mockReturnValue(10);
            const closeTooltipSpy = vi.spyOn(L.Polygon.prototype, 'closeTooltip');

            layer.loadFromGeoJSON(
                polygonFeatureCollection([
                    [
                        [
                            [0, 0],
                            [1, 0],
                            [1, 1],
                            [0, 1],
                            [0, 0]
                        ]
                    ]
                ]) as any
            );

            expect(closeTooltipSpy).toHaveBeenCalled();
        });

        it('shows labels when loading at high zoom', () => {
            vi.spyOn(map, 'getZoom').mockReturnValue(15);
            const openTooltipSpy = vi.spyOn(L.Polygon.prototype, 'openTooltip');

            layer.loadFromGeoJSON(
                polygonFeatureCollection([
                    [
                        [
                            [0, 0],
                            [1, 0],
                            [1, 1],
                            [0, 1],
                            [0, 0]
                        ]
                    ]
                ]) as any
            );

            expect(openTooltipSpy).toHaveBeenCalled();
        });

        it('keeps labels hidden when polygon is added to map at low zoom', () => {
            vi.spyOn(map, 'getZoom').mockReturnValue(10);

            layer.loadFromGeoJSON(
                polygonFeatureCollection([
                    [
                        [
                            [0, 0],
                            [1, 0],
                            [1, 1],
                            [0, 1],
                            [0, 0]
                        ]
                    ]
                ]) as any
            );

            const closeTooltipSpy = vi.spyOn(L.Polygon.prototype, 'closeTooltip');
            const polygon = layer.getLayer().getLayers()[0] as any;
            const addHandlers = (polygon._handlers?.add ?? []) as Array<() => void>;
            addHandlers.forEach((handler) => {
                handler();
            });

            expect(closeTooltipSpy).toHaveBeenCalled();
        });
    });
});
