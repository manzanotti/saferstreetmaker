<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useGroupStore } from '../../stores/groupStore';
import { useUiStore } from '../../stores/uiStore';
import {
    getActiveVersion,
    getDefaultVersionId,
    getGroupVersions
} from '../../features/groups/groupVersions';
import GroupVersionNameDialog from './GroupVersionNameDialog.vue';
import {
    selectGroup,
    deleteGroupWithElements,
    removeAllGroupElements,
    deleteGroup,
    toggleGroupVisibility,
    setAllGroupsVisibility,
    beginAddToGroup,
    createGroupVersion,
    switchGroupVersion,
    setGroupDefaultVersion,
    deleteGroupVersion
} from '../../composables/useGroups';

const groupStore = useGroupStore();
const uiStore = useUiStore();
const versionsByGroupId = computed(() =>
    Object.fromEntries(groupStore.groups.map((group) => [group.id, getGroupVersions(group)]))
);
const memberCountByGroupId = computed<Record<string, number>>(() =>
    Object.fromEntries(
        groupStore.groups.map((group) => [
            group.id,
            getActiveVersion(group, groupStore.activeVersionIds[group.id]).members.length
        ])
    )
);
const versionDialogOpen = ref(false);
const versionDialogGroupId = ref<string | null>(null);
const versionDialogError = ref('');
const versionDialogGroupName = computed(() => {
    const group = groupStore.groups.find((item) => item.id === versionDialogGroupId.value);
    return group?.name ?? '';
});

/** Inline confirmation state: pending action awaiting user confirm. */
const pendingConfirm = ref<
    | { type: 'deleteWithElements'; groupId: string }
    | { type: 'deleteEmpty'; groupId: string }
    | null
>(null);

function closePanel() {
    uiStore.closePanel();
    (document.activeElement as HTMLElement | null)?.blur();
}

/** Close the panel on Escape. If an inline confirmation is open, Escape
 * dismisses that first so it does not close the whole panel unexpectedly. */
function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') {
        return;
    }
    if (pendingConfirm.value !== null) {
        pendingConfirm.value = null;
        return;
    }
    closePanel();
}

onMounted(() => {
    document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown);
});

const allHidden = computed(
    () =>
        groupStore.groups.length > 0 &&
        groupStore.groups.every((g) => groupStore.hiddenGroupIds.has(g.id))
);

function onToggleMasterVisibility() {
    setAllGroupsVisibility(!allHidden.value);
}

function onSelectGroup(id: string) {
    selectGroup(id);
    uiStore.closePanel();
}

function onAddFeatures(id: string) {
    // Group-first flow: close the panel, activate area selection, and target
    // this group so the selection toolbar shows an "Add to <group>" action.
    beginAddToGroup(id);
    uiStore.closePanel();
}

function onToggleVisibility(id: string) {
    toggleGroupVisibility(id);
}

function onRename(id: string) {
    groupStore.openNameDialog(id);
}

function onRemoveMembers(id: string) {
    removeAllGroupElements(id);
    pendingConfirm.value = { type: 'deleteEmpty', groupId: id };
}

function onVersionChange(groupId: string, event: Event) {
    const versionId = (event.target as HTMLSelectElement).value;
    switchGroupVersion(groupId, versionId);
}

function onCreateVersion(groupId: string) {
    versionDialogGroupId.value = groupId;
    versionDialogError.value = '';
    versionDialogOpen.value = true;
}

function onCancelCreateVersion() {
    versionDialogOpen.value = false;
    versionDialogGroupId.value = null;
    versionDialogError.value = '';
}

function onSubmitCreateVersion(name: string) {
    if (!versionDialogGroupId.value) {
        return;
    }
    if (!createGroupVersion(versionDialogGroupId.value, name)) {
        versionDialogError.value = 'Enter a unique version name.';
        return;
    }
    onCancelCreateVersion();
}

function onSetDefaultVersion(groupId: string, versionId: string) {
    setGroupDefaultVersion(groupId, versionId);
}

function onDeleteVersion(groupId: string, versionId: string) {
    deleteGroupVersion(groupId, versionId);
}

function onConfirmDeleteEmpty() {
    if (pendingConfirm.value?.type === 'deleteEmpty') {
        deleteGroup(pendingConfirm.value.groupId);
    }
    pendingConfirm.value = null;
}

function onCancelConfirm() {
    pendingConfirm.value = null;
}

function onRequestDeleteWithElements(id: string) {
    pendingConfirm.value = { type: 'deleteWithElements', groupId: id };
}

function onConfirmDeleteGroupOnly() {
    if (pendingConfirm.value?.type === 'deleteWithElements') {
        deleteGroup(pendingConfirm.value.groupId);
    }
    pendingConfirm.value = null;
}

function onConfirmDeleteWithElements() {
    if (pendingConfirm.value?.type === 'deleteWithElements') {
        deleteGroupWithElements(pendingConfirm.value.groupId);
    }
    pendingConfirm.value = null;
}
</script>

