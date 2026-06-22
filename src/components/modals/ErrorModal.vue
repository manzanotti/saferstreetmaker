<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '../../stores/uiStore';
import { getMapManager } from '../../composables/useMapManager';

const uiStore = useUiStore();

const hasErrors = computed(() => uiStore.errorMessages.length > 0);

async function downloadStorageMap() {
    await getMapManager().downloadStorageMap();
}
</script>

<template>
    <!-- Render the error overlay only when errors exist. -->
    <Transition name="overlay-fade">
        <div
            v-if="hasErrors"
            id="errors"
            class="modal modal-dialog modal-dialog-scrollable modal-lg z-0 overflow-hidden"
            style="pointer-events: none"
        >
            <div
                style="pointer-events: auto"
                class="modal-content border-none shadow-lg relative flex flex-col w-full pointer-events-auto bg-white bg-clip-padding rounded-md outline-hidden text-current"
            >
                <div
                    class="modal-header flex shrink-0 items-center justify-between p-4 border-b border-gray-200 rounded-t-md"
                >
                    <h1>Sorry, an error has occurred</h1>
                    <div id="errorMessages" class="w-full">
                        <p
                            v-for="(message, idx) in uiStore.errorMessages"
                            :key="`${idx}-${message}`"
                        >
                            {{ message }}
                        </p>
                        <button
                            v-if="uiStore.showDownloadStorageLink"
                            type="button"
                            class="mt-2 text-blue-700 underline"
                            @click="downloadStorageMap"
                        >
                            Click to download the map from local storage
                        </button>
                        <button
                            type="button"
                            class="mt-2 text-blue-700 underline"
                            @click="uiStore.clearErrors()"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>
