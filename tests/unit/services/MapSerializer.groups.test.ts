/**
 * Tests for MapSerializer groups serialization round-trips.
 */
import { describe, it, expect } from 'vitest';
import { reactive } from 'vue';
import { MapSerializer } from '../../../src/services/MapSerializer';
import type { Group } from '../../../src/models/Group';
import LZString from 'lz-string';

// Minimal IMapLayer stub.
function makeLayer(id: string) {
    return {
        id,
        toGeoJSON: () => ({ type: 'FeatureCollection', features: [] })
    } as any;
}

function makeSettings() {
    return {
        title: 'Test Map',
        readOnly: false,
        hideToolbar: false,
        activeLayers: ['ModalFilters'],
        centre: null,
        zoom: 12,
        version: '0.9.0'
    } as any;
}

const groups: Group[] = [
    {
        id: 'group-1',
        name: 'School Zone',
        description: '<p><strong>Slow down</strong> near the school.</p>',
        color: '#00aa00',
        members: [
            { layerId: 'ModalFilters', historyId: 'hist-a' },
            { layerId: 'BusGates', historyId: 'hist-b' }
        ]
    },
    {
        id: 'group-2',
        name: 'Cycle Route',
        members: [{ layerId: 'MobilityLanes', historyId: 'hist-c' }]
    }
];

const phasedGroup: Group = {
    id: 'group-phased',
    name: 'Phased Route',
    defaultVersionId: 'version-1',
    versions: [
        {
            id: 'version-1',
            name: 'Delivery plan',
            members: [
                { layerId: 'ModalFilters', historyId: 'hist-1' },
                { layerId: 'ModalFilters', historyId: 'hist-2' }
            ],
            phases: [
                {
                    id: 'phase-1',
                    members: [{ layerId: 'ModalFilters', historyId: 'hist-1' }]
                },
                {
                    id: 'phase-2',
                    members: [{ layerId: 'ModalFilters', historyId: 'hist-2' }]
                }
            ]
        }
    ]
};

describe('MapSerializer — groups', () => {
    const serializer = new MapSerializer();
    const layers = new Map([['ModalFilters', makeLayer('ModalFilters')]]);

    // ── toJSON ────────────────────────────────────────────────────────────────

    it('toJSON includes groups when provided', () => {
        const result = serializer.toJSON(makeSettings(), layers, groups);
        expect(result.groups).toHaveLength(2);
        expect(result.groups![0].id).toBe('group-1');
        expect(result.groups![0].name).toBe('School Zone');
        expect(result.groups![0].description).toBe(
            '<p><strong>Slow down</strong> near the school.</p>'
        );
        expect(result.groups![0].color).toBe('#00aa00');
        expect(result.groups![0].members).toHaveLength(2);
    });

    it('toJSON omits groups property when groups array is empty', () => {
        const result = serializer.toJSON(makeSettings(), layers, []);
        expect(result.groups).toBeUndefined();
    });

    it('toJSON omits groups property when groups is undefined', () => {
        const result = serializer.toJSON(makeSettings(), layers);
        expect(result.groups).toBeUndefined();
    });

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

    // ── toCompactStoredMap / fromCompactStoredMap ─────────────────────────────

    it('round-trips groups through compact storage', () => {
        const compact = serializer.toCompactStoredMap(makeSettings(), layers, groups);
        expect(compact.g).toHaveLength(2);
        expect(compact.g![0]).toEqual({
            i: 'group-1',
            n: 'School Zone',
            c: '#00aa00',
            p: '<p><strong>Slow down</strong> near the school.</p>',
            m: [
                ['ModalFilters', 'hist-a'],
                ['BusGates', 'hist-b']
            ]
        });

        const restored = serializer.fromCompactStoredMap(compact);
        expect(restored.groups).toHaveLength(2);
        expect(restored.groups![0]).toEqual(groups[0]);
        expect(restored.groups![1]).toEqual(groups[1]);
    });

    it('fromCompactStoredMap handles missing g field gracefully', () => {
        const compact = serializer.toCompactStoredMap(makeSettings(), layers);
        expect(compact.g).toBeUndefined();
        const restored = serializer.fromCompactStoredMap(compact);
        expect(restored.groups).toBeUndefined();
    });

    // ── toCompactStoredMapFromSerialized ──────────────────────────────────────

    it('toCompactStoredMapFromSerialized preserves groups', () => {
        const serialized = serializer.toJSON(makeSettings(), layers, groups);
        const compact = serializer.toCompactStoredMapFromSerialized(serialized);
        expect(compact.g).toHaveLength(2);
        expect(compact.g![1].n).toBe('Cycle Route');
    });

    // ── toEncodedHash / fromEncodedHash ───────────────────────────────────────

    it('round-trips groups through encoded hash', () => {
        const hash = serializer.toEncodedHash(makeSettings(), layers, groups);
        const restored = serializer.fromEncodedHash(hash);
        expect(restored?.groups).toHaveLength(2);
        expect(restored?.groups![0].name).toBe('School Zone');
        expect(restored?.groups![0].members[0]).toEqual({
            layerId: 'ModalFilters',
            historyId: 'hist-a'
        });
        expect(restored?.groups![0].color).toBe('#00aa00');
        expect(restored?.groups![0].description).toBe(
            '<p><strong>Slow down</strong> near the school.</p>'
        );
    });

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

    it('round-trips ordered version phases through JSON and compact storage', () => {
        const json = serializer.toJSON(makeSettings(), layers, [phasedGroup]);
        expect(json.groups?.[0].versions?.[0].phases).toEqual(phasedGroup.versions?.[0].phases);

        const compact = serializer.toCompactStoredMap(makeSettings(), layers, [phasedGroup]);
        expect(compact.g?.[0].v?.[0].p).toEqual([
            { i: 'phase-1', m: [['ModalFilters', 'hist-1']] },
            { i: 'phase-2', m: [['ModalFilters', 'hist-2']] }
        ]);
        expect(serializer.fromCompactStoredMap(compact).groups?.[0]).toEqual(phasedGroup);
    });
});
