import type { SerializedMap } from '../MapSerializer';

export function snapshotForHistory(snapshot: SerializedMap): SerializedMap {
    const { centre: _legacyCentre, zoom: _legacyZoom, ...snapshotWithoutLegacyView } = snapshot;
    if (!snapshot.settings) {
        return snapshotWithoutLegacyView;
    }

    const { centre: _centre, zoom: _zoom, ...settingsWithoutView } = snapshot.settings;
    return {
        ...snapshotWithoutLegacyView,
        settings: settingsWithoutView as SerializedMap['settings']
    };
}

export function normaliseSnapshotForHistory(snapshot: SerializedMap | null): unknown {
    if (!snapshot) {
        return null;
    }

    const { centre: _centre, zoom: _zoom, ...settingsWithoutView } = snapshot.settings ?? {};

    return {
        title: snapshot.title,
        settings: snapshot.settings ? settingsWithoutView : undefined,
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
