<script setup lang="ts">
import { computed } from 'vue';
import { useSelectionStore } from '../../stores/selectionStore';
import { executeAreaDelete } from '../../composables/useAreaSelection';

const selectionStore = useSelectionStore();

// Multiple vertex entries from the same polyline/polygon share the same
// marker reference; count unique features rather than raw vertex entries.
const featureCount = computed(() => new Set(selectionStore.selected.map((s) => s.marker)).size);
</script>

<template>
    <div
        v-if="selectionStore.isActive && featureCount > 0"
        class="rounded-2xl bg-white/[0.94] shadow-xl border border-white/60 flex items-center gap-2 px-3 py-2"
    >
        <span class="text-sm text-gray-700 font-medium">
            {{ featureCount }}
            {{ featureCount === 1 ? 'feature' : 'features' }} selected
        </span>
        <button
            type="button"
            aria-label="Delete selected features"
            class="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
            @click.stop="executeAreaDelete"
        >
            Delete
        </button>
        <button
            type="button"
            aria-label="Cancel area selection"
            class="rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-700 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
            @click.stop="selectionStore.deactivate()"
        >
            Cancel
        </button>
    </div>
</template>
