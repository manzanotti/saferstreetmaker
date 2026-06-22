<script setup lang="ts">
import { reactive } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { useMapStore } from '../../stores/mapStore';
import { getMapManager } from '../../composables/useMapManager';
import { Settings } from '../../models/Settings';

const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const mapStore = useMapStore();

// Local form state, pre-filled from the store when the modal opens.
const form = reactive({
    title: settingsStore.title,
    readOnly: settingsStore.readOnly,
    activeLayers: [...settingsStore.activeLayers],
});

function onSave() {
    const s = new Settings();
    s.title = form.title;
    s.readOnly = form.readOnly;
    s.hideToolbar = settingsStore.hideToolbar;
    s.zoom = settingsStore.zoom;
    s.centre = settingsStore.centre ?? settingsStore.toSettings().centre;
    s.version = settingsStore.version;
    s.activeLayers = form.activeLayers;

    getMapManager().applySettings(s);
    uiStore.closeModal();
}

function onCancel() {
    uiStore.closeModal();
}
</script>

<template>
    <div class="modal">
        <h4>Settings</h4>

        <div class="mb-2">
            <label for="title">Title</label>
            <input
                id="title"
                v-model="form.title"
                type="text"
                class="border-solid"
                :readonly="form.readOnly"
            />
        </div>

        <div class="mb-2">
            <label for="zoom">Zoom</label>
            <input
                id="zoom"
                type="text"
                class="border-solid"
                :value="settingsStore.zoom"
                readonly
            />
        </div>

        <div class="mb-2">
            <label for="centre">Centre</label>
            <input
                id="centre"
                type="text"
                class="border-solid"
                :value="
                    settingsStore.centre
                        ? `${settingsStore.centre.lat},${settingsStore.centre.lng}`
                        : ''
                "
                readonly
            />
        </div>

        <div class="toggle flex justify-left mb-2">
            <div class="form-check form-switch flex items-center gap-2">
                <input id="read-only" v-model="form.readOnly" type="checkbox" role="switch" />
                <label class="form-check-label inline-block text-gray-800" for="read-only"
                    >Read-only</label
                >
            </div>
        </div>

        <div class="mb-2">
            <h4>Visible Layers</h4>
            <div
                v-for="layer in mapStore.layers"
                :key="layer.id"
                class="toggle flex justify-left mb-2"
            >
                <div class="form-check form-switch">
                    <label :for="layer.id">{{ layer.title }}</label>
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

        <div class="flex justify-center mb-2">
            <button type="button" @click="onSave">Save</button>
            <button type="button" @click="onCancel">Cancel</button>
        </div>
    </div>
</template>
