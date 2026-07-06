import { defineStore } from 'pinia';
import { shallowRef, ref } from 'vue';
import type * as L from 'leaflet';
import type { IMapLayer } from '../composables/layers/IMapLayer';

export interface LayerMutationEvent {
    kind:
        | 'point-add'
        | 'point-delete'
        | 'point-batch-delete'
        | 'polyline-vertices-delete'
        | 'polygon-batch-delete'
        | 'polyline-add'
        | 'polyline-delete'
        | 'polyline-edit'
        | 'polygon-add'
        | 'polygon-delete'
        | 'polygon-edit';
    layerId: string;
    payload?: unknown;
}

export const useMapStore = defineStore('map', () => {
    /** The Leaflet map instance. shallowRef prevents Vue wrapping Leaflet internals. */
    const map = shallowRef<L.Map | null>(null);

    /** All registered layer instances. */
    const layers = shallowRef<IMapLayer[]>([]);

    /** ID of the currently active (drawing) layer, or null when none selected. */
    const activeLayerId = ref<string | null>(null);

    /**
     * ID of the layer the user has explicitly activated via the toolbar for
     * drawing new features.  This is the ONLY value that drives the toolbar
     * button aria-pressed state.
     *
     * It differs from activeLayerId: selectForEdit() sets activeLayerId so the
     * layer can manage its own cursor / event-handler state, but does NOT set
     * drawLayerId — clicking an existing feature to edit it should not put the
     * toolbar button into "draw mode".
     */
    const drawLayerId = ref<string | null>(null);

    /** IDs of layers currently shown on the map.
     *
     * Note: Vue cannot track mutations on a Set (e.g. `.add()` / `.delete()`).
     * Always replace the entire ref value with a new Set to trigger reactivity:
     *   mapStore.visibleLayerIds = new Set(...)   ✓
     *   mapStore.visibleLayerIds.add(id)          ✗ — not reactive
     */
    const visibleLayerIds = ref<Set<string>>(new Set());

    /**
     * Monotonically incremented whenever any layer's data changes.
     * useMapManager watches this to trigger debounced saves.
     */
    const layerUpdateCount = ref(0);
    const lastLayerMutation = shallowRef<LayerMutationEvent | null>(null);

    function setMap(instance: L.Map) {
        map.value = instance;
    }

    function setLayers(newLayers: IMapLayer[]) {
        layers.value = newLayers;
        visibleLayerIds.value = new Set(newLayers.map((l) => l.id));
    }

    function setActiveLayer(id: string | null) {
        activeLayerId.value = id;
    }

    /**
     * Set both the draw layer (toolbar button visual) and the active layer
     * (internal layer coordination) to the same id.  Use when the user
     * explicitly selects a layer via the toolbar to start drawing, or when
     * Escape / Cancel needs to clear both states at once.
     */
    function setDrawLayer(id: string | null) {
        drawLayerId.value = id;
        activeLayerId.value = id;
    }

    function toggleLayerVisibility(id: string) {
        const next = new Set(visibleLayerIds.value);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        visibleLayerIds.value = next;
    }

    /** Called by layer composables whenever map data changes (replaces PubSub layerUpdated). */
    function markLayerUpdated(mutation?: LayerMutationEvent) {
        lastLayerMutation.value = mutation ?? null;
        layerUpdateCount.value++;
    }

    function clearLastLayerMutation() {
        lastLayerMutation.value = null;
    }

    /** Build a Map<id, layer> from the current layers array — used by FileManager. */
    function toLayers(): Map<string, IMapLayer> {
        const m = new Map<string, IMapLayer>();
        layers.value.forEach((l) => m.set(l.id, l));
        return m;
    }

    return {
        map,
        layers,
        activeLayerId,
        drawLayerId,
        visibleLayerIds,
        layerUpdateCount,
        lastLayerMutation,
        setMap,
        setLayers,
        setActiveLayer,
        setDrawLayer,
        toggleLayerVisibility,
        markLayerUpdated,
        clearLastLayerMutation,
        toLayers
    };
});
