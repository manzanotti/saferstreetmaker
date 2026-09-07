<script setup lang="ts">
defineProps<{
    groupName: string;
}>();

const emit = defineEmits<{
    delete: [];
    keep: [];
}>();
</script>

<template>
    <div class="space-y-2">
        <p class="text-sm text-gray-700">
            <strong>{{ groupName }}</strong> is now empty. Delete the group too?
        </p>
        <div class="flex gap-2">
            <button
                type="button"
                class="rounded bg-red-600 px-3 py-1 text-xs text-white"
                @click="emit('delete')"
            >
                Delete
            </button>
            <button
                type="button"
                class="rounded border border-gray-200 px-3 py-1 text-xs"
                @click="emit('keep')"
            >
                Keep empty
            </button>
        </div>
    </div>
</template>
