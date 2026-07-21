import type * as L from 'leaflet';
import type { IMapLayer } from '../../composables/layers/IMapLayer';
import { getPolylineLatLngs } from '../../geometry/leafletGeometry';
import type { GroupMember, PartialPolylineSplit } from '../../models/Group';
import type { SelectedMarker } from '../../stores/selectionStore';

export interface SelectionMembership {
    fullMembers: GroupMember[];
    partialSplits: PartialPolylineSplit[];
}

export function analyzeSelectionMembership(
    selected: SelectedMarker[],
    layers: IMapLayer[],
    clipBounds: L.LatLngBounds | null
): SelectionMembership | null {
    if (selected.length === 0) {
        return null;
    }

    const entriesByMarker = new Map<object, SelectedMarker[]>();
    for (const entry of selected) {
        const markerEntries = entriesByMarker.get(entry.marker as object) ?? [];
        markerEntries.push(entry);
        entriesByMarker.set(entry.marker as object, markerEntries);
    }

    const fullMembers: GroupMember[] = [];
    const partialSplits: PartialPolylineSplit[] = [];

    for (const entries of entriesByMarker.values()) {
        const first = entries[0];
        if (!first.historyId) {
            continue;
        }

        const layer = layers.find((item) => item.id === first.layerId);
        if (layer?.kind !== 'polyline') {
            fullMembers.push({ layerId: first.layerId, historyId: first.historyId });
            continue;
        }

        const allLatLngs = getPolylineLatLngs(first.marker);
        const selectedLatLngs = entries.map((entry) => entry.latLng);
        if (selectedLatLngs.length === allLatLngs.length) {
            fullMembers.push({ layerId: first.layerId, historyId: first.historyId });
            continue;
        }

        partialSplits.push({
            layerId: first.layerId,
            layerTitle: layer.title,
            marker: first.marker,
            selectedLatLngs,
            allLatLngs,
            clipBounds
        });
    }

    return { fullMembers, partialSplits };
}
