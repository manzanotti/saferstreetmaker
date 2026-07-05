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

export const useSelectionStore = defineStore('selection', () => {
    const isActive = ref(false);
    // shallowRef: Leaflet Layer objects must not be wrapped in Vue Proxy.
    const selected = shallowRef<SelectedMarker[]>([]);
    const clipboard = ref<ClipboardEntry[]>([]);
    const hasClipboard = computed(() => clipboard.value.length > 0);

    function activate() {
        isActive.value = true;
    }

    function deactivate() {
        isActive.value = false;
        selected.value = [];
    }

    function setSelected(markers: SelectedMarker[]) {
        selected.value = markers;
    }

    function clear() {
        selected.value = [];
    }

    function copyToClipboard(entries: ClipboardEntry[]) {
        clipboard.value = entries;
    }

    return {
        isActive,
        selected,
        clipboard,
        hasClipboard,
        activate,
        deactivate,
        setSelected,
        clear,
        copyToClipboard
    };
});
