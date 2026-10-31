<script setup lang="ts">
import { vMovablePanel } from '../../directives/movablePanel';
import { useMapManagerActions } from '../../composables/panels/useMapManagerActions';
import MapManagerActionButtons from './mapManager/MapManagerActionButtons.vue';
import StoredMapList from './mapManager/StoredMapList.vue';

const {
    settingsStore,
    showCreateForm,
    newMapTitle,
    duplicateTitleError,
    storedMaps,
    onNewMap,
    onCopyMap,
    onCreate,
    onLoadFile,
    onSaveFile,
    onExportGeoJSON,
    onLoadStoredMap,
    onDeleteStoredMap,
    onClose
} = useMapManagerActions();
</script>

<template>
    <div
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] flex items-start justify-center"
        @dblclick.stop
    >
        <div
            v-movable-panel
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
                <MapManagerActionButtons
                    @new-map="onNewMap"
                    @copy-map="onCopyMap"
                    @load-file="onLoadFile"
                    @save-file="onSaveFile"
                    @export-geo-json="onExportGeoJSON"
                />

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

                <StoredMapList
                    :maps="storedMaps"
                    :current-title="settingsStore.title"
                    @load="onLoadStoredMap"
                    @delete="onDeleteStoredMap"
                />
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
