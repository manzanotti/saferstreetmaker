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
    <form id="sharing" class="popup modal" @submit.prevent="onCreate">
        <h4>Share map</h4>

        <div class="mb-2">
            <label for="width">Width</label>
            <input id="width" v-model.number="width" type="number" required class="border-solid" />
            <span>px</span>
        </div>

        <div class="mb-2">
            <label for="height">Height</label>
            <input
                id="height"
                v-model.number="height"
                type="number"
                required
                class="border-solid"
            />
            <span>px</span>
        </div>

        <div class="toggle flex justify-left mb-2">
            <div class="form-check form-switch flex items-center gap-2">
                <input id="hide-toolbar" v-model="hideToolbar" type="checkbox" role="switch" />
                <label class="form-check-label inline-block text-gray-800" for="hide-toolbar"
                    >Hide toolbar</label
                >
            </div>
        </div>

        <div id="messageRow" :style="{ display: showCopiedMessage ? 'block' : 'none' }">
            Copied to clipboard
        </div>

        <div class="flex justify-center mb-2">
            <button
                type="submit"
                class="inline-block px-6 py-2.5 bg-blue-600 text-white font-medium text-xs leading-tight uppercase rounded-sm shadow-md hover:bg-blue-700"
            >
                Create
            </button>
            <button
                type="button"
                class="inline-block px-6 py-2.5 bg-blue-600 text-white font-medium text-xs leading-tight uppercase rounded-sm shadow-md hover:bg-blue-700"
                @click="onClose"
            >
                Close
            </button>
        </div>
    </form>
</template>
