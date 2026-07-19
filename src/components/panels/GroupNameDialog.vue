<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useGroupStore } from '../../stores/groupStore';
import { finalizeCreateGroup, finalizeRenameGroup } from '../../composables/useGroups';

const groupStore = useGroupStore();

const inputName = ref('');
const inputEl = ref<HTMLInputElement | null>(null);

const isRename = computed(() => groupStore.renameGroupId !== null);
const dialogTitle = computed(() => (isRename.value ? 'Rename Group' : 'New Group'));

// Pre-fill the input when renaming, and focus it whenever the dialog opens.
watch(
    () => groupStore.nameDialogOpen,
    (open) => {
        if (!open) {
            inputName.value = '';
            return;
        }
        if (isRename.value) {
            const group = groupStore.groups.find((g) => g.id === groupStore.renameGroupId);
            inputName.value = group?.name ?? '';
        } else {
            inputName.value = '';
        }
        // Focus after the dialog DOM has been inserted.
        void nextTick(() => inputEl.value?.focus());
    }
);

function onSave() {
    const trimmed = inputName.value.trim();
    if (!trimmed) {
        return;
    }
    if (isRename.value && groupStore.renameGroupId) {
        finalizeRenameGroup(groupStore.renameGroupId, trimmed);
    } else {
        finalizeCreateGroup(trimmed);
    }
}

function onCancel() {
    groupStore.clearPendingState();
    groupStore.closeNameDialog();
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
        onSave();
    } else if (e.key === 'Escape') {
        onCancel();
    }
}
</script>

<template>
    <div
        v-if="groupStore.nameDialogOpen"
        role="dialog"
        :aria-labelledby="'group-name-dialog-title'"
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] rounded-2xl bg-white shadow-xl border border-gray-100 w-80 flex flex-col overflow-hidden"
        @dblclick.stop
        @keydown="onKeydown"
    >
        <div class="flex items-center px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 id="group-name-dialog-title" class="text-base font-semibold text-gray-800">
                {{ dialogTitle }}
            </h2>
        </div>
        <div class="px-5 py-4 space-y-4">
            <div>
                <label for="group-name-input" class="block text-sm font-medium text-gray-700 mb-1"
                    >Group name</label
                >
                <input
                    id="group-name-input"
                    ref="inputEl"
                    v-model="inputName"
                    type="text"
                    placeholder="Enter group name"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
            </div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
            <button
                type="button"
                class="rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-gray-700 px-4 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                @click="onCancel"
            >
                Cancel
            </button>
            <button
                type="button"
                :disabled="!inputName.trim()"
                class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                @click="onSave"
            >
                Save
            </button>
        </div>
    </div>
</template>
