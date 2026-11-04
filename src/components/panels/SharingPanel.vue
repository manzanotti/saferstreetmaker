<script setup lang="ts">
import { vMovablePanel } from '../../directives/movablePanel';
import { computed, ref } from 'vue';
import { useUiStore } from '../../stores/uiStore';
import { useGroupStore } from '../../stores/groupStore';
import { useSelectionStore } from '../../stores/selectionStore';
import type { Group } from '../../models/Group';
import { useSharingGenerator } from '../../composables/useSharingGenerator';
import {
    useSharingExportOptions,
    type ExportFormat
} from '../../composables/panels/useSharingExportOptions';
import { exportMapAsPng } from '../../features/export/mapImageExport';
import SharingGroupScopePrompt from './SharingGroupScopePrompt.vue';
import SharingExportOptions from './sharing/SharingExportOptions.vue';

const uiStore = useUiStore();
const groupStore = useGroupStore();
const selectionStore = useSelectionStore();

const { width, height, exportFormat, exportValidationError, hasEmbedDimensions } =
    useSharingExportOptions();
const errorMessage = ref<string | null>(null);
const isBusy = computed(() => uiStore.imageExportInProgress);
const hasSelectedGroupFeatures = computed(
    () =>
        selectionStore.isGroupSelection &&
        selectionStore.selectedGroupId !== null &&
        selectionStore.selected.length > 0
);
const shareScopeGroup = ref<Group | null>(null);
const scopePromptTrigger = ref<HTMLElement | null>(null);
const { showCopiedMessage, createShare } = useSharingGenerator(width, height, shareScopeGroup);

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

    if (exportFormat.value !== 'url' && !hasEmbedDimensions()) {
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
        v-movable-panel
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
                <SharingExportOptions
                    v-model:width="width"
                    v-model:height="height"
                    :format="exportFormat"
                    :disabled="isBusy"
                    @select-format="selectFormat"
                    @dimension-input="errorMessage = null"
                />

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
                    <template v-if="hasSelectedGroupFeatures">
                        The selected group is fitted to the PNG.
                    </template>
                    <template v-else>
                        PNG at the current map scale. Larger dimensions show more surrounding map.
                    </template>
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
