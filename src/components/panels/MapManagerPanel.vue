<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMapStore } from '../../stores/mapStore';
import { useGroupStore } from '../../stores/groupStore';
import { useUiStore } from '../../stores/uiStore';
import { getMapManager, getFileManager } from '../../composables/useMapManager';
import { isSaveErrorAlreadyShown } from '../../composables/saveErrorMarker';

const settingsStore = useSettingsStore();
const mapStore = useMapStore();
const groupStore = useGroupStore();
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
        await getFileManager().copyMap(
            settingsStore.toSettings(),
            mapStore.toLayers(),
            groupStore.groups
        );
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

    uiStore.closePanel();
}

function onLoadFile() {
    getFileManager().loadMapFromFile();
}

function onSaveFile() {
    getFileManager().saveMapToFile(
        settingsStore.toSettings(),
        mapStore.toLayers(),
        groupStore.groups
    );
    uiStore.closePanel();
}

function onExportGeoJSON() {
    getFileManager().saveMapToGeoJSONFile(settingsStore.toSettings(), mapStore.toLayers());
    uiStore.closePanel();
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

    uiStore.closePanel();
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
    uiStore.closePanel();
}
</script>

<template>
    <div
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] flex items-start justify-center"
        @dblclick.stop
    >
        <div
            id="map-manager"
            role="dialog"
            aria-labelledby="map-manager-panel-title"
            class="relative rounded-2xl bg-white shadow-xl border border-gray-100 w-80 flex flex-col overflow-hidden max-h-[85vh]"
        >
            <!-- Header -->
            <div class="flex items-center px-5 py-4 border-b border-gray-100 shrink-0">
                <h2 id="map-manager-panel-title" class="text-base font-semibold text-gray-800">
                    Manage maps
                </h2>
            </div>

            <!-- Body -->
            <div class="px-5 py-4 overflow-y-auto flex-1 space-y-4">
                <!-- Icon action buttons -->
                <div class="flex gap-1.5">
                    <button
                        id="new-map"
                        type="button"
                        aria-label="Create a new map"
                        title="Create a new map"
                        class="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-green-100 border border-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation] cursor-pointer select-none"
                        @click.stop="onNewMap"
                    >
                        <img
                            src="../../img/add-document-svgrepo-com.svg"
                            width="28"
                            height="28"
                            alt=""
                            aria-hidden="true"
                            class="w-7 h-7 object-contain pointer-events-none"
                        />
                    </button>
                    <button
                        id="copy-map"
                        type="button"
                        aria-label="Make a copy of this map"
                        title="Make a copy of this map"
                        class="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-green-100 border border-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation] cursor-pointer select-none"
                        @click.stop="onCopyMap"
                    >
                        <img
                            src="../../img/copy-file-svgrepo-com.svg"
                            width="28"
                            height="28"
                            alt=""
                            aria-hidden="true"
                            class="w-7 h-7 object-contain pointer-events-none"
                        />
                    </button>
                    <button
                        id="load-file"
                        type="button"
                        aria-label="Load a map from a JSON file"
                        title="Load a map from a JSON file"
                        class="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-green-100 border border-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation] cursor-pointer select-none"
                        @click.stop="onLoadFile"
                    >
                        <img
                            src="../../img/folder-svgrepo-com.svg"
                            width="28"
                            height="28"
                            alt=""
                            aria-hidden="true"
                            class="w-7 h-7 object-contain pointer-events-none"
                        />
                    </button>
                    <button
                        id="save-file"
                        type="button"
                        aria-label="Save map to a JSON file"
                        title="Save map to a JSON file"
                        class="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-green-100 border border-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation] cursor-pointer select-none"
                        @click.stop="onSaveFile"
                    >
                        <img
                            src="../../img/save-svgrepo-com.svg"
                            width="28"
                            height="28"
                            alt=""
                            aria-hidden="true"
                            class="w-7 h-7 object-contain pointer-events-none"
                        />
                    </button>
                    <button
                        id="save-geojson-file"
                        type="button"
                        aria-label="Export map to GeoJSON"
                        title="Export map to GeoJSON"
                        class="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-green-100 border border-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation] cursor-pointer select-none"
                        @click.stop="onExportGeoJSON"
                    >
                        <img
                            src="../../img/geojson-file-svgrepo-com.svg"
                            width="28"
                            height="28"
                            alt=""
                            aria-hidden="true"
                            class="w-7 h-7 object-contain pointer-events-none"
                        />
                    </button>
                </div>

                <!-- Create new map form -->
                <div id="create-new-map" :class="{ hidden: !showCreateForm }">
                    <div class="mb-2">
                        <label
                            for="new-map-title"
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Title</label
                        >
                        <input
                            id="new-map-title"
                            v-model="newMapTitle"
                            type="text"
                            class="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                    </div>
                    <span
                        id="duplicate-title-error"
                        class="text-sm text-red-600"
                        :class="{ hidden: !duplicateTitleError }"
                        >{{ duplicateTitleError }}</span
                    >
                    <div class="flex justify-end mt-2">
                        <button
                            type="button"
                            class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
                            @click="onCreate"
                        >
                            Create
                        </button>
                    </div>
                </div>

                <!-- Stored maps list -->
                <div v-if="storedMaps.length > 0" id="map-list">
                    <p class="text-sm font-medium text-gray-700 mb-1">
                        Maps stored in your browser
                    </p>
                    <p class="text-xs text-gray-400 italic mb-2">Click a name to load that map</p>
                    <ul class="space-y-1">
                        <li
                            v-for="mapName in storedMaps"
                            :key="mapName"
                            class="local-map flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50"
                        >
                            <template v-if="mapName === settingsStore.title">
                                <span class="text-sm font-semibold text-gray-800"
                                    >{{ mapName }} (current)</span
                                >
                            </template>
                            <template v-else>
                                <span
                                    role="button"
                                    tabindex="0"
                                    class="text-sm text-gray-700 cursor-pointer truncate"
                                    @click.stop="onLoadStoredMap(mapName)"
                                    @keydown.enter.prevent="onLoadStoredMap(mapName)"
                                    @keydown.space.prevent="onLoadStoredMap(mapName)"
                                    >{{ mapName }}</span
                                >
                                <button
                                    type="button"
                                    class="delete-button shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 hover:bg-red-50 border border-gray-100 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none [touch-action:manipulation] cursor-pointer [background-image:none] [background-size:0_0] hover:shadow-none"
                                    :aria-label="`Delete ${mapName}`"
                                    :title="`Delete ${mapName}`"
                                    @click.stop="onDeleteStoredMap(mapName)"
                                >
                                    <img
                                        src="../../img/outlined-trash-bin-svgrepo-com.svg"
                                        width="18"
                                        height="18"
                                        alt=""
                                        aria-hidden="true"
                                        class="w-[18px] h-[18px] object-contain pointer-events-none"
                                    />
                                </button>
                            </template>
                        </li>
                    </ul>
                </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end px-5 py-4 border-t border-gray-100 shrink-0">
                <button
                    type="button"
                    class="rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-700 px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
                    @click="onClose"
                >
                    Close
                </button>
            </div>
        </div>
    </div>
</template>
