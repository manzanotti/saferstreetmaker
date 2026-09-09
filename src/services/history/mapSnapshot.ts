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
        groups: snapshot.groups,
        importedLayers: snapshot.importedLayers
    };
}

export function snapshotsEqualForHistory(
    left: SerializedMap | null,
    right: SerializedMap | null
): boolean {
    return areSnapshotsEqual(normaliseSnapshotForHistory(left), normaliseSnapshotForHistory(right));
}

function areSnapshotsEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) {
        return true;
    }

    if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
        return false;
    }

    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
            return false;
        }

        return left.every((value, index) => areSnapshotsEqual(value, right[index]));
    }

    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }

    return leftKeys.every(
        (key) =>
            Object.prototype.hasOwnProperty.call(rightRecord, key) &&
            areSnapshotsEqual(leftRecord[key], rightRecord[key])
    );
}
