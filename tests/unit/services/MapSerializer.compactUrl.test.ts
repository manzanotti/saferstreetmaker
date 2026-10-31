/**
 * Tests for MapSerializer compact URL geometry/property encoding and legacy hashes.
 */
import { describe, it, expect } from 'vitest';
import { MapSerializer } from '../../../src/services/MapSerializer';
import type { Group } from '../../../src/models/Group';
import LZString from 'lz-string';
import { makeLayer, makeSettings, groups } from './MapSerializer.groups.helpers';

describe('MapSerializer — groups', () => {
    const serializer = new MapSerializer();
    const layers = new Map([['ModalFilters', makeLayer('ModalFilters')]]);

    it('round-trips compact URL geometry and properties', () => {
        const featureLayer = {
            toGeoJSON: () => ({
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: { historyId: 'shared-id', label: 'Point' },
                        geometry: { type: 'Point', coordinates: [-1.1234567, 52.7654321] }
                    },
                    {
                        type: 'Feature',
                        properties: { historyId: 'line-id' },
                        geometry: {
                            type: 'LineString',
                            coordinates: [
                                [-1.1, 52.7],
                                [-1.100001, 52.700002],
                                [-1.100003, 52.700001]
                            ]
                        }
                    },
                    {
                        type: 'Feature',
                        properties: { historyId: 'shared-id', color: '#123456' },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [
                                [
                                    [-1.1, 52.7],
                                    [-1.2, 52.7],
                                    [-1.2, 52.8],
                                    [-1.1, 52.7]
                                ]
                            ]
                        }
                    }
                ]
            })
        } as any;
        const group: Group = {
            id: 'compact-group',
            name: 'Compact group',
            members: [{ layerId: 'TestLayer', historyId: 'shared-id' }]
        };

        const restored = serializer.fromEncodedHash(
            serializer.toEncodedHash(makeSettings(), new Map([['TestLayer', featureLayer]]), [
                group
            ])
        );
        const features = (restored?.layers?.TestLayer as any).features;

        expect(features[0].geometry.type).toBe('Point');
        expect(features[0].geometry.coordinates).toEqual([-1.123457, 52.765432]);
        expect(features[0].properties).toEqual({ historyId: 'shared-id', label: 'Point' });
        expect(features[1].geometry.type).toBe('LineString');
        expect(features[1].geometry.coordinates).toEqual([
            [-1.1, 52.7],
            [-1.100001, 52.700002],
            [-1.100003, 52.700001]
        ]);
        expect(features[2].geometry.type).toBe('Polygon');
        expect(restored?.groups?.[0].members).toEqual(group.members);
    });

    it('omits the properties tuple when a feature has no properties', () => {
        const featureLayer = {
            toGeoJSON: () => ({
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: [
                                [-1.1, 52.7],
                                [-1.100001, 52.700002]
                            ]
                        }
                    }
                ]
            })
        } as any;
        const hash = serializer.toEncodedHash(
            makeSettings(),
            new Map([['TestLayer', featureLayer]])
        );
        const payload = JSON.parse(
            LZString.decompressFromEncodedURIComponent(hash.slice(3)) as string
        );

        expect(payload.l.TestLayer[0]).toHaveLength(1);
        expect(payload.l.TestLayer[0][1]).toBeUndefined();
    });

    it('keeps decoding legacy LZ-string hashes', () => {
        const legacyMap = serializer.toJSON(makeSettings(), layers, groups);
        const legacyHash = LZString.compressToEncodedURIComponent(JSON.stringify(legacyMap));

        expect(serializer.fromEncodedHash(legacyHash)).toEqual(legacyMap);
    });
});
