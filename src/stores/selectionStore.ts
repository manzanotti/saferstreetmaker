import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import type * as L from 'leaflet';

export interface SelectedMarker {
    layerId: string;
    historyId: string | null;
    latLng: L.LatLng;
    marker: L.Layer;
}

/** A single GeoJSON feature held in the copy clipboard. */
export interface ClipboardEntry {
    layerId: string;
    // Plain GeoJSON — no Leaflet objects, so a regular ref is fine here.
    feature: GeoJSON.Feature;
}

function selectedMarkerLatLngKey(marker: SelectedMarker): string {
    return `${marker.latLng.lat}:${marker.latLng.lng}`;
}

function selectedFeatureKey(marker: SelectedMarker): string | null {
    return marker.historyId ? `${marker.layerId}:${marker.historyId}` : null;
}

export const useSelectionStore = defineStore('selection', () => {
    const isActive = ref(false);
    const isGroupSelection = ref(false);
    const isPhaseEditing = ref(false);
    const selectedGroupId = ref<string | null>(null);
    // shallowRef: Leaflet Layer objects must not be wrapped in Vue Proxy.
    const selected = shallowRef<SelectedMarker[]>([]);
    const clipboard = ref<ClipboardEntry[]>([]);
    const hasClipboard = computed(() => clipboard.value.length > 0);

    // Bounds of the most recent rubber-band area-selection drag. Used when
    // splitting a partially-selected polyline so the new line can be clipped
    // to the selection rectangle. shallowRef: Leaflet object, no Proxy.
    const lastAreaBounds = shallowRef<L.LatLngBounds | null>(null);

    function activate() {
        isActive.value = true;
    }

    function deactivate() {
        isActive.value = false;
        selected.value = [];
        lastAreaBounds.value = null;
        isGroupSelection.value = false;
        isPhaseEditing.value = false;
        selectedGroupId.value = null;
    }

    function setSelected(markers: SelectedMarker[]) {
        selected.value = markers;
        isGroupSelection.value = false;
        isPhaseEditing.value = false;
        selectedGroupId.value = null;
    }

    function clear() {
        selected.value = [];
        lastAreaBounds.value = null;
        isGroupSelection.value = false;
        selectedGroupId.value = null;
    }

    function markGroupSelection(groupId: string) {
        isGroupSelection.value = true;
        selectedGroupId.value = groupId;
    }

    function setPhaseEditing(editing: boolean) {
        isPhaseEditing.value = editing;
    }

    function setLastAreaBounds(bounds: L.LatLngBounds | null) {
        lastAreaBounds.value = bounds;
    }

    /**
     * Append entries to the current selection, de-duping at marker + LatLng
     * granularity so additive polyline selection can extend an already-
     * selected feature vertex-by-vertex without duplicating rows.
     *
     * Returns only the entries that were actually appended. Callers can use
     * that subset for additive highlight updates.
     */
    function mergeSelected(markers: SelectedMarker[]): SelectedMarker[] {
        const selectedLatLngsByMarker = new Map<object, Set<string>>();

        for (const marker of selected.value) {
            const markerKey = marker.marker as object;
            let latLngs = selectedLatLngsByMarker.get(markerKey);
            if (!latLngs) {
                latLngs = new Set<string>();
                selectedLatLngsByMarker.set(markerKey, latLngs);
            }
            latLngs.add(selectedMarkerLatLngKey(marker));
        }

        const toAdd: SelectedMarker[] = [];

        for (const marker of markers) {
            const markerKey = marker.marker as object;
            const latLngKey = selectedMarkerLatLngKey(marker);
            let latLngs = selectedLatLngsByMarker.get(markerKey);

            if (!latLngs) {
                latLngs = new Set<string>();
                selectedLatLngsByMarker.set(markerKey, latLngs);
            }

            if (!latLngs.has(latLngKey)) {
                toAdd.push(marker);
                latLngs.add(latLngKey);
            }
        }

        if (toAdd.length > 0) {
            selected.value = [...selected.value, ...toAdd];
        }

        return toAdd;
    }

    function removeSelectedFeature(marker: L.Layer, feature?: SelectedMarker): SelectedMarker[] {
        const markerEntries = selected.value.filter((entry) => entry.marker === marker);
        const featureKey = feature ? selectedFeatureKey(feature) : null;
        const removed =
            featureKey !== null
                ? selected.value.filter(
                      (entry) =>
                          selectedFeatureKey(entry) !== null &&
                          selectedFeatureKey(entry) === featureKey
                  )
                : markerEntries;
        if (removed.length > 0) {
            selected.value =
                featureKey !== null
                    ? selected.value.filter((entry) => selectedFeatureKey(entry) !== featureKey)
                    : selected.value.filter((entry) => entry.marker !== marker);
        }
        return removed;
    }

    function isFeatureFullySelected(markers: SelectedMarker[]): boolean {
        return (
            markers.length > 0 &&
            markers.every((marker) =>
                selected.value.some(
                    (entry) =>
                        selectedFeatureKey(entry) === selectedFeatureKey(marker) &&
                        selectedMarkerLatLngKey(entry) === selectedMarkerLatLngKey(marker)
                )
            )
        );
    }

    function copyToClipboard(entries: ClipboardEntry[]) {
        clipboard.value = entries;
    }

    return {
        isActive,
        isGroupSelection,
        isPhaseEditing,
        selectedGroupId,
        selected,
        clipboard,
        hasClipboard,
        lastAreaBounds,
        activate,
        deactivate,
        setSelected,
        clear,
        markGroupSelection,
        setPhaseEditing,
        setLastAreaBounds,
        mergeSelected,
        removeSelectedFeature,
        isFeatureFullySelected,
        copyToClipboard
    };
});
