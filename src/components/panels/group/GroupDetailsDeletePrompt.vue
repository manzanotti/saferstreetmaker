<script setup lang="ts">
defineProps<{
    groupName: string;
}>();

const emit = defineEmits<{
    confirm: [deleteElements: boolean];
    cancel: [];
}>();
</script>

<template>
    <section class="border-t border-red-100 pt-3">
        <div class="space-y-2 rounded border border-red-100 bg-red-50 p-3 text-xs text-gray-700">
            <p>
                Delete <strong>{{ groupName }}</strong
                >? Choose whether to keep its elements.
            </p>
            <div class="flex flex-wrap gap-2">
                <button
                    type="button"
                    class="rounded border border-gray-200 bg-white px-2 py-1"
                    @click="emit('confirm', false)"
                >
                    Delete group only
                </button>
                <button
                    type="button"
                    class="rounded bg-red-600 px-2 py-1 text-white"
                    @click="emit('confirm', true)"
                >
                    Delete group + elements
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
    </section>
</template>
