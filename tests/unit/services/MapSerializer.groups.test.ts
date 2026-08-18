/**
 * Tests for MapSerializer groups serialization round-trips.
 */
import { describe, it, expect } from 'vitest';
import { MapSerializer } from '../../../src/services/MapSerializer';
import type { Group } from '../../../src/models/Group';

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
