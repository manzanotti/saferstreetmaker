import type * as L from 'leaflet';
import type { IMapLayer } from '../../composables/layers/IMapLayer';
import { getFeatureHistoryId } from '../../composables/layers/layerUtils';
import { getPolylineLatLngs } from '../../geometry/leafletGeometry';
import type { LayerMutationEvent } from '../../models/LayerMutation';
import type { ClipboardEntry, SelectedMarker } from '../../stores/selectionStore';

export interface SelectionCommandContext {
    selected: SelectedMarker[];
    clipboard: ClipboardEntry[];
    layers: IMapLayer[];
    visibleLayerIds: Set<string>;
    setVisibleLayerIds: (ids: Set<string>) => void;
    copyToClipboard: (entries: ClipboardEntry[]) => void;
    deactivateSelection: () => void;
    markLayerUpdated: (mutation?: LayerMutationEvent) => void;
}

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

export function deleteSelection(context: SelectionCommandContext): void {
    if (context.selected.length === 0) {
        return;
    }

    const deletedPointsByLayer = new Map<string, unknown[]>();
    const otherMutations: Array<{
        kind: LayerMutationEvent['kind'];
        layerId: string;
        payload: unknown;
    }> = [];
    const selectedByMarker = selectedLatLngsByMarker(context.selected);
    const seen = new Set<object>();

    for (const { layerId, marker } of context.selected) {
        if (seen.has(marker as object)) {
            continue;
        }
        seen.add(marker as object);

        const layer = context.layers.find((item) => item.id === layerId);
        const geoJsonLayer = layer?.getLayer();
        if (!layer || !geoJsonLayer) {
            continue;
        }

        const featureMarker = marker as L.Layer & {
            getLatLng?: () => L.LatLng;
            getLatLngs?: () => L.LatLng[];
            setLatLngs?: (latLngs: L.LatLng[]) => void;
            toGeoJSON?: () => unknown;
        };
        const pointMarker = typeof featureMarker.getLatLng === 'function';

        if (pointMarker || layer.kind !== 'polyline') {
            const feature = featureMarker.toGeoJSON?.();
            geoJsonLayer.removeLayer(marker);

            if (pointMarker) {
                const points = deletedPointsByLayer.get(layerId) ?? [];
                points.push(feature);
                deletedPointsByLayer.set(layerId, points);
            } else {
                otherMutations.push({
                    kind: 'polygon-batch-delete',
                    layerId,
                    payload: { before: feature }
                });
            }
            continue;
        }

        const currentLatLngs = featureMarker.getLatLngs?.();
        if (!currentLatLngs) {
            geoJsonLayer.removeLayer(marker);
            continue;
        }

        const selectedRefs = selectedByMarker.get(marker as object) ?? new Set<L.LatLng>();
        const beforeCoordinates = currentLatLngs.map((latLng) => [latLng.lng, latLng.lat]);
        const remaining = currentLatLngs.filter((latLng) => !selectedRefs.has(latLng));

        if (remaining.length < 2) {
            geoJsonLayer.removeLayer(marker);
            otherMutations.push({
                kind: 'polyline-delete',
                layerId,
                payload: { before: featureMarker.toGeoJSON?.() }
            });
        } else {
            featureMarker.setLatLngs?.(remaining);
            otherMutations.push({
                kind: 'polyline-vertices-delete',
                layerId,
                payload: {
                    historyId: getFeatureHistoryId(marker),
                    beforeCoordinates,
                    afterCoordinates: remaining.map((latLng) => [latLng.lng, latLng.lat])
                }
            });
        }
    }

    const pointLayerEntries = [...deletedPointsByLayer.entries()];
    if (otherMutations.length === 0 && pointLayerEntries.length === 1) {
        const [layerId, points] = pointLayerEntries[0];
        context.markLayerUpdated({
            kind: 'point-batch-delete',
            layerId,
            payload: { points }
        });
    } else if (pointLayerEntries.length === 0 && otherMutations.length === 1) {
        context.markLayerUpdated(otherMutations[0]);
    } else {
        context.markLayerUpdated();
    }

    context.deactivateSelection();
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
