<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useGroupStore } from '../../stores/groupStore';
import { useUiStore } from '../../stores/uiStore';
import { getActiveVersion, getGroupVersions, memberKey } from '../../features/groups/groupVersions';
import {
    deleteGroup,
    deleteGroupWithElements,
    openGroupDetails,
    setAllGroupsVisibility,
    toggleGroupVisibility
} from '../../composables/useGroups';

const groupStore = useGroupStore();
const uiStore = useUiStore();
const pendingConfirm = ref<{ type: 'deleteGroup'; groupId: string } | null>(null);
const pendingEmptyGroupDeletionId = computed(() => groupStore.pendingEmptyGroupDeletionId);
const memberCountByGroupId = computed<Record<string, number>>(() =>
    Object.fromEntries(
        groupStore.groups.map((group) => [
            group.id,
            new Set(
                getActiveVersion(group, groupStore.activeVersionIds[group.id]).members.map(
                    memberKey
                )
            ).size
        ])
    )
);
const allHidden = computed(
    () =>
        groupStore.groups.length > 0 &&
        groupStore.groups.every((group) => groupStore.hiddenGroupIds.has(group.id))
);

function closePanel() {
    uiStore.closePanel();
    (document.activeElement as HTMLElement | null)?.blur();
}

function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') {
        return;
    }
    if (pendingConfirm.value) {
        pendingConfirm.value = null;
        return;
    }
    if (pendingEmptyGroupDeletionId.value) {
        groupStore.setPendingEmptyGroupDeletion(null);
        return;
    }
    closePanel();
}

function onDeleteRequest(groupId: string) {
    const memberCount = memberCountByGroupId.value[groupId] ?? 0;
    if (memberCount === 0) {
        deleteGroup(groupId);
        return;
    }
    pendingConfirm.value = { type: 'deleteGroup', groupId };
}

function confirmDelete(deleteElements: boolean) {
    const groupId = pendingConfirm.value?.groupId;
    if (!groupId) {
        return;
    }
    if (deleteElements) {
        deleteGroupWithElements(groupId);
    } else {
        deleteGroup(groupId);
    }
    pendingConfirm.value = null;
}

onMounted(() => {
    groupStore.closeDetailsDialog();
    document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
    <div
        role="dialog"
        aria-labelledby="groups-panel-title"
        class="fixed top-1/2 left-1/2 z-[10001] flex max-h-[90vh] w-96 -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
        @dblclick.stop
    >
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 id="groups-panel-title" class="text-base font-semibold text-gray-800">Groups</h2>
            <button
                type="button"
                aria-label="Close groups panel"
                class="rounded text-gray-400 hover:text-gray-600"
                @click="closePanel"
            >
                <span aria-hidden="true" class="text-xl leading-none">&times;</span>
            </button>
        </div>

        <div v-if="groupStore.groups.length > 0" class="border-b border-gray-100 px-5 py-3">
            <div class="toggle-row">
                <span class="text-sm text-gray-700">Hide all groups</span>
                <div class="toggle">
                    <input
                        id="groups-master-toggle"
                        type="checkbox"
                        :checked="allHidden"
                        aria-label="Hide all groups"
                        @change="setAllGroupsVisibility(!allHidden)"
                    />
                    <label for="groups-master-toggle" class="sr-only">Hide all groups</label>
                </div>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto">
            <p
                v-if="groupStore.groups.length === 0"
                class="px-5 py-6 text-center text-sm text-gray-500"
            >
                No groups yet. Select multiple features and click <strong>Group</strong>.
            </p>
            <ul v-else class="divide-y divide-gray-100">
                <li v-for="group in groupStore.groups" :key="group.id" class="px-4 py-3">
                    <div v-if="pendingConfirm?.groupId === group.id" class="space-y-2">
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
                                class="rounded border border-gray-200 px-3 py-1 text-xs"
                                @click="confirmDelete(false)"
                            >
                                Delete group only
                            </button>
                            <button
                                type="button"
                                class="rounded bg-red-600 px-3 py-1 text-xs text-white"
                                @click="confirmDelete(true)"
                            >
                                Delete group + elements
                            </button>
                            <button
                                type="button"
                                class="rounded border border-gray-200 px-3 py-1 text-xs"
                                @click="pendingConfirm = null"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                    <div v-else-if="pendingEmptyGroupDeletionId === group.id" class="space-y-2">
                        <p class="text-sm text-gray-700">
                            <strong>{{ group.name }}</strong> is now empty. Delete the group too?
                        </p>
                        <div class="flex gap-2">
                            <button
                                type="button"
                                class="rounded bg-red-600 px-3 py-1 text-xs text-white"
                                @click="
                                    deleteGroup(group.id);
                                    groupStore.setPendingEmptyGroupDeletion(null);
                                "
                            >
                                Delete
                            </button>
                            <button
                                type="button"
                                class="rounded border border-gray-200 px-3 py-1 text-xs"
                                @click="groupStore.setPendingEmptyGroupDeletion(null)"
                            >
                                Keep empty
                            </button>
                        </div>
                    </div>
                    <div v-else class="flex items-center gap-2">
                        <button
                            type="button"
                            :aria-label="`Select group ${group.name}`"
                            :class="[
                                'min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-sm font-medium hover:text-green-700',
                                groupStore.hiddenGroupIds.has(group.id)
                                    ? 'text-gray-400 line-through'
                                    : 'text-gray-800'
                            ]"
                            @click="openGroupDetails(group.id)"
                        >
                            {{ group.name }}
                            <span class="text-xs font-normal text-gray-400"
                                >({{ memberCountByGroupId[group.id] }})</span
                            >
                        </button>
                        <button
                            type="button"
                            :aria-label="
                                groupStore.hiddenGroupIds.has(group.id)
                                    ? `Show group ${group.name}`
                                    : `Hide group ${group.name}`
                            "
                            :title="
                                groupStore.hiddenGroupIds.has(group.id)
                                    ? `Show group ${group.name}`
                                    : `Hide group ${group.name}`
                            "
                            class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-slate-100"
                            @click="toggleGroupVisibility(group.id)"
                        >
                            <svg
                                v-if="groupStore.hiddenGroupIds.has(group.id)"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="h-4 w-4"
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
                                class="h-4 w-4"
                                aria-hidden="true"
                            >
                                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            :aria-label="`Delete group ${group.name}`"
                            :title="`Delete group ${group.name}`"
                            class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                            @click="onDeleteRequest(group.id)"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="h-4 w-4"
                                aria-hidden="true"
                            >
                                <path d="M3 6h18" />
                                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                            </svg>
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</template>
