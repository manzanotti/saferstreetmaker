<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { useUiStore } from '../../stores/uiStore';
import { useGroupStore } from '../../stores/groupStore';
import { useSelectionStore } from '../../stores/selectionStore';
import type { Group } from '../../models/Group';
import { useSharingGenerator } from '../../composables/useSharingGenerator';
import {
    exportMapAsPng,
    getImageExportValidationError
} from '../../features/export/mapImageExport';
import SharingGroupScopePrompt from './SharingGroupScopePrompt.vue';

const mapStore = useMapStore();
const uiStore = useUiStore();
const groupStore = useGroupStore();
const selectionStore = useSelectionStore();

const mapSize = mapStore.map?.getSize();
const width = ref<number | null>(mapSize ? Math.round(mapSize.x) : null);
const height = ref<number | null>(mapSize ? Math.round(mapSize.y) : null);
type ExportFormat = 'image' | 'html' | 'url';
const exportFormat = ref<ExportFormat>('html');
const errorMessage = ref<string | null>(null);
const isBusy = computed(() => uiStore.imageExportInProgress);
const exportValidationError = computed(() =>
    exportFormat.value === 'image' ? getImageExportValidationError(width.value, height.value) : null
);
const shareScopeGroup = ref<Group | null>(null);
const scopePromptTrigger = ref<HTMLElement | null>(null);
const { showCopiedMessage, createShare } = useSharingGenerator(width, height, shareScopeGroup);

function formatButtonClasses(format: ExportFormat) {
    return [
        'flex-1 rounded-md px-2 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600',
        exportFormat.value === format
            ? 'bg-green-700 text-white shadow-sm'
            : 'text-gray-600 hover:bg-white'
    ];
}

function selectFormat(format: ExportFormat) {
    exportFormat.value = format;
    errorMessage.value = null;
    showCopiedMessage.value = false;
}

async function onCreate() {
    errorMessage.value = null;
    if (exportFormat.value === 'image') {
        errorMessage.value = exportValidationError.value;
        if (errorMessage.value) {
            return;
        }

        try {
            await exportMapAsPng(width.value!, height.value!);
        } catch (error) {
            errorMessage.value =
                error instanceof Error ? error.message : 'The image could not be exported.';
        }
        return;
    }

    if (
        exportFormat.value !== 'url' &&
        (width.value === null || height.value === null || width.value <= 0 || height.value <= 0)
    ) {
        return;
    }

    const selectedGroup = groupStore.groups.find(
        (group) => group.id === selectionStore.selectedGroupId
    );
    if (selectedGroup && shareScopeGroup.value === null) {
        scopePromptTrigger.value =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        shareScopeGroup.value = selectedGroup;
        return;
    }

    createShare('all', selectedGroup, exportFormat.value);
}

function onScopeShare(scope: 'all' | 'group') {
    createShare(
        scope,
        shareScopeGroup.value ?? undefined,
        exportFormat.value === 'url' ? 'url' : 'html'
    );
}

function onClose() {
    if (!isBusy.value) {
        uiStore.closePanel();
    }
}
</script>

