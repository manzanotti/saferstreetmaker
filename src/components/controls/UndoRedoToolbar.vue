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
    <ul class="history-toolbar">
        <li>
            <input
                id="undo-button"
                type="button"
                class="toolbar-button undo"
                title="Undo the last map change"
                value="↶"
                :disabled="historyStore.busy || !historyStore.canUndo"
                @click.stop="onUndo"
            />
        </li>
        <li>
            <input
                id="redo-button"
                type="button"
                class="toolbar-button redo"
                title="Redo the last undone map change"
                value="↷"
                :disabled="historyStore.busy || !historyStore.canRedo"
                @click.stop="onRedo"
            />
        </li>
    </ul>
</template>
