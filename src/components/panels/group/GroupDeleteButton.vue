<script setup lang="ts">
defineProps<{
    groupName: string;
}>();

const emit = defineEmits<{
    deleteRequest: [];
}>();
</script>

<template>
    <button
        type="button"
        :aria-label="`Delete group ${groupName}`"
        :title="`Delete group ${groupName}`"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
        @click="emit('deleteRequest')"
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
</template>
