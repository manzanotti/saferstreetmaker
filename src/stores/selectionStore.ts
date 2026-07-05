import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type * as L from 'leaflet';

export interface SelectedMarker {
    layerId: string;
    historyId: string | null;
    latLng: L.LatLng;
    marker: L.Layer;
}

export const useSelectionStore = defineStore('selection', () => {
    const isActive = ref(false);
    // shallowRef: Leaflet Layer objects must not be wrapped in Vue Proxy.
    const selected = shallowRef<SelectedMarker[]>([]);

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

    return { isActive, selected, activate, deactivate, setSelected, clear };
});
