/**
 * Tests for MapSerializer imported-layer serialization round-trips.
 */
import { describe, it, expect } from 'vitest';
import { reactive } from 'vue';
import { MapSerializer } from '../../../src/services/MapSerializer';
import LZString from 'lz-string';
import { makeLayer, makeSettings, groups } from './MapSerializer.groups.helpers';

describe('MapSerializer — groups', () => {
    const serializer = new MapSerializer();
    const layers = new Map([['ModalFilters', makeLayer('ModalFilters')]]);

    it('serializes reactive imported layers into cloneable data', () => {
        const importedLayers = reactive([
            {
                id: 'imported-1',
                name: 'Wards',
                nameProperty: 'wd25nm',
                featureCollection: {
                    type: 'FeatureCollection',
                    features: []
                }
            }
        ]);

        const compact = serializer.toCompactStoredMap(
            makeSettings(),
            layers,
            undefined,
            importedLayers
        );

        expect(structuredClone(compact)).toEqual(compact);
        expect(compact.o).toEqual(importedLayers);
    });

    it('round-trips imported layers with compact URL geometry', () => {
        const importedLayers = [
            {
                id: 'imported-1',
                name: 'Wards',
                nameProperty: 'name',
                visible: false,
                featureCollection: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            id: 'ward-1',
                            properties: { name: 'Ward 1', category: 'example' },
                            geometry: { type: 'Point', coordinates: [-1.1234567, 52.7654321] }
                        },
                        {
                            type: 'Feature',
                            properties: null,
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [-1.1, 52.7],
                                    [-1.100001, 52.700002]
                                ]
                            }
                        }
                    ]
                }
            }
        ] as any;

        const hash = serializer.toEncodedHash(makeSettings(), layers, [], importedLayers);
        const payload = JSON.parse(
            LZString.decompressFromEncodedURIComponent(hash.slice(3)) as string
        );
        expect(payload.o[0].f).toHaveLength(2);
        expect(payload.o[0].f[0][0]).toEqual({
            t: 'Point',
            c: [-1123457, 52765432]
        });
        expect(payload.o[0].featureCollection).toBeUndefined();

        const restored = serializer.fromEncodedHash(hash);
        expect(restored?.importedLayers?.[0]).toEqual({
            ...importedLayers[0],
            featureCollection: {
                ...importedLayers[0].featureCollection,
                features: [
                    {
                        ...importedLayers[0].featureCollection.features[0],
                        id: 'ward-1',
                        geometry: {
                            type: 'Point',
                            coordinates: [-1.123457, 52.765432]
                        }
                    },
                    {
                        ...importedLayers[0].featureCollection.features[1],
                        properties: null
                    }
                ]
            }
        });
    });

    it('preserves null geometry in imported layers through the compact URL', () => {
        const importedLayers = [
            {
                id: 'imported-null',
                name: 'Incomplete records',
                nameProperty: null,
                featureCollection: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: { name: 'Unknown' },
                            geometry: null
                        }
                    ]
                }
            }
        ] as any;

        const hash = serializer.toEncodedHash(makeSettings(), layers, [], importedLayers);
        const payload = JSON.parse(
            LZString.decompressFromEncodedURIComponent(hash.slice(3)) as string
        );
        expect(payload.o[0].f[0][0]).toBeNull();

        const restored = serializer.fromEncodedHash(hash);
        expect(restored?.importedLayers?.[0].featureCollection.features[0].geometry).toBeNull();
    });

    it('round-trips imported GeometryCollection features through the compact URL', () => {
        const importedLayers = [
            {
                id: 'imported-gc',
                name: 'Mixed',
                nameProperty: null,
                featureCollection: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: null,
                            geometry: {
                                type: 'GeometryCollection',
                                geometries: [
                                    { type: 'Point', coordinates: [-1.1234567, 52.7654321] },
                                    {
                                        type: 'LineString',
                                        coordinates: [
                                            [-1.1, 52.7],
                                            [-1.100001, 52.700002]
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        ] as any;

        const hash = serializer.toEncodedHash(makeSettings(), layers, [], importedLayers);
        const payload = JSON.parse(
            LZString.decompressFromEncodedURIComponent(hash.slice(3)) as string
        );
        expect(payload.o[0].f[0][0].t).toBe('GeometryCollection');
        expect(payload.o[0].f[0][0].g).toHaveLength(2);

        const restored = serializer.fromEncodedHash(hash);
        expect(restored?.importedLayers?.[0].featureCollection.features[0].geometry).toEqual({
            type: 'GeometryCollection',
            geometries: [
                { type: 'Point', coordinates: [-1.123457, 52.765432] },
                {
                    type: 'LineString',
                    coordinates: [
                        [-1.1, 52.7],
                        [-1.100001, 52.700002]
                    ]
                }
            ]
        });
    });
});
