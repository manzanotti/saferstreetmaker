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

export const useSelectionStore = defineStore('selection', () => {
    const isActive = ref(false);
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
    }

    function setSelected(markers: SelectedMarker[]) {
        selected.value = markers;
    }

    function clear() {
        selected.value = [];
        lastAreaBounds.value = null;
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

    function copyToClipboard(entries: ClipboardEntry[]) {
        clipboard.value = entries;
    }

    return {
        isActive,
        selected,
        clipboard,
        hasClipboard,
        lastAreaBounds,
        activate,
        deactivate,
        setSelected,
        clear,
        setLastAreaBounds,
        mergeSelected,
        copyToClipboard
    };
});
