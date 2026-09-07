<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';
import { useGeoJsonLayerImport } from '../../composables/useGeoJsonLayerImport';
import AddGeoJsonDialogFooter from './AddGeoJsonDialogFooter.vue';
import AddGeoJsonLayerDetails from './AddGeoJsonLayerDetails.vue';
import AddGeoJsonSourceSelector from './AddGeoJsonSourceSelector.vue';

const props = defineProps<{
    existingNames: string[];
}>();

const emit = defineEmits<{
    add: [layer: ImportedGeoJsonLayer];
    cancel: [];
}>();

type SourceSelector = InstanceType<typeof AddGeoJsonSourceSelector>;

const dialog = ref<HTMLDivElement | null>(null);
const opener = ref<HTMLElement | null>(null);
const sourceSelector = ref<SourceSelector | null>(null);
const {
    source,
    url,
    layerName,
    nameProperty,
    parsedGeoJson,
    propertyPreview,
    namePropertyOptions,
    error,
    loading,
    buildLayer,
    loadFile,
    loadFromUrl
} = useGeoJsonLayerImport(() => props.existingNames);

function addLayer() {
    const layer = buildLayer();
    if (layer) {
        emit('add', layer);
    }
}

function close() {
    emit('cancel');
}

function onDialogKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        event.preventDefault();
        close();
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
    void nextTick(() => sourceSelector.value?.focusDropZone());
});

onBeforeUnmount(() => {
    if (opener.value?.isConnected) {
        opener.value.focus();
    }
});
</script>

<template>
    <div
        id="add-layer-overlay"
        class="fixed inset-0 z-[10003] flex items-center justify-center bg-black/20 px-4"
        @click.self="close"
    >
        <div
            ref="dialog"
            id="add-layer-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-layer-dialog-title"
            class="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl border border-gray-100"
            tabindex="-1"
            @keydown="onDialogKeydown"
        >
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 id="add-layer-dialog-title" class="text-base font-semibold text-gray-800">
                    Add layer
                </h2>
                <button
                    type="button"
                    class="text-gray-500 hover:text-gray-800 text-xl"
                    aria-label="Close"
                    @click="close"
                >
                    &times;
                </button>
            </div>
            <div class="px-5 py-4 space-y-4">
                <AddGeoJsonSourceSelector
                    ref="sourceSelector"
                    v-model:source="source"
                    v-model:url="url"
                    :loading="loading"
                    @file-selected="loadFile"
                    @load-url="loadFromUrl"
                />

                <AddGeoJsonLayerDetails
                    v-if="parsedGeoJson"
                    v-model:layer-name="layerName"
                    v-model:name-property="nameProperty"
                    :name-property-options="namePropertyOptions"
                    :property-preview="propertyPreview"
                />
                <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
            </div>
            <AddGeoJsonDialogFooter @cancel="close" @add="addLayer" />
        </div>
    </div>
</template>
