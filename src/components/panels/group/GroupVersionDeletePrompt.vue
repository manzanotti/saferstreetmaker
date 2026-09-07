<script setup lang="ts">
defineProps<{
    versionName: string;
    memberCount: number;
}>();

const emit = defineEmits<{
    confirm: [deleteElements: boolean];
    cancel: [];
}>();
</script>

<template>
    <div class="mt-3 space-y-2 rounded border border-red-100 bg-red-50 p-3 text-xs text-gray-700">
        <p>
            Delete version <strong>{{ versionName }}</strong
            >? Choose whether to keep its {{ memberCount }} element{{
                memberCount === 1 ? '' : 's'
            }}.
        </p>
        <div class="flex flex-wrap gap-2">
            <button
                type="button"
                class="rounded border border-gray-200 bg-white px-2 py-1"
                @click="emit('confirm', false)"
            >
                Delete version only
            </button>
            <button
                type="button"
                class="rounded bg-red-600 px-2 py-1 text-white"
                @click="emit('confirm', true)"
            >
                Delete version + elements
            </button>
            <button
                type="button"
                class="rounded border border-gray-200 bg-white px-2 py-1"
                @click="emit('cancel')"
            >
                Cancel
            </button>
        </div>
    </div>
</template>
