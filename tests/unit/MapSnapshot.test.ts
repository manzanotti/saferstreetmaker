import { describe, expect, it } from 'vitest';
import type { SerializedMap } from '../../src/services/MapSerializer';
import {
    normaliseSnapshotForHistory,
    snapshotsEqualForHistory
} from '../../src/services/history/mapSnapshot';

function makeSnapshot(): SerializedMap {
    return {
        settings: {
            title: 'Test map',
            readOnly: false,
            hideToolbar: false,
            activeLayers: ['ModalFilters'],
            centre: { lat: 52.5, lng: -1.9 },
            zoom: 14,
            version: '0.9.0'
        },
        layers: { ModalFilters: { type: 'FeatureCollection', features: [] } },
        groups: []
    };
}

describe('map snapshot history comparison', () => {
    it('ignores centre and zoom changes', () => {
        const before = makeSnapshot();
        const after = makeSnapshot();
        after.settings!.centre = { lat: 51.5, lng: -0.1 };
        after.settings!.zoom = 18;

        expect(snapshotsEqualForHistory(before, after)).toBe(true);
        expect(normaliseSnapshotForHistory(after)).not.toHaveProperty('settings.centre');
        expect(normaliseSnapshotForHistory(after)).not.toHaveProperty('settings.zoom');
    });

    it.each([
        ['settings', (snapshot: SerializedMap) => (snapshot.settings!.readOnly = true)],
        [
            'layers',
            (snapshot: SerializedMap) =>
                (snapshot.layers = {
                    ModalFilters: { type: 'FeatureCollection', features: [{ type: 'Feature' }] }
                })
        ],
        [
            'groups',
            (snapshot: SerializedMap) =>
                (snapshot.groups = [{ id: 'group-1', name: 'Group', members: [] }])
        ]
    ])('detects %s changes', (_name, mutate) => {
        const before = makeSnapshot();
        const after = makeSnapshot();
        mutate(after);

        expect(snapshotsEqualForHistory(before, after)).toBe(false);
    });

    it('treats two missing snapshots as equal', () => {
        expect(snapshotsEqualForHistory(null, null)).toBe(true);
        expect(snapshotsEqualForHistory(makeSnapshot(), null)).toBe(false);
    });

    it('ignores object key order when comparing snapshots', () => {
        const before = makeSnapshot();
        const after = makeSnapshot();
        after.layers = { ...before.layers };
        after.settings = {
            version: before.settings!.version,
            zoom: before.settings!.zoom,
            centre: before.settings!.centre,
            title: before.settings!.title,
            readOnly: before.settings!.readOnly,
            hideToolbar: before.settings!.hideToolbar,
            activeLayers: before.settings!.activeLayers
        };

        expect(snapshotsEqualForHistory(before, after)).toBe(true);
    });

    it('detects nested snapshot changes without serializing the whole snapshot', () => {
        const before = makeSnapshot();
        const after = makeSnapshot();
        after.settings!.activeLayers = ['LtnCells'];

        expect(snapshotsEqualForHistory(before, after)).toBe(false);
    });

    it('matches JSON semantics for undefined object properties', () => {
        const before = makeSnapshot();
        const after = makeSnapshot();
        (before.settings as Record<string, unknown>).optionalField = undefined;

        expect(snapshotsEqualForHistory(before, after)).toBe(true);
    });
});