<template>
    <SharingGroupScopePrompt
        v-if="shareScopeGroup"
        :group="shareScopeGroup"
        :trigger="scopePromptTrigger"
        @share="onScopeShare"
        @cancel="shareScopeGroup = null"
    />
    <div
        role="dialog"
        aria-labelledby="sharing-panel-title"
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10002]"
        @dblclick.stop
    >
        <form
            id="sharing"
            class="relative rounded-2xl bg-white shadow-xl border border-gray-100 w-72 flex flex-col overflow-hidden"
            :aria-busy="isBusy"
            @submit.prevent="onCreate"
        >
            <div
                class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0"
            >
                <h2 id="sharing-panel-title" class="text-base font-semibold text-gray-800">
                    Share map
                </h2>
                <button
                    type="button"
                    aria-label="Close sharing panel"
                    :disabled="isBusy"
                    class="rounded text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 disabled:opacity-50"
                    @click="onClose"
                >
                    <span aria-hidden="true" class="text-xl leading-none">&times;</span>
                </button>
            </div>

            <div class="px-5 py-4 space-y-4">
                <div v-if="exportFormat !== 'url'">
                    <label for="width" class="block text-sm font-medium text-gray-700 mb-1"
                        >Width</label
                    >
                    <div class="flex items-center gap-2">
                        <input
                            id="width"
                            v-model.number="width"
                            type="number"
                            :min="exportFormat === 'image' ? 256 : undefined"
                            :max="exportFormat === 'image' ? 8192 : undefined"
                            required
                            :disabled="isBusy"
                            class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-100"
                            @input="errorMessage = null"
                        />
                        <span class="text-sm text-gray-500">px</span>
                    </div>
                </div>

                <div v-if="exportFormat !== 'url'">
                    <label for="height" class="block text-sm font-medium text-gray-700 mb-1"
                        >Height</label
                    >
                    <div class="flex items-center gap-2">
                        <input
                            id="height"
                            v-model.number="height"
                            type="number"
                            :min="exportFormat === 'image' ? 256 : undefined"
                            :max="exportFormat === 'image' ? 8192 : undefined"
                            required
                            :disabled="isBusy"
                            class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-100"
                            @input="errorMessage = null"
                        />
                        <span class="text-sm text-gray-500">px</span>
                    </div>
                </div>

                <div>
                    <p id="sharing-format-label" class="mb-1 text-sm font-medium text-gray-700">
                        Export as:
                    </p>
                    <div
                        id="export-as"
                        role="group"
                        aria-labelledby="sharing-format-label"
                        class="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5"
                    >
                        <button
                            id="export-as-image"
                            type="button"
                            :aria-pressed="exportFormat === 'image'"
                            :disabled="isBusy"
                            :class="formatButtonClasses('image')"
                            @click="selectFormat('image')"
                        >
                            Image
                        </button>
                        <button
                            id="export-as-html"
                            type="button"
                            :aria-pressed="exportFormat === 'html'"
                            :disabled="isBusy"
                            :class="formatButtonClasses('html')"
                            @click="selectFormat('html')"
                        >
                            HTML
                        </button>
                        <button
                            id="export-as-url"
                            type="button"
                            :aria-pressed="exportFormat === 'url'"
                            :disabled="isBusy"
                            :class="formatButtonClasses('url')"
                            @click="selectFormat('url')"
                        >
                            Url
                        </button>
                    </div>
                </div>

                <p
                    v-if="exportFormat !== 'image'"
                    id="messageRow"
                    class="text-sm text-green-700 font-medium"
                    :class="{ hidden: !showCopiedMessage }"
                >
                    Copied to clipboard
                </p>
                <p
                    v-if="exportFormat === 'image'"
                    id="image-export-description"
                    class="text-sm text-gray-600"
                >
                    PNG at the current map scale. Larger dimensions show more surrounding map.
                </p>
                <p
                    v-else-if="exportFormat === 'html'"
                    id="html-export-description"
                    class="text-sm text-gray-600"
                >
                    Copies an iframe snippet sized to the width and height above.
                </p>
                <p v-else id="url-export-description" class="text-sm text-gray-600">
                    Copies a direct link to this map. Width and height do not apply.
                </p>
                <p v-if="isBusy" role="status" aria-live="polite" class="text-sm text-gray-600">
                    Preparing PNG…
                </p>
                <p
                    v-else-if="exportFormat === 'image' && (errorMessage || exportValidationError)"
                    id="image-export-error"
                    role="alert"
                    class="text-sm text-red-700"
                >
                    {{ errorMessage || exportValidationError }}
                </p>
            </div>

            <div
                class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0"
            >
                <button
                    type="submit"
                    :disabled="isBusy || Boolean(exportValidationError)"
                    class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
                >
                    {{ exportFormat === 'image' ? 'Export PNG' : 'Create' }}
                </button>
            </div>
        </form>
    </div>
</template>
