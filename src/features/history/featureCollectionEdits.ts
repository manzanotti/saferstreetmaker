import type { PolygonPointChangePayload, PolylinePointChangePayload } from './mutationPayload';

export function cloneHistoryValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function serialiseHistoryFeature(feature: unknown): string {
    return JSON.stringify(feature);
}

export function getHistoryFeatureId(feature: unknown): string | null {
    return (
        ((feature as { properties?: { historyId?: unknown } } | null | undefined)?.properties
            ?.historyId as string | undefined) ?? null
    );
}

export function replaceHistoryFeature(
    features: unknown[],
    fromHistoryId: string | null,
    fromKey: string | null,
    nextFeature: unknown
): boolean {
    const index = features.findIndex((feature) => {
        const currentHistoryId = getHistoryFeatureId(feature);
        if (fromHistoryId !== null && currentHistoryId !== null) {
            return currentHistoryId === fromHistoryId;
        }

        return serialiseHistoryFeature(feature) === fromKey;
    });
    if (index < 0) {
        return false;
    }

    features[index] = nextFeature;
    return true;
}

export function replacePolylineCoordinates(
    features: unknown[],
    historyId: string,
    coordinates: number[][]
): boolean {
    const index = findFeatureIndex(features, historyId);
    if (index < 0) {
        return false;
    }

    const nextFeature = cloneHistoryValue(
        features[index] as { geometry?: { coordinates?: unknown } }
    );
    if (!nextFeature.geometry) {
        return false;
    }

    nextFeature.geometry.coordinates = cloneHistoryValue(coordinates);
    features[index] = nextFeature;
    return true;
}

export function applyPolylinePointChanges(
    features: unknown[],
    payload: PolylinePointChangePayload,
    direction: 'undo' | 'redo'
): boolean {
    const index = findFeatureIndex(features, payload.historyId);
    if (index < 0) {
        return false;
    }

    const nextFeature = cloneHistoryValue(
        features[index] as { geometry?: { coordinates?: unknown } }
    );
    const nextCoordinates = nextFeature.geometry?.coordinates;
    if (!Array.isArray(nextCoordinates)) {
        return false;
    }

    const deleteChanges = payload.pointChanges.filter((change) => {
        return (
            (direction === 'undo' && change.type === 'insert') ||
            (direction === 'redo' && change.type === 'delete')
        );
    });
    deleteChanges
        .sort((left, right) => right.index - left.index)
        .forEach((change) => nextCoordinates.splice(change.index, 1));

    for (const change of payload.pointChanges) {
        if (change.type !== 'update') {
            continue;
        }

        const target = direction === 'undo' ? change.before : change.after;
        if (!Array.isArray(target) || !Array.isArray(nextCoordinates[change.index])) {
            return false;
        }
        nextCoordinates[change.index] = cloneHistoryValue(target);
    }

    const insertChanges = payload.pointChanges.filter((change) => {
        return (
            (direction === 'undo' && change.type === 'delete') ||
            (direction === 'redo' && change.type === 'insert')
        );
    });
    if (
        insertChanges.some((change) => {
            const target = direction === 'undo' ? change.before : change.after;
            return !Array.isArray(target);
        })
    ) {
        return false;
    }
    insertChanges
        .sort((left, right) => left.index - right.index)
        .forEach((change) => {
            const target = direction === 'undo' ? change.before : change.after;
            nextCoordinates.splice(change.index, 0, cloneHistoryValue(target as number[]));
        });

    features[index] = nextFeature;
    return true;
}

export function replacePolygonState(
    features: unknown[],
    historyId: string,
    coordinates: number[][][],
    label: string,
    color: string
): boolean {
    const index = findFeatureIndex(features, historyId);
    if (index < 0) {
        return false;
    }

    const nextFeature = cloneHistoryValue(
        features[index] as {
            geometry?: { coordinates?: unknown };
            properties?: Record<string, unknown>;
        }
    );
    if (!nextFeature.geometry) {
        return false;
    }

    nextFeature.geometry.coordinates = cloneHistoryValue(coordinates);
    nextFeature.properties = nextFeature.properties ?? {};
    nextFeature.properties.label = label;
    nextFeature.properties.color = color;
    nextFeature.properties.historyId = historyId;
    features[index] = nextFeature;
    return true;
}

export function applyPolygonPointChanges(
    features: unknown[],
    payload: PolygonPointChangePayload,
    direction: 'undo' | 'redo'
): boolean {
    const index = findFeatureIndex(features, payload.historyId);
    if (index < 0) {
        return false;
    }

    const nextFeature = cloneHistoryValue(
        features[index] as {
            geometry?: { coordinates?: number[][][] };
            properties?: Record<string, unknown>;
        }
    );
    const nextCoordinates = nextFeature.geometry?.coordinates;
    if (!Array.isArray(nextCoordinates)) {
        return false;
    }

    const deleteChanges = payload.pointChanges.filter((change) => {
        return (
            (direction === 'undo' && change.type === 'insert') ||
            (direction === 'redo' && change.type === 'delete')
        );
    });
    if (deleteChanges.some((change) => !Array.isArray(nextCoordinates[change.ringIndex]))) {
        return false;
    }
    deleteChanges
        .sort((left, right) => {
            return left.ringIndex === right.ringIndex
                ? right.pointIndex - left.pointIndex
                : right.ringIndex - left.ringIndex;
        })
        .forEach((change) => nextCoordinates[change.ringIndex].splice(change.pointIndex, 1));

    for (const change of payload.pointChanges) {
        if (change.type !== 'update') {
            continue;
        }

        const ring = nextCoordinates[change.ringIndex];
        const target = direction === 'undo' ? change.before : change.after;
        if (
            !Array.isArray(ring) ||
            !Array.isArray(ring[change.pointIndex]) ||
            !Array.isArray(target)
        ) {
            return false;
        }
        ring[change.pointIndex] = cloneHistoryValue(target);
    }

    const insertChanges = payload.pointChanges.filter((change) => {
        return (
            (direction === 'undo' && change.type === 'delete') ||
            (direction === 'redo' && change.type === 'insert')
        );
    });
    if (
        insertChanges.some((change) => {
            const target = direction === 'undo' ? change.before : change.after;
            return !Array.isArray(nextCoordinates[change.ringIndex]) || !Array.isArray(target);
        })
    ) {
        return false;
    }
    insertChanges
        .sort((left, right) => {
            return left.ringIndex === right.ringIndex
                ? left.pointIndex - right.pointIndex
                : left.ringIndex - right.ringIndex;
        })
        .forEach((change) => {
            const target = direction === 'undo' ? change.before : change.after;
            nextCoordinates[change.ringIndex].splice(
                change.pointIndex,
                0,
                cloneHistoryValue(target as number[])
            );
        });

    nextFeature.properties = nextFeature.properties ?? {};
    nextFeature.properties.label = direction === 'undo' ? payload.beforeLabel : payload.afterLabel;
    nextFeature.properties.color = direction === 'undo' ? payload.beforeColor : payload.afterColor;
    nextFeature.properties.historyId = payload.historyId;
    features[index] = nextFeature;
    return true;
}

function findFeatureIndex(features: unknown[], historyId: string): number {
    return features.findIndex((feature) => getHistoryFeatureId(feature) === historyId);
}
