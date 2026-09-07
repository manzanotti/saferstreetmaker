<script setup lang="ts">
import type { Group } from '../../../models/Group';
import GroupDeleteButton from './GroupDeleteButton.vue';
import GroupVisibilityButton from './GroupVisibilityButton.vue';

defineProps<{
    group: Group;
    memberCount: number;
    hidden: boolean;
}>();

const emit = defineEmits<{
    select: [];
    toggleVisibility: [];
    deleteRequest: [];
}>();
</script>

<template>
    <div class="flex items-center gap-2">
        <button
            type="button"
            :aria-label="`Select group ${group.name}`"
            :class="[
                'min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-sm font-medium hover:text-green-700',
                hidden ? 'text-gray-400 line-through' : 'text-gray-800'
            ]"
            @click="emit('select')"
        >
            {{ group.name }}
            <span class="text-xs font-normal text-gray-400">({{ memberCount }})</span>
        </button>
        <GroupVisibilityButton
            :group-name="group.name"
            :hidden="hidden"
            @toggle="emit('toggleVisibility')"
        />
        <GroupDeleteButton :group-name="group.name" @delete-request="emit('deleteRequest')" />
    </div>
</template>
