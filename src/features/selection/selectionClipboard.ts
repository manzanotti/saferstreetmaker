import type * as L from 'leaflet';
import { getPolylineLatLngs } from '../../geometry/leafletGeometry';
import type { ClipboardEntry, SelectedMarker } from '../../stores/selectionStore';
import type { SelectionCommandContext } from './selectionCommands';

function selectedLatLngsByMarker(selected: SelectedMarker[]): Map<object, Set<L.LatLng>> {
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

function isPlainPropertiesRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function buildClipboardFeature(
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

export function copySelection(context: SelectionCommandContext): void {
    if (context.selected.length === 0) {
        return;
    }

    const selectedByMarker = selectedLatLngsByMarker(context.selected);
    const seen = new Set<object>();
    const entries: ClipboardEntry[] = [];

    for (const { layerId, marker } of context.selected) {
        if (seen.has(marker as object)) {
            continue;
        }
        seen.add(marker as object);

        const layer = context.layers.find((item) => item.id === layerId);
        if (!layer) {
            continue;
        }

        const sourceFeature = (
            marker as L.Layer & { toGeoJSON?: () => GeoJSON.Feature | null }
        ).toGeoJSON?.();
        if (!sourceFeature) {
            continue;
        }

        const feature = buildClipboardFeature(layerId, marker, sourceFeature);
        if (layer.kind === 'polyline') {
            const selectedRefs = selectedByMarker.get(marker as object) ?? new Set<L.LatLng>();
            const currentLatLngs = getPolylineLatLngs(marker);
            const selectedCoordinates = currentLatLngs
                .filter((latLng) => selectedRefs.has(latLng))
                .map((latLng) => [latLng.lng, latLng.lat]);

            if (selectedCoordinates.length < 2) {
                continue;
            }

            const copiedFeature = JSON.parse(JSON.stringify(feature)) as GeoJSON.Feature;
            if (copiedFeature.geometry?.type === 'LineString') {
                copiedFeature.geometry.coordinates = selectedCoordinates;
            }
            entries.push({ layerId, feature: copiedFeature });
            continue;
        }

        entries.push({ layerId, feature });
    }

    context.copyToClipboard(entries);
}

export function pasteSelection(context: SelectionCommandContext): void {
    if (context.clipboard.length === 0) {
        return;
    }

    const byLayer = new Map<string, GeoJSON.Feature[]>();
    for (const { layerId, feature } of context.clipboard) {
        const features = byLayer.get(layerId) ?? [];
        features.push(feature);
        byLayer.set(layerId, features);
    }

    const visibleLayerIds = new Set(context.visibleLayerIds);
    for (const [layerId, features] of byLayer) {
        const layer = context.layers.find((item) => item.id === layerId);
        if (!layer) {
            continue;
        }

        visibleLayerIds.add(layerId);
        const newFeatures = features.map((feature) => {
            const cloned = JSON.parse(JSON.stringify(feature)) as GeoJSON.Feature;
            cloned.properties = cloned.properties ?? {};
            cloned.properties.historyId =
                typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : `paste-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            return cloned;
        });

        layer.loadFromGeoJSON({
            type: 'FeatureCollection',
            features: newFeatures
        } as unknown as L.GeoJSON);
    }

    context.setVisibleLayerIds(visibleLayerIds);
    context.markLayerUpdated();
}
