<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { useMapStore } from '../../stores/mapStore';
import { getMapManager } from '../../composables/useMapManager';
import { isSaveErrorAlreadyShown } from '../../composables/saveErrorMarker';
import { Settings } from '../../models/Settings';

const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const mapStore = useMapStore();

const form = reactive({
    title: settingsStore.title,
    readOnly: settingsStore.readOnly,
    activeLayers: [...settingsStore.activeLayers]
});

watch(
    () => uiStore.activePanel,
    (activePanel) => {
        if (activePanel !== 'settings') {
            return;
        }
        form.title = settingsStore.title;
        form.readOnly = settingsStore.readOnly;
        form.activeLayers = [...settingsStore.activeLayers];
    },
    { immediate: true }
);

async function onSave() {
    const currentSettings = settingsStore.toSettings();
    const s = new Settings();
    s.title = form.title;
    s.readOnly = form.readOnly;
    s.hideToolbar = settingsStore.hideToolbar;
    s.zoom = currentSettings.zoom;
    s.centre = settingsStore.centre ?? currentSettings.centre;
    s.version = settingsStore.version;
    s.activeLayers = form.activeLayers;
    try {
        await getMapManager().applySettings(s);
    } catch (e: any) {
        if (isSaveErrorAlreadyShown(e)) {
            return;
        }
        uiStore.closePanel();
        uiStore.showErrors(['There was a problem saving the settings:', String(e?.message ?? e)]);
        return;
    }
    uiStore.closePanel();
}

function onCancel() {
    uiStore.closePanel();
}
</script>

<template>
    <div
        role="dialog"
        aria-labelledby="settings-panel-title"
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10002] rounded-2xl bg-white shadow-xl border border-gray-100 w-80 flex flex-col overflow-hidden max-h-[90vh]"
        @dblclick.stop
    >
        <div class="flex items-center px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 id="settings-panel-title" class="text-base font-semibold text-gray-800">
                Settings
            </h2>
        </div>
        <div class="px-5 py-4 space-y-4 overflow-y-auto">
            <div>
                <label for="title" class="block text-sm font-medium text-gray-700 mb-1"
                    >Title</label
                >
                <input
                    id="title"
                    v-model="form.title"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    :readonly="form.readOnly"
                />
            </div>
            <div>
                <label for="zoom" class="block text-sm font-medium text-gray-700 mb-1">Zoom</label>
                <input
                    id="zoom"
                    type="text"
                    class="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 bg-gray-50 outline-none"
                    :value="settingsStore.zoom"
                    readonly
                />
            </div>
            <div>
                <label for="centre" class="block text-sm font-medium text-gray-700 mb-1"
                    >Centre</label
                >
                <input
                    id="centre"
                    type="text"
                    class="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 bg-gray-50 outline-none"
                    :value="
                        settingsStore.centre
                            ? `${settingsStore.centre.lat},${settingsStore.centre.lng}`
                            : ''
                    "
                    readonly
                />
            </div>
            <div class="toggle">
                <div class="form-check form-switch toggle-row">
                    <label
                        class="form-check-label toggle-label text-sm font-medium text-gray-700"
                        for="read-only"
                        >Read-only</label
                    >
                    <input id="read-only" v-model="form.readOnly" type="checkbox" role="switch" />
                </div>
            </div>
            <div>
                <p class="text-sm font-medium text-gray-700 mb-2">Visible Layers</p>
                <div v-for="layer in mapStore.layers" :key="layer.id" class="toggle mb-1">
                    <div class="form-check form-switch toggle-row">
                        <label :for="layer.id" class="toggle-label text-sm text-gray-700">{{
                            layer.title
                        }}</label>
                        <input
                            :id="layer.id"
                            v-model="form.activeLayers"
                            name="layer"
                            type="checkbox"
                            role="switch"
                            :value="layer.id"
                            :disabled="form.readOnly"
                        />
                    </div>
                </div>
            </div>
        </div>
        <div
            class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0"
        >
            <button
                type="button"
                class="rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-700 px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
                @click="onCancel"
            >
                Cancel
            </button>
            <button
                type="button"
                class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
                @click="onSave"
            >
                Save
            </button>
        </div>
    </div>
</template>
