import type { SerializedMap } from '../MapSerializer';

export function normaliseSnapshotForHistory(snapshot: SerializedMap | null): unknown {
    if (!snapshot) {
        return null;
    }

    const settingsWithoutView = snapshot.settings
        ? {
              title: snapshot.settings.title,
              readOnly: snapshot.settings.readOnly,
              hideToolbar: snapshot.settings.hideToolbar,
              activeLayers: snapshot.settings.activeLayers,
              version: snapshot.settings.version
          }
        : snapshot.settings;

    return {
        title: snapshot.title,
        settings: settingsWithoutView,
        layers: snapshot.layers,
        groups: snapshot.groups
    };
}

export function snapshotsEqualForHistory(
    left: SerializedMap | null,
    right: SerializedMap | null
): boolean {
    return (
        JSON.stringify(normaliseSnapshotForHistory(left)) ===
        JSON.stringify(normaliseSnapshotForHistory(right))
    );
}
