import type { LayerMutationEvent } from '../../models/LayerMutation';
import {
    applyPolygonPointChanges,
    applyPolylinePointChanges,
    getHistoryFeatureId,
    replaceHistoryFeature,
    replacePolygonState,
    replacePolylineCoordinates,
    serialiseHistoryFeature
} from './featureCollectionEdits';
import {
    buildPointFeatureFromMutation,
    isCompactPolygonEditPayload,
    isCompactPolylineEditPayload,
    isPointBatchDeletePayload,
    isPolygonPointChangePayload,
    isPolylinePointChangePayload
} from './mutationPayload';

export interface HistoryFeatureCollection {
    type: 'FeatureCollection';
    features: unknown[];
}

export type HistoryReplayDirection = 'undo' | 'redo';

export function replayFeatureMutation(
    current: { features?: unknown[] },
    mutation: LayerMutationEvent,
    direction: HistoryReplayDirection
): HistoryFeatureCollection | null {
    const featureCollection: HistoryFeatureCollection = {
        type: 'FeatureCollection',
        features: [...(current.features ?? [])]
    };
    const features = featureCollection.features;
    const payload = mutation.payload as { before?: unknown; after?: unknown } | undefined;
    const beforeFeature = payload?.before;
    const afterFeature = payload?.after;

    if (mutation.kind === 'point-batch-delete') {
        if (!isPointBatchDeletePayload(mutation.payload)) {
            return null;
        }

        if (direction === 'undo') {
            addMissingFeatures(features, mutation.payload.points);
        } else {
            featureCollection.features = removeFeatures(features, mutation.payload.points);
        }
        return featureCollection;
    }

    if (mutation.kind === 'point-add' || mutation.kind === 'point-delete') {
        const pointFeature = buildPointFeatureFromMutation(mutation);
        if (!pointFeature) {
            return null;
        }

        const shouldAdd =
            (mutation.kind === 'point-add' && direction === 'redo') ||
            (mutation.kind === 'point-delete' && direction === 'undo');

        if (shouldAdd) {
            addFeatureIfMissing(features, pointFeature);
        } else {
            featureCollection.features = removeFeatures(features, [pointFeature]);
        }
        return featureCollection;
    }

    if (mutation.kind === 'polyline-add' || mutation.kind === 'polygon-add') {
        if (direction === 'undo') {
            featureCollection.features = removeFeatures(features, [afterFeature]);
        } else if (afterFeature) {
            addFeatureIfMissing(features, afterFeature);
        } else {
            return null;
        }
        return featureCollection;
    }

    if (
        mutation.kind === 'polyline-delete' ||
        mutation.kind === 'polygon-delete' ||
        mutation.kind === 'polygon-batch-delete'
    ) {
        if (direction === 'undo') {
            if (beforeFeature) {
                addFeatureIfMissing(features, beforeFeature);
            }
        } else {
            featureCollection.features = removeFeatures(features, [beforeFeature]);
        }
        return featureCollection;
    }

    if (mutation.kind === 'polyline-edit' || mutation.kind === 'polyline-vertices-delete') {
        if (isPolylinePointChangePayload(mutation.payload)) {
            return applyPolylinePointChanges(features, mutation.payload, direction)
                ? featureCollection
                : null;
        }

        if (isCompactPolylineEditPayload(mutation.payload)) {
            const coordinates =
                direction === 'undo'
                    ? mutation.payload.beforeCoordinates
                    : mutation.payload.afterCoordinates;
            return replacePolylineCoordinates(features, mutation.payload.historyId, coordinates)
                ? featureCollection
                : null;
        }

        return replaceWholeFeature(features, beforeFeature, afterFeature, direction)
            ? featureCollection
            : null;
    }

    if (mutation.kind === 'polygon-edit') {
        if (isPolygonPointChangePayload(mutation.payload)) {
            return applyPolygonPointChanges(features, mutation.payload, direction)
                ? featureCollection
                : null;
        }

        if (isCompactPolygonEditPayload(mutation.payload)) {
            const coordinates =
                direction === 'undo'
                    ? mutation.payload.beforeCoordinates
                    : mutation.payload.afterCoordinates;
            const label =
                direction === 'undo' ? mutation.payload.beforeLabel : mutation.payload.afterLabel;
            const color =
                direction === 'undo' ? mutation.payload.beforeColor : mutation.payload.afterColor;
            return replacePolygonState(
                features,
                mutation.payload.historyId,
                coordinates,
                label,
                color
            )
                ? featureCollection
                : null;
        }

        return replaceWholeFeature(features, beforeFeature, afterFeature, direction)
            ? featureCollection
            : null;
    }

    return null;
}

function addMissingFeatures(features: unknown[], candidates: unknown[]): void {
    for (const candidate of candidates) {
        if (candidate) {
            addFeatureIfMissing(features, candidate);
        }
    }
}

function addFeatureIfMissing(features: unknown[], feature: unknown): void {
    if (!hasFeature(features, feature)) {
        features.push(feature);
    }
}

function hasFeature(features: unknown[], candidate: unknown): boolean {
    const candidateHistoryId = getHistoryFeatureId(candidate);
    const candidateKey = serialiseHistoryFeature(candidate);
    return features.some((feature) => {
        const historyId = getHistoryFeatureId(feature);
        if (candidateHistoryId !== null && historyId !== null) {
            return historyId === candidateHistoryId;
        }
        return serialiseHistoryFeature(feature) === candidateKey;
    });
}

function removeFeatures(features: unknown[], candidates: unknown[]): unknown[] {
    const historyIds = new Set<string>();
    const keys = new Set<string>();
    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }

        const historyId = getHistoryFeatureId(candidate);
        if (historyId !== null) {
            historyIds.add(historyId);
        } else {
            keys.add(serialiseHistoryFeature(candidate));
        }
    }

    return features.filter((feature) => {
        const historyId = getHistoryFeatureId(feature);
        if (historyId !== null && historyIds.has(historyId)) {
            return false;
        }
        return !keys.has(serialiseHistoryFeature(feature));
    });
}

function replaceWholeFeature(
    features: unknown[],
    beforeFeature: unknown,
    afterFeature: unknown,
    direction: HistoryReplayDirection
): boolean {
    const source = direction === 'undo' ? afterFeature : beforeFeature;
    const target = direction === 'undo' ? beforeFeature : afterFeature;
    if (!source || !target) {
        return false;
    }

    return replaceHistoryFeature(
        features,
        getHistoryFeatureId(source),
        serialiseHistoryFeature(source),
        target
    );
}
