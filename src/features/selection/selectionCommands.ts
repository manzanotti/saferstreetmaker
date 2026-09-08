import type * as L from 'leaflet';
import type { IMapLayer } from '../../composables/layers/IMapLayer';
import { getFeatureHistoryId } from '../../composables/layers/layerUtils';
import type { LayerMutationEvent } from '../../models/LayerMutation';
import type { ClipboardEntry, SelectedMarker } from '../../stores/selectionStore';
import { selectedLatLngsByMarker } from './selectionClipboardHelpers';

export { copySelection, pasteSelection } from './selectionClipboard';

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
