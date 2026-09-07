<script setup lang="ts">
defineProps<{
    groupName: string;
    hidden: boolean;
}>();

const emit = defineEmits<{
    toggle: [];
}>();
</script>

<template>
    <button
        type="button"
        :aria-label="hidden ? `Show group ${groupName}` : `Hide group ${groupName}`"
        :title="hidden ? `Show group ${groupName}` : `Hide group ${groupName}`"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-slate-100"
        @click="emit('toggle')"
    >
        <svg
            v-if="hidden"
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
</template>
