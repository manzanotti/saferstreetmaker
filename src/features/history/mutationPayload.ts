import type { LayerMutationEvent } from '../../models/LayerMutation';

export interface CompactPolylineEditPayload {
    historyId: string;
    beforeCoordinates: number[][];
    afterCoordinates: number[][];
}

export interface PointBatchDeletePayload {
    points: unknown[];
}

export interface PolylinePointChangePayload {
    historyId: string;
    pointChanges: Array<{
        type: 'update' | 'insert' | 'delete';
        index: number;
        before?: number[];
        after?: number[];
    }>;
}

export interface CompactPolygonEditPayload {
    historyId: string;
    beforeCoordinates: number[][][];
    afterCoordinates: number[][][];
    beforeLabel: string;
    afterLabel: string;
    beforeColor: string;
    afterColor: string;
}

export interface PolygonPointChangePayload {
    historyId: string;
    pointChanges: Array<{
        type: 'update' | 'insert' | 'delete';
        ringIndex: number;
        pointIndex: number;
        before?: number[];
        after?: number[];
    }>;
    beforeLabel: string;
    afterLabel: string;
    beforeColor: string;
    afterColor: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function buildPointFeatureFromMutation(mutation: LayerMutationEvent) {
    const payload = mutation.payload as
        | {
              lat?: number | null;
              lng?: number | null;
              historyId?: string | null;
          }
        | undefined;

    if (payload?.lat == null || payload?.lng == null) {
        return null;
    }

    return {
        type: 'Feature',
        properties: {
            historyId: payload.historyId ?? ''
        },
        geometry: {
            type: 'Point',
            coordinates: [payload.lng, payload.lat]
        }
    };
}

export function isCompactPolylineEditPayload(
    payload: unknown
): payload is CompactPolylineEditPayload {
    return (
        isRecord(payload) &&
        typeof payload.historyId === 'string' &&
        Array.isArray(payload.beforeCoordinates) &&
        Array.isArray(payload.afterCoordinates)
    );
}

export function isPointBatchDeletePayload(payload: unknown): payload is PointBatchDeletePayload {
    return isRecord(payload) && Array.isArray(payload.points);
}

export function isPolylinePointChangePayload(
    payload: unknown
): payload is PolylinePointChangePayload {
    return (
        isRecord(payload) &&
        typeof payload.historyId === 'string' &&
        Array.isArray(payload.pointChanges)
    );
}

export function isCompactPolygonEditPayload(
    payload: unknown
): payload is CompactPolygonEditPayload {
    return (
        isRecord(payload) &&
        typeof payload.historyId === 'string' &&
        Array.isArray(payload.beforeCoordinates) &&
        Array.isArray(payload.afterCoordinates) &&
        typeof payload.beforeLabel === 'string' &&
        typeof payload.afterLabel === 'string' &&
        typeof payload.beforeColor === 'string' &&
        typeof payload.afterColor === 'string'
    );
}

export function isPolygonPointChangePayload(
    payload: unknown
): payload is PolygonPointChangePayload {
    return (
        isRecord(payload) &&
        typeof payload.historyId === 'string' &&
        Array.isArray(payload.pointChanges) &&
        typeof payload.beforeLabel === 'string' &&
        typeof payload.afterLabel === 'string' &&
        typeof payload.beforeColor === 'string' &&
        typeof payload.afterColor === 'string'
    );
}

export function normaliseFeatureMutationPayload(kind: string, payload: unknown): unknown {
    if (!isRecord(payload) || 'before' in payload || 'after' in payload) {
        return payload;
    }

    if (kind === 'polyline-add' || kind === 'polygon-add') {
        return { after: payload };
    }

    if (kind === 'polyline-delete' || kind === 'polygon-delete') {
        return { before: payload };
    }

    return payload;
}
