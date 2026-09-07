<script setup lang="ts">
import type { Group } from '../../../models/Group';
import GroupPanelRow from './GroupPanelRow.vue';

defineProps<{
    groups: Group[];
    memberCountByGroupId: Record<string, number>;
    hiddenGroupIds: Set<string>;
    pendingDeleteGroupId: string | null;
    pendingEmptyGroupDeletionId: string | null;
}>();

const emit = defineEmits<{
    select: [groupId: string];
    toggleVisibility: [groupId: string];
    deleteRequest: [groupId: string];
    confirmDelete: [deleteElements: boolean];
    cancelDelete: [];
    deleteEmpty: [groupId: string];
    keepEmpty: [];
}>();
</script>

<template>
    <ul class="divide-y divide-gray-100">
        <GroupPanelRow
            v-for="group in groups"
            :key="group.id"
            :group="group"
            :member-count="memberCountByGroupId[group.id] ?? 0"
            :hidden="hiddenGroupIds.has(group.id)"
            :delete-confirmation-open="pendingDeleteGroupId === group.id"
            :empty-deletion-open="pendingEmptyGroupDeletionId === group.id"
            @select="emit('select', group.id)"
            @toggle-visibility="emit('toggleVisibility', group.id)"
            @delete-request="emit('deleteRequest', group.id)"
            @confirm-delete="emit('confirmDelete', $event)"
            @cancel-delete="emit('cancelDelete')"
            @delete-empty="emit('deleteEmpty', group.id)"
            @keep-empty="emit('keepEmpty')"
        />
    </ul>
</template>
