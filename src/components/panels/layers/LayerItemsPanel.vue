<script setup lang="ts">
import type { ImportedGeoJsonLayer } from '../../../models/ImportedGeoJsonLayer';
import { useImportedLayerItems } from '../../../composables/layers/useImportedLayerItems';
import VisibilityButton from '../../shared/VisibilityButton.vue';

const props = defineProps<{
    layer: ImportedGeoJsonLayer;
    readOnly: boolean;
}>();
const emit = defineEmits<{
    rename: [id: string, name: string];
    showLayer: [id: string];
}>();
const {
    query,
    namedItems,
    filteredItems,
    soloIndex,
    allHidden,
    isVisible,
    cycleVisibility,
    toggleAll
} = useImportedLayerItems(() => props.layer);

function renameLayer(event: Event) {
    const input = event.target as HTMLInputElement;
    emit('rename', props.layer.id, input.value);
    input.value = props.layer.name;
}
</script>

<template>
    <div id="layer-items-panel" class="space-y-4">
        <div v-if="!readOnly">
            <label for="layer-details-name" class="mb-1 block text-xs font-medium text-gray-600">
                Layer name
            </label>
            <input
                id="layer-details-name"
                :value="layer.name"
                :aria-label="`Rename ${layer.name}`"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                @change="renameLayer"
            />
        </div>
        <div
            v-if="layer.visible === false"
            class="rounded-lg bg-slate-50 p-3 text-sm text-gray-600"
        >
            <p>This layer is hidden. Show it to see its items on the map.</p>
            <button
                type="button"
                class="mt-2 rounded font-medium text-green-700 focus-visible:outline-2 focus-visible:outline-green-700"
                :aria-label="`Show layer ${layer.name}`"
                @click="emit('showLayer', layer.id)"
            >
                Show layer
            </button>
        </div>
        <div>
            <label for="layer-items-search" class="mb-1 block text-xs font-medium text-gray-600">
                Search by name
            </label>
            <input
                id="layer-items-search"
                v-model="query"
                type="search"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
        </div>
        <div v-if="namedItems.length > 0" class="flex items-center justify-between gap-2">
            <span class="text-xs text-gray-500"
                >{{ filteredItems.length }} of {{ namedItems.length }} named items</span
            >
            <button
                type="button"
                class="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-green-700"
                @click="toggleAll"
            >
                {{ allHidden || soloIndex !== null ? 'Show all items' : 'Hide all items' }}
            </button>
        </div>
        <p v-if="!layer.nameProperty" class="text-sm text-gray-600">
            No name property was selected for this layer. Only named items can be listed here.
        </p>
        <p v-else-if="namedItems.length === 0" class="text-sm text-gray-600">
            This layer has no named items.
        </p>
        <p v-else-if="filteredItems.length === 0" class="text-sm text-gray-600">
            No items match your search.
        </p>
        <ul v-else id="layer-items-list" class="divide-y divide-gray-100">
            <li
                v-for="item in filteredItems"
                :key="item.index"
                :data-feature-index="item.index"
                class="flex items-center gap-2 py-2"
            >
                <span
                    :class="[
                        'min-w-0 flex-1 break-words text-sm',
                        isVisible(item.index) ? 'text-gray-800' : 'text-gray-400 line-through'
                    ]"
                    >{{ item.name }}</span
                >
                <VisibilityButton
                    :hidden="!isVisible(item.index)"
                    :solo="soloIndex === item.index"
                    :action-label="
                        soloIndex !== null
                            ? 'Show all items'
                            : isVisible(item.index)
                              ? `Hide item ${item.name}`
                              : `Show only item ${item.name}`
                    "
                    :state-text="
                        soloIndex === item.index
                            ? 'Showing only this item'
                            : isVisible(item.index)
                              ? 'Visible'
                              : 'Hidden'
                    "
                    @toggle="cycleVisibility(item.index)"
                />
            </li>
        </ul>
    </div>
</template>
