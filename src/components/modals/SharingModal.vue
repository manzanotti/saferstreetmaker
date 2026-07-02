<script setup lang="ts">
import { ref } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMapStore } from '../../stores/mapStore';
import { useUiStore } from '../../stores/uiStore';
import { getFileManager } from '../../composables/useMapManager';

const settingsStore = useSettingsStore();
const mapStore = useMapStore();
const uiStore = useUiStore();

const width = ref<number | null>(null);
const height = ref<number | null>(null);
const hideToolbar = ref(false);
const showCopiedMessage = ref(false);

function onCreate() {
    if (width.value === null || height.value === null || width.value <= 0 || height.value <= 0) {
        return;
    }

    const mapHash = getFileManager().saveMapToHash(settingsStore.toSettings(), mapStore.toLayers());
    const baseUrl = window.location.origin + window.location.pathname;
    const html = `<iframe src="${baseUrl}?hide-toolbar=${hideToolbar.value}#${mapHash}" width="${width.value}" height="${height.value}" title="Safer Street Maker map"></iframe>`;

    if (!navigator.clipboard) {
        showCopiedMessage.value = false;
        return;
    }

    navigator.clipboard
        .writeText(html)
        .then(() => {
            showCopiedMessage.value = true;
        })
        .catch((err) => {
            showCopiedMessage.value = false;
            console.warn('Clipboard write failed:', err);
        });
}

function onClose() {
    uiStore.closeModal();
}
</script>

<template>
    <div class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999]">
        <form
            id="sharing"
            class="relative rounded-2xl bg-white shadow-xl border border-gray-100 w-72 flex flex-col overflow-hidden"
            @submit.prevent="onCreate"
        >
            <div class="flex items-center px-5 py-4 border-b border-gray-100 shrink-0">
                <h2 class="text-base font-semibold text-gray-800">Share map</h2>
            </div>

            <div class="px-5 py-4 space-y-4">
                <div>
                    <label for="width" class="block text-sm font-medium text-gray-700 mb-1"
                        >Width</label
                    >
                    <div class="flex items-center gap-2">
                        <input
                            id="width"
                            v-model.number="width"
                            type="number"
                            required
                            class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                        <span class="text-sm text-gray-500">px</span>
                    </div>
                </div>

                <div>
                    <label for="height" class="block text-sm font-medium text-gray-700 mb-1"
                        >Height</label
                    >
                    <div class="flex items-center gap-2">
                        <input
                            id="height"
                            v-model.number="height"
                            type="number"
                            required
                            class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                        <span class="text-sm text-gray-500">px</span>
                    </div>
                </div>

                <div class="toggle">
                    <div class="form-check form-switch toggle-row">
                        <label
                            class="form-check-label toggle-label text-sm font-medium text-gray-700"
                            for="hide-toolbar"
                            >Hide toolbar</label
                        >
                        <input
                            id="hide-toolbar"
                            v-model="hideToolbar"
                            type="checkbox"
                            role="switch"
                        />
                    </div>
                </div>

                <p
                    id="messageRow"
                    class="text-sm text-green-700 font-medium"
                    :class="{ hidden: !showCopiedMessage }"
                >
                    Copied to clipboard
                </p>
            </div>

            <div
                class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0"
            >
                <button
                    type="button"
                    class="rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-700 px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
                    @click="onClose"
                >
                    Close
                </button>
                <button
                    type="submit"
                    class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
                >
                    Create
                </button>
            </div>
        </form>
    </div>
</template>
