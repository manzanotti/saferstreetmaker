<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { useImportedLayerStore } from '../../stores/importedLayerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import ImportedLayersSection from './ImportedLayersSection.vue';
import AddGeoJsonLayerDialog from './AddGeoJsonLayerDialog.vue';
import LayerItemsPanel from './layers/LayerItemsPanel.vue';

const mapStore = useMapStore();
const importedLayerStore = useImportedLayerStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const showAddLayerDialog = ref(false);
const dialog = ref<HTMLDivElement | null>(null);
const opener = ref<HTMLElement | null>(null);
const selectedLayerId = ref<string | null>(null);
const selectedLayer = computed(() =>
    importedLayerStore.layers.find((layer) => layer.id === selectedLayerId.value)
);
let layerOpener: HTMLElement | null = null;

function openLayer(id: string) {
    layerOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    selectedLayerId.value = id;
    void nextTick(() => document.getElementById('layer-items-search')?.focus());
}

function backToLayers() {
    const id = selectedLayerId.value;
    selectedLayerId.value = null;
    void nextTick(() => {
        const row = Array.from(
            dialog.value?.querySelectorAll<HTMLElement>('[data-layer-id]') ?? []
        ).find((element) => element.dataset.layerId === id);
        (row ?? layerOpener ?? dialog.value)?.focus();
    });
}

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

function closePanel() {
    uiStore.closePanel();
}

function onDialogKeydown(event: KeyboardEvent) {
    if (event.target instanceof Element && event.target.closest('#add-layer-dialog')) {
        return;
    }
    const target = event.target;
    const isEditableTarget =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable);
    if (
        !isEditableTarget &&
        event.key.toLowerCase() === 'l' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
    ) {
        event.preventDefault();
        closePanel();
        return;
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (selectedLayer.value) {
            backToLayers();
        } else {
            closePanel();
        }
        return;
    }
    if (event.key !== 'Tab' || !dialog.value) {
        return;
    }

    const focusable = Array.from(
        dialog.value.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
    ).filter((element) => !element.hasAttribute('disabled'));
    if (focusable.length === 0) {
        event.preventDefault();
        dialog.value.focus();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

onMounted(() => {
    opener.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void nextTick(() => dialog.value?.focus());
});

onBeforeUnmount(() => {
    const target = document.getElementById('layers-button') ?? opener.value;
    if (target?.isConnected) {
        target.focus();
    }
});
</script>

<template>
    <div
        ref="dialog"
        id="layers-panel"
        class="fixed top-1/2 left-1/2 z-[10001] flex max-h-[90vh] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
        role="dialog"
        :aria-modal="showAddLayerDialog ? undefined : 'true'"
        :aria-hidden="showAddLayerDialog ? 'true' : undefined"
        :inert="showAddLayerDialog"
        aria-labelledby="layers-panel-title"
        tabindex="-1"
        @keydown="onDialogKeydown"
    >
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div class="min-w-0">
                <button
                    v-if="selectedLayer"
                    type="button"
                    class="mb-1 rounded text-xs font-medium text-green-700 focus-visible:outline-2 focus-visible:outline-green-700"
                    @click="backToLayers"
                >
                    Back to layers
                </button>
                <h2
                    id="layers-panel-title"
                    class="break-words text-base font-semibold text-gray-800"
                >
                    {{ selectedLayer ? selectedLayer.name : 'Layers' }}
                </h2>
            </div>
            <button
                type="button"
                aria-label="Close layers"
                class="rounded text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                @click="closePanel"
            >
                <span aria-hidden="true" class="text-xl leading-none">&times;</span>
            </button>
        </div>
        <div class="overflow-y-auto px-5 py-4">
            <LayerItemsPanel
                v-if="selectedLayer"
                :key="selectedLayer.id"
                :layer="selectedLayer"
                :read-only="settingsStore.readOnly"
                @rename="onRenameLayer"
                @show-layer="onToggleLayerVisibility"
            />
            <ImportedLayersSection
                v-else
                :layers="importedLayerStore.layers"
                :read-only="settingsStore.readOnly"
                @add="showAddLayerDialog = true"
                @delete="onDeleteLayer"
                @toggle-visibility="onToggleLayerVisibility"
                @open="openLayer"
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
