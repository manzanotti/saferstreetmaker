<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { useSettingsStore } from '../../stores/settingsStore';

const mapStore = useMapStore();
const settingsStore = useSettingsStore();

const isCollapsed = ref(false);

const activeLayers = computed(() =>
  mapStore.layers.filter((l) => settingsStore.activeLayers.includes(l.id)),
);

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}
</script>

<template>
  <div class="legend" :class="{ collapsed: isCollapsed }">
    <h4 class="legend-title" @click="toggleCollapse">Legend</h4>
    <div class="legend-content" :class="{ hidden: isCollapsed }">
      <ul>
        <li
          v-for="layer in activeLayers"
          :key="layer.id"
          :id="`${layer.id}-legend`"
          :title="`Toggle ${layer.title.toLowerCase()} from the map`"
          :class="{ disabled: !mapStore.visibleLayerIds.has(layer.id) }"
          @click="mapStore.toggleLayerVisibility(layer.id)"
        >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span v-html="layer.iconHtml"></span>
          <span>{{ layer.title }}</span>
        </li>
      </ul>
      <div>Click item to toggle visibility</div>
    </div>
  </div>
</template>
