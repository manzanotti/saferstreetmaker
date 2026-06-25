<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMapStore } from '../../stores/mapStore';
import { useUiStore } from '../../stores/uiStore';
import { getMapManager, getFileManager } from '../../composables/useMapManager';
import { isSaveErrorAlreadyShown } from '../../composables/saveErrorMarker';

const settingsStore = useSettingsStore();
const mapStore = useMapStore();
const uiStore = useUiStore();

const showCreateForm = ref(false);
const newMapTitle = ref('');
const duplicateTitleError = ref('');

const storedMaps = ref<string[]>([]);

async function refreshMapList() {
    storedMaps.value = await getFileManager().loadMapListFromStorage();
}

function showMapListError(e: any) {
    uiStore.showErrors([
        'There was a problem loading the stored map list:',
        String(e?.message ?? e)
    ]);
}

function showStoredMapLoadError(e: any) {
    uiStore.showErrors(['There was a problem loading the stored map:', String(e?.message ?? e)]);
}

onMounted(() => {
    void refreshMapList().catch((e) => {
        showMapListError(e);
    });
});

function onNewMap() {
    showCreateForm.value = true;
    newMapTitle.value = '';
    duplicateTitleError.value = '';
}

async function onCopyMap() {
    try {
        await getFileManager().copyMap(settingsStore.toSettings(), mapStore.toLayers());
    } catch (e: any) {
        uiStore.showErrors(['There was a problem copying the map:', String(e?.message ?? e)]);
        return;
    }

    try {
        await refreshMapList();
    } catch (e: any) {
        showMapListError(e);
    }
}

async function onCreate() {
    const title = newMapTitle.value.trim();
    if (!title) {
        return;
    }

    try {
        const ok = await getMapManager().createNewMap(title);
        if (!ok) {
            duplicateTitleError.value = `You already have a map named ${title}`;
            return;
        }
    } catch (e: any) {
        if (isSaveErrorAlreadyShown(e)) {
            return;
        }
        uiStore.showErrors(['There was a problem creating the map:', String(e?.message ?? e)]);
        return;
    }

    showCreateForm.value = false;

    try {
        await refreshMapList();
    } catch (e: any) {
        showMapListError(e);
        return;
    }

    uiStore.closeModal();
}

function onLoadFile() {
    getFileManager().loadMapFromFile();
}

function onSaveFile() {
    getFileManager().saveMapToFile(settingsStore.toSettings(), mapStore.toLayers());
    uiStore.closeModal();
}

function onExportGeoJSON() {
    getFileManager().saveMapToGeoJSONFile(settingsStore.toSettings(), mapStore.toLayers());
    uiStore.closeModal();
}

async function onLoadStoredMap(mapName: string) {
    try {
        const loaded = await getMapManager().loadMapFromStorage(mapName);
        if (!loaded) {
            return;
        }
    } catch (e: any) {
        showStoredMapLoadError(e);
        return;
    }

    try {
        await refreshMapList();
    } catch (e: any) {
        showMapListError(e);
        return;
    }

    uiStore.closeModal();
}

async function onDeleteStoredMap(mapName: string) {
    try {
        await getFileManager().deleteMapFromStorage(mapName);
    } catch (e: any) {
        uiStore.showErrors([
            'There was a problem deleting the stored map:',
            String(e?.message ?? e)
        ]);
        return;
    }

    try {
        await refreshMapList();
    } catch (e: any) {
        showMapListError(e);
    }
}

function onClose() {
    uiStore.closeModal();
}
</script>

<template>
    <div id="map-manager" class="modal">
        <h4>Manage maps</h4>

        <!-- File action buttons -->
        <div class="mb-2">
            <input
                id="new-map"
                type="button"
                class="new-map"
                title="Create a new map"
                @click.stop="onNewMap"
            />
            <input
                id="copy-map"
                type="button"
                class="copy-map"
                title="Make a copy of this map"
                @click.stop="onCopyMap"
            />
            <input
                id="load-file"
                type="button"
                class="load-file"
                title="Load a map from a JSON file"
                @click.stop="onLoadFile"
            />
            <input
                id="save-file"
                type="button"
                class="save-file"
                title="Save a map to a JSON file"
                @click.stop="onSaveFile"
            />
            <input
                id="save-geojson-file"
                type="button"
                class="save-geojson-file"
                title="Export a map to GeoJSON"
                @click.stop="onExportGeoJSON"
            />
        </div>

        <!-- Create new map section -->
        <div id="create-new-map" :class="{ hidden: !showCreateForm }">
            <div class="mb-2">
                <label for="new-map-title">Title</label>
                <input id="new-map-title" v-model="newMapTitle" type="text" class="border-solid" />
            </div>
            <div>
                <span
                    id="duplicate-title-error"
                    class="text-red-700"
                    :class="{ hidden: !duplicateTitleError }"
                    >{{ duplicateTitleError }}</span
                >
            </div>
            <div class="flex justify-center mb-2">
                <button type="button" @click="onCreate">Create</button>
            </div>
        </div>

        <!-- Stored maps list -->
        <div v-if="storedMaps.length > 0" id="map-list" class="mb-2">
            <h4>Maps stored in your browser</h4>
            <div class="italic text-center mb-2">Click map name to load that map</div>
            <ul>
                <li v-for="mapName in storedMaps" :key="mapName" class="local-map">
                    <template v-if="mapName === settingsStore.title">
                        <span class="font-bold">{{ mapName }} (current map)</span>
                    </template>
                    <template v-else>
                        <input
                            type="button"
                            class="delete-button float-right"
                            @click.stop="onDeleteStoredMap(mapName)"
                        />
                        <span class="cursor-pointer" @click.stop="onLoadStoredMap(mapName)">{{
                            mapName
                        }}</span>
                    </template>
                </li>
            </ul>
        </div>

        <div class="flex justify-center mb-2">
            <button type="button" @click="onClose">Close</button>
        </div>
    </div>
</template>
