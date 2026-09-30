<script setup lang="ts">
import type { Group } from '../../../models/Group';
import EmptyGroupDeletionPrompt from './EmptyGroupDeletionPrompt.vue';
import GroupDeleteConfirmation from './GroupDeleteConfirmation.vue';
import GroupPanelDefaultRow from './GroupPanelDefaultRow.vue';

defineProps<{
    group: Group;
    memberCount: number;
    hidden: boolean;
    solo?: boolean;
    soloActive?: boolean;
    deleteConfirmationOpen: boolean;
    emptyDeletionOpen: boolean;
}>();

const emit = defineEmits<{
    select: [];
    toggleVisibility: [];
    deleteRequest: [];
    confirmDelete: [deleteElements: boolean];
    cancelDelete: [];
    deleteEmpty: [];
    keepEmpty: [];
}>();
</script>

<template>
    <li class="px-4 py-3">
        <GroupDeleteConfirmation
            v-if="deleteConfirmationOpen"
            :group-name="group.name"
            :member-count="memberCount"
            @confirm="emit('confirmDelete', $event)"
            @cancel="emit('cancelDelete')"
        />
        <EmptyGroupDeletionPrompt
            v-else-if="emptyDeletionOpen"
            :group-name="group.name"
            @delete="emit('deleteEmpty')"
            @keep="emit('keepEmpty')"
        />
        <GroupPanelDefaultRow
            v-else
            :group="group"
            :member-count="memberCount"
            :hidden="hidden"
            :solo="solo"
            :solo-active="soloActive"
            @select="emit('select')"
            @toggle-visibility="emit('toggleVisibility')"
            @delete-request="emit('deleteRequest')"
        />
    </li>
</template>
