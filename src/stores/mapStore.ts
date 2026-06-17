import { defineStore } from 'pinia';
import { shallowRef, ref } from 'vue';
import type * as L from 'leaflet';
import type { IMapLayer } from '../composables/layers/IMapLayer';

export const useMapStore = defineStore('map', () => {
  /** The Leaflet map instance. shallowRef prevents Vue wrapping Leaflet internals. */
  const map = shallowRef<L.Map | null>(null);

  /** All registered layer instances. */
  const layers = shallowRef<IMapLayer[]>([]);

  /** ID of the currently active (drawing) layer, or null when none selected. */
  const activeLayerId = ref<string | null>(null);

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
  function markLayerUpdated() {
    layerUpdateCount.value++;
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
    visibleLayerIds,
    layerUpdateCount,
    setMap,
    setLayers,
    setActiveLayer,
    toggleLayerVisibility,
    markLayerUpdated,
    toLayers,
  };
});
