<script setup lang="ts">
import { getMapManager } from '../../composables/useMapManager';
import { useHistoryStore } from '../../stores/historyStore';

const historyStore = useHistoryStore();

async function onUndo() {
    await getMapManager().undo();
}

async function onRedo() {
    await getMapManager().redo();
}
</script>

<template>
    <ul
        role="toolbar"
        aria-label="History controls"
        class="flex flex-row gap-1.5 p-[3px] rounded-2xl bg-white/[0.94] shadow-xl border border-white/60 w-fit"
    >
        <li>
            <button
                id="undo-button"
                type="button"
                aria-label="Undo"
                :disabled="historyStore.busy || !historyStore.canUndo"
                class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-semibold bg-slate-50 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 [touch-action:manipulation] cursor-pointer select-none transition-transform duration-150 ease-out disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
                @click.stop="onUndo"
            >
                <span aria-hidden="true">&#x21B6;</span>
            </button>
        </li>
        <li>
            <button
                id="redo-button"
                type="button"
                aria-label="Redo"
                :disabled="historyStore.busy || !historyStore.canRedo"
                class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-semibold bg-slate-50 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 [touch-action:manipulation] cursor-pointer select-none transition-transform duration-150 ease-out disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
                @click.stop="onRedo"
            >
                <span aria-hidden="true">&#x21B7;</span>
            </button>
        </li>
    </ul>
</template>
