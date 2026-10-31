<script setup lang="ts">
import { vMovablePanel } from '../../../directives/movablePanel';
import { computed, useTemplateRef, watch } from 'vue';
import { useGroupStore } from '../../../stores/groupStore';
import { useSelectionStore } from '../../../stores/selectionStore';
import {
    closeGroupPhases,
    fitGroupPhaseFeatures,
    focusGroupPhase,
    refreshGroupPhasePresentation,
    reorderGroupPhases,
    startNewGroupPhase
} from '../../../composables/useGroups';
import { getGroupVersions } from '../../../features/groups/groupVersions';
import { useDialogFeatureFitting } from '../../../composables/groups/useDialogFeatureFitting';
import GroupPhaseDraftNotice from './GroupPhaseDraftNotice.vue';

const groupStore = useGroupStore();
const selectionStore = useSelectionStore();
const group = computed(() => groupStore.groups.find((item) => item.id === groupStore.phaseGroupId));
const version = computed(() => {
    if (!group.value || !groupStore.phaseVersionId) {
        return null;
    }
    return (
        getGroupVersions(group.value).find((item) => item.id === groupStore.phaseVersionId) ?? null
    );
});
const phases = computed(() => version.value?.phases ?? []);
const editingPhaseNumber = computed(() => {
    const index = phases.value.findIndex((phase) => phase.id === groupStore.phaseEditingId);
    return index >= 0 ? index + 1 : null;
});
const isOpen = computed(() => groupStore.phasesDialogOpen && Boolean(group.value && version.value));
const dialog = useTemplateRef<HTMLDivElement>('dialog');
const draggedPhaseId = { value: null as string | null };

useDialogFeatureFitting({
    isOpen,
    getDialogElement: () => dialog.value,
    fitFeatures: () => fitGroupPhaseFeatures(dialog.value?.offsetHeight ?? 0)
});

watch(
    () => selectionStore.selected,
    () => refreshGroupPhasePresentation(),
    { deep: true }
);

function beginNewPhase() {
    startNewGroupPhase();
}

function focus(phaseId: string) {
    focusGroupPhase(phaseId);
}

function dragStart(phaseId: string) {
    draggedPhaseId.value = phaseId;
}

function drop(phaseId: string) {
    const sourceId = draggedPhaseId.value;
    draggedPhaseId.value = null;
    if (!sourceId || sourceId === phaseId) {
        return;
    }
    const ids = phases.value.map((phase) => phase.id);
    const sourceIndex = ids.indexOf(sourceId);
    const targetIndex = ids.indexOf(phaseId);
    if (sourceIndex < 0 || targetIndex < 0) {
        return;
    }
    ids.splice(sourceIndex, 1);
    ids.splice(targetIndex, 0, sourceId);
    reorderGroupPhases(ids);
}

function move(phaseId: string, offset: number) {
    const ids = phases.value.map((phase) => phase.id);
    const sourceIndex = ids.indexOf(phaseId);
    const targetIndex = sourceIndex + offset;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= ids.length) {
        return;
    }
    ids.splice(sourceIndex, 1);
    ids.splice(targetIndex, 0, phaseId);
    reorderGroupPhases(ids);
}
</script>

<template>
    <div
        v-movable-panel
        v-if="isOpen"
        ref="dialog"
        role="dialog"
        aria-labelledby="group-phases-dialog-title"
        class="fixed bottom-0 left-1/2 z-[10000] flex max-h-[40vh] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-t-lg border border-gray-200 bg-white shadow-2xl"
    >
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
                <h2 id="group-phases-dialog-title" class="text-base font-semibold text-gray-800">
                    {{ group?.name }} / {{ version?.name }} phases
                </h2>
                <p class="text-xs text-gray-500">
                    {{ version?.members.length ?? 0 }} version features
                </p>
            </div>
            <button
                type="button"
                aria-label="Close phases"
                class="rounded px-2 text-xl leading-none text-gray-400 hover:text-gray-700"
                @click="closeGroupPhases"
            >
                &times;
            </button>
        </div>

        <div class="space-y-3 overflow-y-auto px-4 py-4">
            <GroupPhaseDraftNotice
                v-if="groupStore.phaseDraftActive"
                :editing-phase-number="editingPhaseNumber"
                :next-phase-number="phases.length + 1"
            />

            <div
                v-if="phases.length === 0 && !groupStore.phaseDraftActive"
                class="text-sm text-gray-500"
            >
                No phases have been saved for this version.
            </div>
            <div v-else class="space-y-2" role="list" aria-label="Group phases">
                <div
                    v-for="(phase, index) in phases"
                    :key="phase.id"
                    role="listitem"
                    draggable="true"
                    class="flex items-center gap-2 rounded-lg border px-3 py-2"
                    :class="
                        groupStore.focusedPhaseId === phase.id
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200'
                    "
                    @dragstart="dragStart(phase.id)"
                    @dragover.prevent
                    @drop="drop(phase.id)"
                    @keydown.up.prevent="move(phase.id, -1)"
                    @keydown.down.prevent="move(phase.id, 1)"
                >
                    <span class="cursor-grab text-gray-400" aria-hidden="true">&#8942;&#8942;</span>
                    <button
                        type="button"
                        class="min-w-0 flex-1 text-left text-sm font-medium text-gray-700"
                        :aria-label="`Edit Phase ${index + 1}`"
                        aria-keyshortcuts="ArrowUp ArrowDown"
                        @click="focus(phase.id)"
                    >
                        Phase {{ index + 1 }}
                    </button>
                    <span class="text-xs text-gray-500">
                        {{ phase.members.length }} feature{{
                            phase.members.length === 1 ? '' : 's'
                        }}
                    </span>
                </div>
            </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
            <button
                type="button"
                class="rounded bg-green-700 px-3 py-1.5 text-xs font-medium text-white"
                @click="beginNewPhase"
            >
                New phase
            </button>
            <button
                type="button"
                class="rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-700"
                @click="closeGroupPhases"
            >
                Close
            </button>
        </div>
    </div>
</template>
