<script setup lang="ts">
const emit = defineEmits<{
    cancel: [];
    add: [];
}>();
</script>

<template>
    <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
        <button
            type="button"
            class="rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-700 px-4 py-2 text-sm font-medium"
            @click="emit('cancel')"
        >
            Cancel
        </button>
        <button
            type="button"
            class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-2 text-sm font-medium"
            @click="emit('add')"
        >
            Add layer
        </button>
    </div>
</template>
