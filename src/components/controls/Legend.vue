<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';

const mapStore = useMapStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();

const isCollapsed = ref(false);
const isImageExport = computed(() => uiStore.imageExportInProgress);

const activeLayers = computed(() =>
    mapStore.layers.filter(
        (l) =>
            settingsStore.activeLayers.includes(l.id) &&
            (uiStore.legendLayerIds === null || uiStore.legendLayerIds.has(l.id)) &&
            (!isImageExport.value || uiStore.imageExportLegendLayerIds?.has(l.id))
    )
);

function toggleCollapse() {
    isCollapsed.value = !isCollapsed.value;
}
</script>

<template>
    <div
        v-if="!isImageExport || activeLayers.length > 0"
        class="legend rounded-2xl bg-white/94 shadow-xl border border-white/60 w-36 sm:w-52 overflow-hidden"
        :class="{
            collapsed: !isImageExport && isCollapsed,
            'image-export-legend w-max': isImageExport
        }"
        :style="
            isImageExport
                ? {
                      width: 'max-content',
                      maxWidth: 'calc(var(--image-export-width, 100vw) - 16px)'
                  }
                : undefined
        "
        :data-image-export-legend="isImageExport ? '' : undefined"
    >
        <div v-if="isImageExport" class="px-4 py-2 border-b border-gray-100">
            <h4 class="legend-title m-0 text-sm font-semibold text-gray-700 leading-none">
                Legend
            </h4>
        </div>
        <div
            v-else
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
        <div
            class="legend-content"
            :class="{ 'border-t border-gray-100': !isImageExport, hidden: isCollapsed }"
        >
            <ul class="px-2 sm:px-3 pt-1 pb-1 space-y-0 m-0">
                <li
                    v-for="layer in activeLayers"
                    :key="layer.id"
                    :id="`${layer.id}-legend`"
                    :title="
                        isImageExport
                            ? undefined
                            : `Toggle ${layer.title.toLowerCase()} from the map`
                    "
                    :role="isImageExport ? undefined : 'button'"
                    :tabindex="isImageExport ? undefined : 0"
                    :aria-pressed="
                        isImageExport ? undefined : mapStore.visibleLayerIds.has(layer.id)
                    "
                    class="flex items-center gap-2 px-1 sm:px-2 py-1 rounded-lg"
                    :class="{
                        'cursor-pointer hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600':
                            !isImageExport,
                        disabled: !mapStore.visibleLayerIds.has(layer.id),
                        'opacity-40 bg-gray-50':
                            !isImageExport && !mapStore.visibleLayerIds.has(layer.id)
                    }"
                    @click="!isImageExport && mapStore.toggleLayerVisibility(layer.id)"
                    @keydown.enter.prevent="
                        !isImageExport && mapStore.toggleLayerVisibility(layer.id)
                    "
                    @keydown.space.prevent="
                        !isImageExport && mapStore.toggleLayerVisibility(layer.id)
                    "
                >
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <span
                        class="legend-icon shrink-0"
                        :class="`legend-icon--${layer.kind}`"
                        v-html="layer.iconHtml"
                    ></span>
                    <span
                        class="text-sm text-gray-700"
                        :class="{
                            truncate: !isImageExport,
                            'whitespace-normal wrap-break-word': isImageExport
                        }"
                        >{{ layer.title }}</span
                    >
                </li>
            </ul>
            <p v-if="!isImageExport" class="text-xs text-gray-400 px-3 sm:px-5 pb-2 mt-0">
                Click item to toggle visibility
            </p>
        </div>
    </div>
</template>
