import type * as L from 'leaflet';
import { getPolylineLatLngs } from '../../geometry/leafletGeometry';
import type { ClipboardEntry, SelectedMarker } from '../../stores/selectionStore';
import type { SelectionCommandContext } from './selectionCommands';
import { buildClipboardFeature, selectedLatLngsByMarker } from './selectionClipboardHelpers';

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
