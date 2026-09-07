<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
    source: 'file' | 'url';
    url: string;
    loading: boolean;
}>();

const emit = defineEmits<{
    'update:source': [source: 'file' | 'url'];
    'update:url': [url: string];
    fileSelected: [file: File | null];
    loadUrl: [];
}>();

const dropZone = ref<HTMLButtonElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

function openFilePicker() {
    fileInput.value?.click();
}

function onFileSelected(event: Event) {
    emit('fileSelected', (event.target as HTMLInputElement).files?.[0] ?? null);
}

function onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file && fileInput.value) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        fileInput.value.files = transfer.files;
    }
    emit('fileSelected', file);
}

function focusDropZone() {
    dropZone.value?.focus();
}

defineExpose({ focusDropZone });
</script>

<template>
    <div class="space-y-4">
        <div class="flex gap-2" role="group" aria-label="GeoJSON source">
            <button
                type="button"
                :aria-pressed="source === 'file'"
                class="rounded-lg px-3 py-2 text-sm"
                :class="
                    source === 'file' ? 'bg-green-100 text-green-800' : 'bg-slate-50 text-gray-700'
                "
                @click="emit('update:source', 'file')"
            >
                Upload file
            </button>
            <button
                type="button"
                :aria-pressed="source === 'url'"
                class="rounded-lg px-3 py-2 text-sm"
                :class="
                    source === 'url' ? 'bg-green-100 text-green-800' : 'bg-slate-50 text-gray-700'
                "
                @click="emit('update:source', 'url')"
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
                tabindex="-1"
                @change="onFileSelected"
            />
            <button
                ref="dropZone"
                id="geojson-drop-zone"
                type="button"
                tabindex="0"
                class="w-full border-2 border-dashed border-gray-300 rounded-xl px-4 py-8 text-center text-sm text-gray-600 focus-visible:ring-2 focus-visible:ring-green-500"
                @click="openFilePicker"
                @dragover.prevent
                @drop="onDrop"
            >
                Drop a GeoJSON file here or
                <span class="font-semibold text-green-700">choose a file</span>
            </button>
        </div>
        <div v-else class="space-y-2">
            <label for="geojson-url" class="block text-sm font-medium text-gray-700"
                >GeoJSON URL</label
            >
            <div class="flex gap-2">
                <input
                    id="geojson-url"
                    :value="url"
                    type="url"
                    class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    @input="emit('update:url', ($event.target as HTMLInputElement).value)"
                    @keydown.enter="emit('loadUrl')"
                />
                <button
                    type="button"
                    class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200"
                    :disabled="loading"
                    @click="emit('loadUrl')"
                >
                    {{ loading ? 'Loading...' : 'Load' }}
                </button>
            </div>
        </div>
    </div>
</template>
