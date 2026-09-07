<script setup lang="ts">
defineProps<{
    groupName: string;
    pendingGroupDelete: boolean;
    readOnly: boolean;
}>();

const emit = defineEmits<{
    deleteGroup: [];
    close: [];
}>();
</script>

<template>
    <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div class="flex items-center gap-2">
            <h2 id="group-details-dialog-title" class="text-base font-semibold text-gray-800">
                Group details
            </h2>
            <button
                v-if="!pendingGroupDelete && !readOnly"
                type="button"
                class="delete-button flex h-8 w-8 items-center justify-center rounded-lg border border-gray-100 bg-slate-50 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                :aria-label="`Delete group ${groupName}`"
                :title="`Delete group ${groupName}`"
                @click="emit('deleteGroup')"
            ></button>
        </div>
        <button
            type="button"
            aria-label="Close group details"
            class="rounded text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
            @click="emit('close')"
        >
            <span aria-hidden="true" class="text-xl leading-none">&times;</span>
        </button>
    </div>
</template>
