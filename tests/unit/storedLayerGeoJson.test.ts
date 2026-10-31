import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as L from 'leaflet';
import { parseStoredLayerGeoJson } from '../../src/features/map/storedLayerGeoJson';
import { MapLayerController } from '../../src/features/map/MapLayerController';
import { createMobilityLaneLayer } from '../../src/composables/layers/useMobilityLaneLayer';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

describe('stored layer GeoJSON boundary', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('normalizes historical nested line coordinates and preserves feature properties', () => {
        const stored = {
            features: [
                {
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [
                                [-1.9, 52.5],
                                [-1.8, 52.6]
                            ]
                        ]
                    },
                    properties: { historyId: 'old-line', name: 'High Street' }
                }
            ]
        };

        const result = parseStoredLayerGeoJson(stored, 'MobilityLanes', 'polyline');
        expect(result).toEqual({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [-1.9, 52.5],
                            [-1.8, 52.6]
                        ]
                    },
                    properties: { historyId: 'old-line', name: 'High Street' }
                }
            ]
        });
        expect(stored.features[0].geometry.coordinates).toHaveLength(1);
    });

    it('loads legacy cycle lanes through the controller without losing geometry or identity', () => {
        const map = new L.Map();
        const layer = createMobilityLaneLayer(map);
        const controller = new MapLayerController({ getMap: () => map, getLayers: () => [layer] });
        controller.loadLayers(
            {
                CycleLanes: {
                    features: [
                        {
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [
                                        [-1.9, 52.5],
                                        [-1.8, 52.6]
                                    ]
                                ]
                            },
                            properties: { historyId: 'legacy-id', name: 'Old route' }
                        }
                    ]
                }
            },
            ['MobilityLanes']
        );

        const feature = layer.toGeoJSON().features[0];
        expect(feature.geometry).toEqual({
            type: 'LineString',
            coordinates: [
                [-1.9, 52.5],
                [-1.8, 52.6]
            ]
        });
        expect(feature.properties).toMatchObject({ historyId: 'legacy-id', name: 'Old route' });
        expect(layer.visible).toBe(true);
    });

    it.each([
        [null, 'feature collection'],
        [{ type: 'Point', features: [] }, 'feature collection'],
        [{ features: 'invalid' }, 'feature collection'],
        [{ features: [{ geometry: null }] }, 'invalid Point geometry'],
        [
            { features: [{ geometry: { type: 'Polygon', coordinates: [] } }] },
            'invalid Point geometry'
        ],
        [
            { features: [{ geometry: { type: 'Point', coordinates: ['x', 1] } }] },
            'invalid coordinates'
        ],
        [
            { features: [{ geometry: { type: 'Point', coordinates: [1, 2] }, properties: 42 }] },
            'invalid properties'
        ]
    ])('reports malformed map layer data', (value, message) => {
        expect(() => parseStoredLayerGeoJson(value, 'ModalFilters', 'point')).toThrow(message);
    });
});
