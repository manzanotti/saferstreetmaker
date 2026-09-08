import type * as L from 'leaflet';
import type { SelectedMarker } from '../../stores/selectionStore';

export function selectedLatLngsByMarker(selected: SelectedMarker[]): Map<object, Set<L.LatLng>> {
    const result = new Map<object, Set<L.LatLng>>();
    for (const { marker, latLng } of selected) {
        const key = marker as object;
        let latLngs = result.get(key);
        if (!latLngs) {
            latLngs = new Set<L.LatLng>();
            result.set(key, latLngs);
        }
        latLngs.add(latLng);
    }
    return result;
}

export function isPlainPropertiesRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export function buildClipboardFeature(
    layerId: string,
    marker: L.Layer,
    feature: GeoJSON.Feature
): GeoJSON.Feature {
    const layerMarker = marker as L.Layer & {
        properties?: unknown;
        options?: { color?: unknown };
    };
    const markerProperties = isPlainPropertiesRecord(layerMarker.properties)
        ? layerMarker.properties
        : null;

    if (!markerProperties) {
        return feature;
    }

    const clipboardFeature = JSON.parse(JSON.stringify(feature)) as GeoJSON.Feature;
    clipboardFeature.properties = {
        ...(clipboardFeature.properties ?? {}),
        ...markerProperties
    };

    if (layerId === 'LtnCells' && typeof layerMarker.options?.color === 'string') {
        (clipboardFeature.properties as Record<string, unknown>).color = layerMarker.options.color;
    }

    return clipboardFeature;
}
