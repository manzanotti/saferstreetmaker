import { defineStore } from 'pinia';
import { shallowRef, ref } from 'vue';
import type * as L from 'leaflet';
import type { IMapLayer } from '../scripts/layers/IMapLayer';

export const useMapStore = defineStore('map', () => {
  /** The Leaflet map instance. shallowRef prevents Vue wrapping Leaflet internals. */
  const map = shallowRef<L.Map | null>(null);

  /** All registered layer instances. */
  const layers = shallowRef<IMapLayer[]>([]);

  /** ID of the currently active (drawing) layer, or null when none selected. */
  const activeLayerId = ref<string | null>(null);

  /** IDs of layers currently shown on the map. */
  const visibleLayerIds = ref<Set<string>>(new Set());

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

  function markLayerUpdated() {
    // Placeholder called by layer composables (Phase 3) in place of
    // PubSub.publish(EventTopics.layerUpdated). MapManager listens via
    // watch() in Phase 2, and directly in Phase 3.
  }

  return {
    map,
    layers,
    activeLayerId,
    visibleLayerIds,
    setMap,
    setLayers,
    setActiveLayer,
    toggleLayerVisibility,
    markLayerUpdated,
  };
});
