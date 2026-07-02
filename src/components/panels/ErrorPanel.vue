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
    <!--
        Always-present live region: must be in the DOM before errors arrive
        so assistive technologies register it and announce content changes.
        role="alert" implies aria-live="assertive" + aria-atomic="true".
    -->
    <div role="alert" aria-atomic="true" class="sr-only">
        <p v-for="(message, idx) in uiStore.errorMessages" :key="`${idx}-${message}`">
            {{ message }}
        </p>
    </div>

    <!-- Visual error dialog, conditionally rendered. -->
    <Transition name="overlay-fade">
        <div
            v-if="hasErrors"
            id="errors"
            class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999]"
        >
            <div
                role="dialog"
                aria-labelledby="error-dialog-title"
                class="rounded-2xl bg-white shadow-2xl border border-gray-100 w-[min(90vw,480px)] flex flex-col overflow-hidden"
            >
                <div class="flex items-start gap-3 px-5 py-5">
                    <div class="flex-1">
                        <h2
                            id="error-dialog-title"
                            class="text-base font-semibold text-gray-800 mb-3"
                        >
                            An error has occurred
                        </h2>
                        <div id="errorMessages" class="space-y-1">
                            <p
                                v-for="(message, idx) in uiStore.errorMessages"
                                :key="`${idx}-${message}`"
                                class="text-sm text-gray-600"
                            >
                                {{ message }}
                            </p>
                        </div>
                        <div class="mt-4 flex flex-col gap-2">
                            <button
                                v-if="uiStore.showDownloadStorageLink"
                                type="button"
                                class="text-sm text-green-700 underline text-left"
                                @click="downloadStorageMap"
                            >
                                Download the map to recover your data
                            </button>
                            <button
                                type="button"
                                class="rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-700 px-4 py-2 text-sm font-medium self-end focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation]"
                                @click="uiStore.clearErrors()"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>
