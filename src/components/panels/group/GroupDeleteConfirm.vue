<script setup lang="ts">
defineProps<{
    onlyLabel: string;
    withElementsLabel: string;
}>();

const emit = defineEmits<{
    (e: 'confirm', deleteElements: boolean): void;
    (e: 'cancel'): void;
}>();
</script>

<template>
    <div class="space-y-2 rounded border border-red-100 bg-red-50 p-3 text-xs text-gray-700">
        <p><slot name="message" /></p>
        <div class="flex flex-wrap gap-2">
            <button
                type="button"
                class="rounded border border-gray-200 bg-white px-2 py-1"
                @click="emit('confirm', false)"
            >
                {{ onlyLabel }}
            </button>
            <button
                type="button"
                class="rounded bg-red-600 px-2 py-1 text-white"
                @click="emit('confirm', true)"
            >
                {{ withElementsLabel }}
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
