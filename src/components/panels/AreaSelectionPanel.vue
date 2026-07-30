<script setup lang="ts">
import { computed } from 'vue';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { executeAreaDelete, executeCopy, executePaste } from '../../composables/useAreaSelection';
import {
    createGroupFromSelection,
    addSelectionToGroup,
    saveGroupSelection
} from '../../composables/useGroups';

const selectionStore = useSelectionStore();
const groupStore = useGroupStore();

// Multiple vertex entries from the same polyline/polygon share the same
// marker reference; count unique features rather than raw vertex entries.
const featureCount = computed(
    () =>
        new Set(
            selectionStore.selected.map((selection) =>
                selection.historyId
                    ? `${selection.layerId}:${selection.historyId}`
                    : selection.marker
            )
        ).size
);

// The group being targeted by a group-first "Add features" flow, if any.
const addTargetGroup = computed(() =>
    groupStore.addToGroupId
        ? (groupStore.groups.find((g) => g.id === groupStore.addToGroupId) ?? null)
        : null
);

// Show the "Add to group" dropdown when features are selected, groups exist,
// and we are not already mid-flow (add target set / dialogs open).
const showAddToGroupDropdown = computed(
    () =>
        featureCount.value > 0 &&
        groupStore.groups.length > 0 &&
        !groupStore.addToGroupId &&
        !groupStore.nameDialogOpen &&
        !groupStore.splitDialogOpen
);

function onAddToGroupSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const groupId = select.value;
    if (groupId) {
        addSelectionToGroup(groupId);
    }
    // Reset so the placeholder shows again if the panel stays open.
    select.value = '';
}
</script>

<template>
    <div
        v-if="
            selectionStore.isActive &&
            (featureCount > 0 || selectionStore.hasClipboard || selectionStore.isGroupSelection)
        "
        class="rounded-2xl bg-white/[0.94] shadow-xl border border-white/60 flex items-center gap-2 px-3 py-2"
    >
        <span v-if="featureCount > 0" class="text-sm text-gray-700 font-medium">
            {{ featureCount }}
            {{ featureCount === 1 ? 'feature' : 'features' }} selected
        </span>
        <button
            v-if="featureCount > 0"
            type="button"
            aria-label="Copy selected features"
            class="rounded-lg bg-slate-50 hover:bg-green-100 border border-gray-200 text-gray-700 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
            @click.stop="executeCopy"
        >
            Copy
        </button>
        <button
            v-if="selectionStore.hasClipboard"
            type="button"
            aria-label="Paste copied features"
            class="rounded-lg bg-slate-50 hover:bg-green-100 border border-gray-200 text-gray-700 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
            @click.stop="executePaste"
        >
            Paste
        </button>
        <!-- Group-first: confirm adding the selection to the targeted group. -->
        <button
            v-if="addTargetGroup && featureCount > 0 && !groupStore.splitDialogOpen"
            type="button"
            :aria-label="`Add selected features to group ${addTargetGroup.name}`"
            class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
            @click.stop="addSelectionToGroup(addTargetGroup.id)"
        >
            Add to {{ addTargetGroup.name }}
        </button>
        <button
            v-if="selectionStore.isGroupSelection && selectionStore.selectedGroupId"
            type="button"
            aria-label="Save group changes"
            class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
            @click.stop="saveGroupSelection"
        >
            Save group changes
        </button>
        <button
            v-if="
                featureCount > 0 &&
                !groupStore.addToGroupId &&
                !groupStore.nameDialogOpen &&
                !groupStore.splitDialogOpen
            "
            type="button"
            aria-label="Add selected features to a group"
            class="rounded-lg bg-slate-50 hover:bg-green-100 border border-gray-200 text-gray-700 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
            @click.stop="createGroupFromSelection"
        >
            Group
        </button>
        <!-- Selection-first: fold the selection into an existing group. -->
        <select
            v-if="showAddToGroupDropdown"
            aria-label="Add selected features to an existing group"
            class="rounded-lg bg-slate-50 hover:bg-green-100 border border-gray-200 text-gray-700 px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
            @change.stop="onAddToGroupSelect"
        >
            <option value="">Add to group…</option>
            <option v-for="g in groupStore.groups" :key="g.id" :value="g.id">
                {{ g.name }}
            </option>
        </select>
        <button
            v-if="featureCount > 0 && !selectionStore.isGroupSelection"
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
