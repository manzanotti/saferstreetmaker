import { describe, expect, it, vi } from 'vitest';
import { Settings } from '../../src/models/Settings';
import { MapSnapshotBuilder } from '../../src/features/map/MapSnapshotBuilder';

describe('MapSnapshotBuilder', () => {
    it('builds a serialized map from the current settings, layers, and groups', () => {
        const settings = new Settings();
        const layers = new Map();
        const groups = [{ name: 'Residents', hidden: false, members: [] }];
        const buildSerializedMap = vi.fn().mockReturnValue({ settings, layers, groups });
        const builder = new MapSnapshotBuilder({
            fileManager: { buildSerializedMap },
            getSettings: () => settings,
            getLayers: () => layers,
            getGroups: () => groups
        });

        expect(builder.build()).toEqual({ settings, layers, groups });
        expect(buildSerializedMap).toHaveBeenCalledWith(settings, layers, groups, []);
    });
});
