<script setup lang="ts">
defineProps<{
    versionName: string;
    error: string;
}>();

const emit = defineEmits<{
    'update:versionName': [name: string];
    save: [];
    cancel: [];
}>();
</script>

<template>
    <div class="mt-3 space-y-2 rounded border border-gray-100 bg-slate-50 p-3">
        <label for="group-version-name" class="block text-xs font-medium text-gray-700">
            New version
        </label>
        <input
            id="group-version-name"
            :value="versionName"
            type="text"
            class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            @input="emit('update:versionName', ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="emit('save')"
        />
        <p v-if="error" class="text-xs text-red-600" role="alert">
            {{ error }}
        </p>
        <div class="flex justify-end gap-2">
            <button
                type="button"
                class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600"
                @click="emit('cancel')"
            >
                Cancel
            </button>
            <button
                type="button"
                class="rounded bg-green-700 px-2 py-1 text-xs font-medium text-white"
                @click="emit('save')"
            >
                Save
            </button>
        </div>
    </div>
</template>
