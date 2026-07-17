<script setup lang="ts">
import { useGroupStore } from '../../stores/groupStore';
import { executeSplitsAndProceed, skipSplitsAndProceed } from '../../composables/useGroups';

const groupStore = useGroupStore();
</script>

<template>
    <div
        v-if="groupStore.splitDialogOpen"
        role="dialog"
        aria-labelledby="partial-polyline-dialog-title"
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] rounded-2xl bg-white shadow-xl border border-gray-100 w-96 flex flex-col overflow-hidden max-h-[90vh]"
        @dblclick.stop
    >
        <div class="flex items-center px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 id="partial-polyline-dialog-title" class="text-base font-semibold text-gray-800">
                Partially Selected Lines
            </h2>
        </div>
        <div class="px-5 py-4 space-y-3 overflow-y-auto">
            <p class="text-sm text-gray-700">
                The following lines are only partially selected. They can only be added to the group
                if the selected points are split into a new line:
            </p>
            <ul class="space-y-1">
                <li
                    v-for="(split, index) in groupStore.pendingSplits"
                    :key="index"
                    class="text-sm text-gray-600 flex items-center gap-1.5"
                >
                    <span class="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
                    <span>
                        <span class="font-medium">{{ split.layerTitle }}</span>
                        — {{ split.selectedLatLngs.length }} of
                        {{ split.allLatLngs.length }} vertices selected
                    </span>
                </li>
            </ul>
            <p class="text-sm text-gray-700">
                Would you like to split the selected points into new lines?
            </p>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
            <button
                type="button"
                class="rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-gray-700 px-4 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                @click="skipSplitsAndProceed"
            >
                No, skip them
            </button>
            <button
                type="button"
                class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                @click="executeSplitsAndProceed"
            >
                Yes, split them
            </button>
        </div>
    </div>
</template>
