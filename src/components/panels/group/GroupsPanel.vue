<script setup lang="ts">
import { useGroupsPanel } from '../../../composables/groups/useGroupsPanel';
import GroupPanelList from './GroupPanelList.vue';
import GroupsMasterVisibilityToggle from './GroupsMasterVisibilityToggle.vue';
import GroupsPanelEmptyState from './GroupsPanelEmptyState.vue';
import GroupsPanelHeader from './GroupsPanelHeader.vue';

const {
    groupStore,
    allHidden,
    memberCountByGroupId,
    pendingDeleteGroupId,
    pendingEmptyGroupDeletionId,
    cancelDelete,
    closePanel,
    confirmDelete,
    deleteEmptyGroup,
    keepEmptyGroup,
    onDeleteRequest,
    openGroupDetails,
    setAllGroupsVisibility,
    toggleGroupVisibility
} = useGroupsPanel();
</script>

<template>
    <div
        role="dialog"
        aria-labelledby="groups-panel-title"
        class="fixed top-1/2 left-1/2 z-[10001] flex max-h-[90vh] w-96 -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
        @dblclick.stop
    >
        <GroupsPanelHeader @close="closePanel" />

        <GroupsMasterVisibilityToggle
            v-if="groupStore.groups.length > 0"
            :all-hidden="allHidden"
            @toggle="setAllGroupsVisibility(!allHidden)"
        />

        <div class="flex-1 overflow-y-auto">
            <GroupsPanelEmptyState v-if="groupStore.groups.length === 0" />
            <GroupPanelList
                v-else
                :groups="groupStore.groups"
                :member-count-by-group-id="memberCountByGroupId"
                :hidden-group-ids="groupStore.hiddenGroupIds"
                :pending-delete-group-id="pendingDeleteGroupId"
                :pending-empty-group-deletion-id="pendingEmptyGroupDeletionId"
                @select="openGroupDetails"
                @toggle-visibility="toggleGroupVisibility"
                @delete-request="onDeleteRequest"
                @confirm-delete="confirmDelete"
                @cancel-delete="cancelDelete"
                @delete-empty="deleteEmptyGroup"
                @keep-empty="keepEmptyGroup"
            />
        </div>
    </div>
</template>
