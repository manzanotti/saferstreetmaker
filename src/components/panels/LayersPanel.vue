<script setup lang="ts">
import { ref } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { useImportedLayerStore } from '../../stores/importedLayerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import ImportedLayersSection from './ImportedLayersSection.vue';
import AddGeoJsonLayerDialog from './AddGeoJsonLayerDialog.vue';

const mapStore = useMapStore();
const importedLayerStore = useImportedLayerStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const showAddLayerDialog = ref(false);

function onAddLayer(layer: Parameters<typeof importedLayerStore.addLayer>[0]) {
    importedLayerStore.addLayer(layer);
    mapStore.markLayerUpdated();
    showAddLayerDialog.value = false;
}

function onDeleteLayer(id: string) {
    importedLayerStore.deleteLayer(id);
    mapStore.markLayerUpdated();
}

function onToggleLayerVisibility(id: string) {
    importedLayerStore.toggleVisibility(id);
    mapStore.markLayerUpdated();
}

function onRenameLayer(id: string, name: string) {
    const trimmedName = name.trim();
    if (
        !trimmedName ||
        importedLayerStore.layers.some((layer) => layer.id !== id && layer.name === trimmedName)
    ) {
        return;
    }
    importedLayerStore.renameLayer(id, trimmedName);
    mapStore.markLayerUpdated();
}
</script>

<template>
    <div
        id="layers-panel"
        class="fixed top-1/2 left-1/2 z-[10001] flex max-h-[90vh] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
        role="dialog"
        aria-labelledby="layers-panel-title"
    >
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 id="layers-panel-title" class="text-base font-semibold text-gray-800">Layers</h2>
            <button
                type="button"
                aria-label="Close layers"
                class="rounded text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                @click="uiStore.closePanel()"
            >
                <span aria-hidden="true" class="text-xl leading-none">&times;</span>
            </button>
        </div>
        <div class="overflow-y-auto px-5 py-4">
            <ImportedLayersSection
                :layers="importedLayerStore.layers"
                :read-only="settingsStore.readOnly"
                @add="showAddLayerDialog = true"
                @delete="onDeleteLayer"
                @toggle-visibility="onToggleLayerVisibility"
                @rename="onRenameLayer"
            />
        </div>
    </div>
    <AddGeoJsonLayerDialog
        v-if="showAddLayerDialog"
        :existing-names="importedLayerStore.layers.map((layer) => layer.name)"
        @add="onAddLayer"
        @cancel="showAddLayerDialog = false"
    />
</template>
