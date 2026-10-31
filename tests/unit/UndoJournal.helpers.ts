/**
 * Shared snapshot fixtures and no-op comparison for the UndoJournal unit tests.
 */
import type { SerializedMap } from '../../src/services/MapSerializer';

export function makeSnapshot(title: string): SerializedMap {
    return {
        settings: {
            title,
            readOnly: false,
            hideToolbar: false,
            activeLayers: [],
            centre: null,
            zoom: 12,
            version: '1.0.0'
        },
        layers: {},
        lastSaved: '2026-06-28T00:00:00.000Z'
    };
}

/** Snapshot whose only meaningful variables are zoom (view) and layers (feature). */
export function viewSnapshot(zoom: number, layers: Record<string, unknown> = {}): SerializedMap {
    return {
        settings: {
            title: 'M',
            readOnly: false,
            hideToolbar: false,
            activeLayers: [],
            centre: null,
            zoom,
            version: '1.0.0'
        },
        layers,
        lastSaved: '2026-06-28T00:00:00.000Z'
    };
}

/**
 * Test comparator mirroring useMapManager's history equality: two snapshots are
 * "no-op" when they match once map view state (centre/zoom) is stripped.
 */
export function isNoOp(before: unknown, after: unknown): boolean {
    const strip = (snapshot: unknown): string => {
        const s = snapshot as SerializedMap | null;
        if (!s) {
            return 'null';
        }
        const settings = s.settings
            ? {
                  title: s.settings.title,
                  readOnly: s.settings.readOnly,
                  hideToolbar: s.settings.hideToolbar,
                  activeLayers: s.settings.activeLayers,
                  version: s.settings.version
              }
            : s.settings;
        return JSON.stringify({
            title: s.title,
            settings,
            layers: s.layers,
            groups: s.groups
        });
    };
    return strip(before) === strip(after);
}