<template>
    <div
        role="dialog"
        aria-labelledby="groups-panel-title"
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-9999 rounded-2xl bg-white shadow-xl border border-gray-100 w-96 flex flex-col overflow-hidden max-h-[90vh]"
        @dblclick.stop
    >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 id="groups-panel-title" class="text-base font-semibold text-gray-800">Groups</h2>
            <button
                type="button"
                aria-label="Close groups panel"
                class="text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 rounded"
                @click="closePanel"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="w-4 h-4"
                    aria-hidden="true"
                >
                    <path d="M18 6 6 18M6 6l12 12" />
                </svg>
            </button>
        </div>

        <!-- Master show/hide toggle -->
        <div
            v-if="groupStore.groups.length > 0"
            class="px-5 py-3 border-b border-gray-100 shrink-0"
        >
            <div class="toggle-row">
                <span class="text-sm text-gray-700">Hide all groups</span>
                <div class="toggle">
                    <input
                        id="groups-master-toggle"
                        type="checkbox"
                        :checked="allHidden"
                        aria-label="Hide all groups"
                        @change="onToggleMasterVisibility"
                    />
                    <label for="groups-master-toggle" class="sr-only">Hide all groups</label>
                </div>
            </div>
        </div>

        <!-- Group list -->
        <div class="flex-1 overflow-y-auto">
            <p
                v-if="groupStore.groups.length === 0"
                class="px-5 py-6 text-sm text-gray-500 text-center"
            >
                No groups yet. Select multiple features and click&nbsp;<strong>Group</strong>.
            </p>

            <ul v-else class="divide-y divide-gray-100">
                <li v-for="group in groupStore.groups" :key="group.id" class="px-4 py-2">
                    <!-- Inline confirm for delete-with-elements -->
                    <div
                        v-if="
                            pendingConfirm?.type === 'deleteWithElements' &&
                            pendingConfirm.groupId === group.id
                        "
                        class="space-y-2"
                    >
                        <p class="text-sm text-gray-700">
                            Delete <strong>{{ group.name }}</strong
                            >? Choose whether to keep or delete its
                            {{ memberCountByGroupId[group.id] }} member{{
                                memberCountByGroupId[group.id] === 1 ? '' : 's'
                            }}.
                        </p>
                        <div class="flex flex-wrap gap-2">
                            <button
                                type="button"
                                class="rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-gray-700 px-3 py-1 text-xs font-medium focus-visible:outline-none"
                                @click="onConfirmDeleteGroupOnly"
                            >
                                Delete group only
                            </button>
                            <button
                                type="button"
                                class="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs font-medium focus-visible:outline-none"
                                @click="onConfirmDeleteWithElements"
                            >
                                Delete group + elements
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-gray-700 px-3 py-1 text-xs font-medium focus-visible:outline-none"
                                @click="onCancelConfirm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>

                    <!-- Inline confirm for delete-empty-group -->
                    <div
                        v-else-if="
                            pendingConfirm?.type === 'deleteEmpty' &&
                            pendingConfirm.groupId === group.id
                        "
                        class="space-y-2"
                    >
                        <p class="text-sm text-gray-700">
                            <strong>{{ group.name }}</strong> is now empty. Delete the group too?
                        </p>
                        <div class="flex gap-2">
                            <button
                                type="button"
                                class="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1 text-xs font-medium focus-visible:outline-none"
                                @click="onConfirmDeleteEmpty"
                            >
                                Delete
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-gray-700 px-3 py-1 text-xs font-medium focus-visible:outline-none"
                                @click="onCancelConfirm"
                            >
                                Keep empty
                            </button>
                        </div>
                    </div>

                    <!-- Normal group row -->
                    <div v-else class="flex items-center gap-2">
                        <!-- Name — clicking selects + zooms -->
                        <button
                            type="button"
                            :aria-label="`Select group ${group.name}`"
                            :class="[
                                'flex-1 text-left text-sm font-medium truncate rounded px-1 py-0.5',
                                'hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600',
                                groupStore.hiddenGroupIds.has(group.id)
                                    ? 'text-gray-400 line-through'
                                    : 'text-gray-800'
                            ]"
                            @click="onSelectGroup(group.id)"
                        >
                            {{ group.name }}
                            <span class="text-xs text-gray-400 font-normal ml-1"
                                >({{ memberCountByGroupId[group.id] }})</span
                            >
                        </button>

                        <!-- Visibility toggle -->
                        <button
                            type="button"
                            :aria-label="
                                groupStore.hiddenGroupIds.has(group.id)
                                    ? `Show group ${group.name}`
                                    : `Hide group ${group.name}`
                            "
                            :title="
                                groupStore.hiddenGroupIds.has(group.id)
                                    ? 'Show group'
                                    : 'Hide group'
                            "
                            class="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                            @click="onToggleVisibility(group.id)"
                        >
                            <svg
                                v-if="groupStore.hiddenGroupIds.has(group.id)"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="w-4 h-4"
                                aria-hidden="true"
                            >
                                <path d="M3 3l18 18" />
                                <path
                                    d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.4 3.1M6.5 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4-.9"
                                />
                                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                            </svg>
                            <svg
                                v-else
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="w-4 h-4"
                                aria-hidden="true"
                            >
                                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </button>

                        <!-- Add features -->
                        <button
                            type="button"
                            :aria-label="`Add features to group ${group.name}`"
                            title="Add features to group"
                            class="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                            @click="onAddFeatures(group.id)"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="w-4 h-4"
                                aria-hidden="true"
                            >
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                        </button>

                        <!-- Rename -->
                        <button
                            type="button"
                            :aria-label="`Rename group ${group.name}`"
                            title="Rename group"
                            class="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                            @click="onRename(group.id)"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="w-4 h-4"
                                aria-hidden="true"
                            >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                        </button>

                        <!-- Remove all elements -->
                        <button
                            type="button"
                            :aria-label="`Remove all elements from group ${group.name}`"
                            title="Remove all elements from group"
                            class="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                            @click="onRemoveMembers(group.id)"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="w-4 h-4"
                                aria-hidden="true"
                            >
                                <circle cx="12" cy="12" r="9" />
                                <path d="M8 12h8" />
                            </svg>
                        </button>

                        <!-- Delete group (offers group-only or group + elements) -->
                        <button
                            type="button"
                            :aria-label="`Delete group ${group.name}`"
                            title="Delete group"
                            class="shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-500 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            @click="onRequestDeleteWithElements(group.id)"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="w-4 h-4"
                                aria-hidden="true"
                            >
                                <path d="M3 6h18" />
                                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                            </svg>
                        </button>
                    </div>
                    <div
                        v-if="versionsByGroupId[group.id]?.length"
                        class="mt-2 flex items-center gap-2"
                    >
                        <label
                            v-if="versionsByGroupId[group.id].length > 1"
                            :for="`group-version-${group.id}`"
                            class="sr-only"
                        >
                            Group version
                        </label>
                        <div
                            v-if="versionsByGroupId[group.id].length === 1"
                            class="min-w-0 flex-1"
                            aria-hidden="true"
                        ></div>
                        <select
                            v-else
                            :id="`group-version-${group.id}`"
                            class="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                            :value="groupStore.activeVersionIds[group.id]"
                            :aria-label="`Version for group ${group.name}`"
                            @change="onVersionChange(group.id, $event)"
                        >
                            <option
                                v-for="version in versionsByGroupId[group.id]"
                                :key="version.id"
                                :value="version.id"
                            >
                                {{ version.name }}
                            </option>
                        </select>
                        <button
                            type="button"
                            class="w-20 shrink-0 rounded border border-gray-200 px-2 py-1 text-center text-xs text-gray-600 hover:bg-gray-50"
                            aria-label="Create version"
                            @click="onCreateVersion(group.id)"
                        >
                            + Version
                        </button>
                        <button
                            type="button"
                            :class="[
                                'w-24 shrink-0 rounded border px-2 py-1 text-center text-xs transition-colors',
                                getDefaultVersionId(group) === groupStore.activeVersionIds[group.id]
                                    ? 'border-green-200 bg-green-50 text-green-700'
                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            ]"
                            aria-label="Set default version"
                            :aria-pressed="
                                getDefaultVersionId(group) === groupStore.activeVersionIds[group.id]
                            "
                            @click="
                                onSetDefaultVersion(group.id, groupStore.activeVersionIds[group.id])
                            "
                        >
                            <span aria-hidden="true">
                                {{
                                    getDefaultVersionId(group) ===
                                    groupStore.activeVersionIds[group.id]
                                        ? 'Default ✓'
                                        : 'Set default'
                                }}
                            </span>
                        </button>
                        <button
                            v-if="versionsByGroupId[group.id].length > 1"
                            type="button"
                            class="w-16 shrink-0 rounded border border-red-100 px-2 py-1 text-center text-xs text-red-600 hover:bg-red-50"
                            aria-label="Delete version"
                            @click="
                                onDeleteVersion(group.id, groupStore.activeVersionIds[group.id])
                            "
                        >
                            Delete
                        </button>
                        <span
                            v-else
                            class="invisible w-16 shrink-0 rounded border border-red-100 px-2 py-1 text-center text-xs"
                            aria-hidden="true"
                        >
                            Delete
                        </span>
                    </div>
                </li>
            </ul>
        </div>
    </div>
    <GroupVersionNameDialog
        :open="versionDialogOpen"
        :group-name="versionDialogGroupName"
        :error-message="versionDialogError"
        @submit="onSubmitCreateVersion"
        @cancel="onCancelCreateVersion"
    />
</template>
