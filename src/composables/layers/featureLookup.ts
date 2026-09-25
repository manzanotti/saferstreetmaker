import * as L from 'leaflet';
import type { IMapLayer } from './IMapLayer';

/**
 * Read a feature's history id from a Leaflet layer, tolerating the two storage
 * conventions in use across the app:
 *   - Points and polylines attach a GeoJSON `feature`, so the id lives at
 *     `feature.properties.historyId`.
 *   - LTN polygons keep their metadata on a plain `properties` bag, so the id
 *     lives at `properties.historyId`.
 * Returns null when neither is present. Centralising this lookup avoids the
 * class of bugs where one call site checks only one location and silently
 * fails to identify polygons.
 */
export function getFeatureHistoryId(marker: unknown): string | null {
    const layer = marker as {
        feature?: { properties?: { historyId?: unknown } };
        properties?: { historyId?: unknown };
    } | null;
    const id = layer?.feature?.properties?.historyId ?? layer?.properties?.historyId;
    return typeof id === 'string' && id !== '' ? id : null;
}

export function findLayerFeatureByHistoryId(
    layers: IMapLayer[],
    layerId: string,
    historyId: string
): L.Layer | null {
    const layer = layers.find((item) => item.id === layerId)?.getLayer();
    let found: L.Layer | null = null;
    layer?.eachLayer((feature) => {
        if (getFeatureHistoryId(feature) === historyId) {
            found = feature;
        }
    });
    return found;
}

export function buildHistoryId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
