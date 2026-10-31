<script setup lang="ts">
import { useGroupStore } from '../../../stores/groupStore';
import { useSelectionStore } from '../../../stores/selectionStore';
import { confirmEmptyGroupPhaseDeletion } from '../../../composables/useGroups';

defineProps<{
    editingPhaseNumber: number | null;
    nextPhaseNumber: number;
}>();

const groupStore = useGroupStore();
const selectionStore = useSelectionStore();

function confirmEmptyPhase(deletePhase: boolean) {
    confirmEmptyGroupPhaseDeletion(deletePhase);
}
</script>

<template>
    <div class="rounded-lg border border-green-200 bg-green-50 p-3">
        <p class="text-sm font-medium text-green-900">
            {{
                editingPhaseNumber
                    ? `Edit Phase ${editingPhaseNumber}`
                    : `Create Phase ${nextPhaseNumber}`
            }}
        </p>
        <p class="mt-1 text-xs text-green-800">
            {{
                selectionStore.selected.length
                    ? 'Selected features are highlighted.'
                    : 'Select at least one feature.'
            }}
        </p>
        <div
            v-if="groupStore.pendingEmptyPhaseDeletionId"
            class="mt-3 space-y-2 rounded border border-red-100 bg-red-50 p-3 text-xs text-gray-700"
        >
            <p>This phase has no features. Delete the phase?</p>
            <div class="flex gap-2">
                <button
                    type="button"
                    class="rounded bg-red-600 px-2 py-1 text-white"
                    @click="confirmEmptyPhase(true)"
                >
                    Delete phase
                </button>
                <button
                    type="button"
                    class="rounded border border-gray-200 bg-white px-2 py-1"
                    @click="confirmEmptyPhase(false)"
                >
                    Keep editing
                </button>
            </div>
        </div>
    </div>
</template>
