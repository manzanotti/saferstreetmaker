<script setup lang="ts">
defineProps<{
    groupName: string;
    memberCount: number;
}>();

const emit = defineEmits<{
    confirm: [deleteElements: boolean];
    cancel: [];
}>();
</script>

<template>
    <div class="space-y-2">
        <p class="text-sm text-gray-700">
            Delete <strong>{{ groupName }}</strong
            >? Choose whether to keep or delete its {{ memberCount }} member{{
                memberCount === 1 ? '' : 's'
            }}.
        </p>
        <div class="flex flex-wrap gap-2">
            <button
                type="button"
                class="rounded border border-gray-200 px-3 py-1 text-xs"
                @click="emit('confirm', false)"
            >
                Delete group only
            </button>
            <button
                type="button"
                class="rounded bg-red-600 px-3 py-1 text-xs text-white"
                @click="emit('confirm', true)"
            >
                Delete group + elements
            </button>
            <button
                type="button"
                class="rounded border border-gray-200 px-3 py-1 text-xs"
                @click="emit('cancel')"
            >
                Cancel
            </button>
        </div>
    </div>
</template>
