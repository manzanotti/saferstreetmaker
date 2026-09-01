<script setup lang="ts">
import { computed, nextTick, ref, toRaw } from 'vue';
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';
import {
    createImportedLayer,
    getPropertyPreview,
    parseGeoJson,
    retainNameProperty,
    type GeoJsonPropertyPreview
} from '../../features/map/importedGeoJson';

const props = defineProps<{
    existingNames: string[];
}>();

const emit = defineEmits<{
    add: [layer: ImportedGeoJsonLayer];
    cancel: [];
}>();

const source = ref<'file' | 'url'>('file');
const fileInput = ref<HTMLInputElement | null>(null);
const url = ref('');
const layerName = ref('');
const nameProperty = ref<string | null>(null);
const parsedGeoJson = ref<GeoJSON.FeatureCollection | null>(null);
const propertyPreview = ref<GeoJsonPropertyPreview[]>([]);
const error = ref('');
const loading = ref(false);

const dialogInputId = computed(() => (source.value === 'file' ? 'geojson-file' : 'geojson-url'));

function openFilePicker() {
    fileInput.value?.click();
}

function resetError() {
    error.value = '';
}

function setParsedGeoJson(value: unknown, sourceName: string) {
    const featureCollection = parseGeoJson(value);
    parsedGeoJson.value = featureCollection;
    propertyPreview.value = getPropertyPreview(featureCollection);
    nameProperty.value = null;
    if (!layerName.value) {
        layerName.value = sourceName.replace(/\.(geojson|json)$/i, '');
    }
}

async function onFileSelected(event: Event) {
    resetError();
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
        return;
    }
    try {
        setParsedGeoJson(JSON.parse(await file.text()), file.name);
    } catch (e: unknown) {
        error.value =
            e instanceof SyntaxError
                ? 'The file is not valid JSON.'
                : String((e as Error).message ?? e);
    }
}

function onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
        return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    if (fileInput.value) {
        fileInput.value.files = transfer.files;
    }
    void onFileSelected({ target: { files: [file] } } as unknown as Event);
}

async function loadFromUrl() {
    resetError();
    if (!url.value.trim()) {
        error.value = 'Enter a GeoJSON URL.';
        return;
    }
    loading.value = true;
    try {
        const response = await fetch(url.value.trim());
        if (!response.ok) {
            throw new Error(`The URL returned ${response.status} ${response.statusText}.`);
        }
        setParsedGeoJson(
            await response.json(),
            new URL(url.value.trim()).pathname.split('/').pop() || 'GeoJSON layer'
        );
    } catch (e: unknown) {
        error.value = `Could not load GeoJSON. ${String((e as Error).message ?? e)} Check that the URL allows browser CORS requests.`;
    } finally {
        loading.value = false;
    }
}

function addLayer() {
    if (!parsedGeoJson.value) {
        error.value = 'Choose a file or load a URL before adding a layer.';
        return;
    }
    const trimmedName = layerName.value.trim();
    if (!trimmedName) {
        error.value = 'Enter a name for this layer.';
        return;
    }
    if (props.existingNames.includes(trimmedName)) {
        error.value = 'A layer with this name already exists.';
        return;
    }
    const layer = createImportedLayer(trimmedName, toRaw(parsedGeoJson.value), props.existingNames);
    layer.name = trimmedName;
    layer.nameProperty = nameProperty.value;
    layer.featureCollection = retainNameProperty(layer.featureCollection, layer.nameProperty);
    emit('add', layer);
}

function close() {
    emit('cancel');
}

nextTick(() => fileInput.value?.focus());
</script>

<template>
    <div
        id="add-layer-overlay"
        class="fixed inset-0 z-[10003] flex items-center justify-center bg-black/20 px-4"
        @click.self="close"
    >
        <div
            id="add-layer-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-layer-dialog-title"
            class="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl border border-gray-100"
            @keydown.esc="close"
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
                <div class="flex gap-2" role="group" aria-label="GeoJSON source">
                    <button
                        type="button"
                        :aria-pressed="source === 'file'"
                        class="rounded-lg px-3 py-2 text-sm"
                        :class="
                            source === 'file'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-slate-50 text-gray-700'
                        "
                        @click="source = 'file'"
                    >
                        Upload file
                    </button>
                    <button
                        type="button"
                        :aria-pressed="source === 'url'"
                        class="rounded-lg px-3 py-2 text-sm"
                        :class="
                            source === 'url'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-slate-50 text-gray-700'
                        "
                        @click="source = 'url'"
                    >
                        Load URL
                    </button>
                </div>

                <div v-if="source === 'file'" class="space-y-2">
                    <input
                        ref="fileInput"
                        id="geojson-file"
                        type="file"
                        accept=".geojson,.json,application/geo+json,application/json"
                        class="sr-only"
                        @change="onFileSelected"
                    />
                    <div
                        id="geojson-drop-zone"
                        tabindex="0"
                        class="border-2 border-dashed border-gray-300 rounded-xl px-4 py-8 text-center text-sm text-gray-600 focus-visible:ring-2 focus-visible:ring-green-500"
                        @click="openFilePicker"
                        @keydown.enter="openFilePicker"
                        @keydown.space.prevent="openFilePicker"
                        @dragover.prevent
                        @drop="onDrop"
                    >
                        Drop a GeoJSON file here or
                        <span class="font-semibold text-green-700">choose a file</span>
                    </div>
                </div>
                <div v-else class="space-y-2">
                    <label for="geojson-url" class="block text-sm font-medium text-gray-700"
                        >GeoJSON URL</label
                    >
                    <div class="flex gap-2">
                        <input
                            id="geojson-url"
                            v-model="url"
                            type="url"
                            class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                            @keydown.enter="loadFromUrl"
                        />
                        <button
                            type="button"
                            class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
                            :disabled="loading"
                            @click="loadFromUrl"
                        >
                            {{ loading ? 'Loading...' : 'Load' }}
                        </button>
                    </div>
                </div>

                <div v-if="parsedGeoJson" class="space-y-3">
                    <div>
                        <label
                            for="imported-layer-name"
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Layer name</label
                        >
                        <input
                            id="imported-layer-name"
                            v-model="layerName"
                            type="text"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            for="imported-name-property"
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Feature name field</label
                        >
                        <select
                            id="imported-name-property"
                            v-model="nameProperty"
                            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                        >
                            <option :value="null">None</option>
                            <option
                                v-for="property in propertyPreview.filter(
                                    (item) => item.selectableAsName
                                )"
                                :key="property.key"
                                :value="property.key"
                            >
                                {{ property.key }}
                            </option>
                        </select>
                    </div>
                    <div
                        v-if="propertyPreview.length"
                        id="geojson-property-preview"
                        class="rounded-lg bg-slate-50 p-3"
                    >
                        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                            First feature properties
                        </p>
                        <div
                            v-for="property in propertyPreview"
                            :key="property.key"
                            class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2"
                        >
                            <dt class="font-medium text-gray-700 truncate">
                                {{ property.key }}
                            </dt>
                            <dd class="text-gray-600 wrap-break-word">
                                {{ property.displayValue }}
                            </dd>
                        </div>
                    </div>
                </div>
                <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
            </div>
            <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
                <button
                    type="button"
                    class="rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-700 px-4 py-2 text-sm font-medium"
                    @click="close"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-2 text-sm font-medium"
                    @click="addLayer"
                >
                    Add layer
                </button>
            </div>
        </div>
    </div>
</template>
