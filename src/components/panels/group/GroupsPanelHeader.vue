<script setup lang="ts">
const emit = defineEmits<{
    close: [];
}>();
</script>

<template>
    <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 id="groups-panel-title" class="text-base font-semibold text-gray-800">Groups</h2>
        <button
            type="button"
            aria-label="Close groups panel"
            class="rounded text-gray-400 hover:text-gray-600"
            @click="emit('close')"
        >
            <span aria-hidden="true" class="text-xl leading-none">&times;</span>
        </button>
    </div>
</template>
