<script setup lang="ts">
import type { ExportFormat } from '../../../composables/panels/useSharingExportOptions';

const props = defineProps<{
    format: ExportFormat;
    disabled: boolean;
}>();

const width = defineModel<number | null>('width', { required: true });
const height = defineModel<number | null>('height', { required: true });

const emit = defineEmits<{
    selectFormat: [format: ExportFormat];
    dimensionInput: [];
}>();

function formatButtonClasses(format: ExportFormat) {
    return [
        'flex-1 rounded-md px-2 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600',
        props.format === format
            ? 'bg-green-700 text-white shadow-sm'
            : 'text-gray-600 hover:bg-white'
    ];
}
</script>

<template>
    <div v-if="format !== 'url'">
        <label for="width" class="block text-sm font-medium text-gray-700 mb-1">Width</label>
        <div class="flex items-center gap-2">
            <input
                id="width"
                v-model.number="width"
                type="number"
                :min="format === 'image' ? 256 : undefined"
                :max="format === 'image' ? 8192 : undefined"
                required
                :disabled="disabled"
                class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-100"
                @input="emit('dimensionInput')"
            />
            <span class="text-sm text-gray-500">px</span>
        </div>
    </div>

    <div v-if="format !== 'url'">
        <label for="height" class="block text-sm font-medium text-gray-700 mb-1">Height</label>
        <div class="flex items-center gap-2">
            <input
                id="height"
                v-model.number="height"
                type="number"
                :min="format === 'image' ? 256 : undefined"
                :max="format === 'image' ? 8192 : undefined"
                required
                :disabled="disabled"
                class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-100"
                @input="emit('dimensionInput')"
            />
            <span class="text-sm text-gray-500">px</span>
        </div>
    </div>

    <div>
        <p id="sharing-format-label" class="mb-1 text-sm font-medium text-gray-700">Export as:</p>
        <div
            id="export-as"
            role="group"
            aria-labelledby="sharing-format-label"
            class="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5"
        >
            <button
                id="export-as-image"
                type="button"
                :aria-pressed="format === 'image'"
                :disabled="disabled"
                :class="formatButtonClasses('image')"
                @click="emit('selectFormat', 'image')"
            >
                Image
            </button>
            <button
                id="export-as-html"
                type="button"
                :aria-pressed="format === 'html'"
                :disabled="disabled"
                :class="formatButtonClasses('html')"
                @click="emit('selectFormat', 'html')"
            >
                HTML
            </button>
            <button
                id="export-as-url"
                type="button"
                :aria-pressed="format === 'url'"
                :disabled="disabled"
                :class="formatButtonClasses('url')"
                @click="emit('selectFormat', 'url')"
            >
                Url
            </button>
        </div>
    </div>
</template>
