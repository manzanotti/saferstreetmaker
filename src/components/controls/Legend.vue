<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { useSettingsStore } from '../../stores/settingsStore';

const mapStore = useMapStore();
const settingsStore = useSettingsStore();

const isCollapsed = ref(false);

const activeLayers = computed(() =>
    mapStore.layers.filter((l) => settingsStore.activeLayers.includes(l.id))
);

function toggleCollapse() {
    isCollapsed.value = !isCollapsed.value;
}
</script>

<template>
    <div
        class="legend rounded-2xl bg-white/[0.94] shadow-xl border border-white/60 w-52 overflow-hidden"
        :class="{ collapsed: isCollapsed }"
    >
        <div
            role="button"
            tabindex="0"
            :aria-expanded="!isCollapsed"
            class="flex items-center justify-between px-4 py-2 cursor-pointer select-none hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600"
            @click="toggleCollapse"
            @keydown.enter.prevent="toggleCollapse"
            @keydown.space.prevent="toggleCollapse"
        >
            <h4 class="legend-title m-0 text-sm font-semibold text-gray-700 leading-none">
                Legend
            </h4>
            <span aria-hidden="true" class="text-xs font-normal text-gray-400">{{
                isCollapsed ? '\u25b8' : '\u25be'
            }}</span>
        </div>
        <div class="legend-content border-t border-gray-100" :class="{ hidden: isCollapsed }">
            <ul class="px-3 pt-1 pb-1 space-y-0 m-0">
                <li
                    v-for="layer in activeLayers"
                    :key="layer.id"
                    :id="`${layer.id}-legend`"
                    :title="`Toggle ${layer.title.toLowerCase()} from the map`"
                    role="button"
                    tabindex="0"
                    :aria-pressed="mapStore.visibleLayerIds.has(layer.id)"
                    class="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600"
                    :class="{
                        disabled: !mapStore.visibleLayerIds.has(layer.id),
                        'opacity-40 bg-gray-50': !mapStore.visibleLayerIds.has(layer.id)
                    }"
                    @click="mapStore.toggleLayerVisibility(layer.id)"
                    @keydown.enter.prevent="mapStore.toggleLayerVisibility(layer.id)"
                    @keydown.space.prevent="mapStore.toggleLayerVisibility(layer.id)"
                >
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <span class="shrink-0" v-html="layer.iconHtml"></span>
                    <span class="text-sm text-gray-700 truncate">{{ layer.title }}</span>
                </li>
            </ul>
            <p class="text-xs text-gray-400 px-5 pb-2 mt-0">Click item to toggle visibility</p>
        </div>
    </div>
</template>
