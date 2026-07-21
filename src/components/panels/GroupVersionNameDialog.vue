<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
    open: boolean;
    groupName: string;
    errorMessage: string;
}>();

const emit = defineEmits<{
    submit: [name: string];
    cancel: [];
}>();

const inputName = ref('');
const inputEl = ref<HTMLInputElement | null>(null);

watch(
    () => props.open,
    (open) => {
        if (!open) {
            inputName.value = '';
            return;
        }
        inputName.value = '';
        void nextTick(() => inputEl.value?.focus());
    }
);

function onSubmit() {
    const trimmed = inputName.value.trim();
    if (trimmed) {
        emit('submit', trimmed);
    }
}

function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        onSubmit();
    } else if (event.key === 'Escape') {
        emit('cancel');
    }
}
</script>

<template>
    <div
        v-if="open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-version-name-dialog-title"
        class="fixed top-1/2 left-1/2 z-10000 flex w-80 -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
        @dblclick.stop
        @keydown.stop="onKeydown"
    >
        <div class="flex items-center border-b border-gray-100 px-5 py-4">
            <h2 id="group-version-name-dialog-title" class="text-base font-semibold text-gray-800">
                New Group Version
            </h2>
        </div>
        <div class="space-y-4 px-5 py-4">
            <p class="text-sm text-gray-600">
                Create a copy of the current version in <strong>{{ groupName }}</strong
                >.
            </p>
            <div>
                <label
                    for="group-version-name-input"
                    class="mb-1 block text-sm font-medium text-gray-700"
                >
                    Version name
                </label>
                <input
                    id="group-version-name-input"
                    ref="inputEl"
                    v-model="inputName"
                    type="text"
                    autocomplete="off"
                    placeholder="Enter version name"
                    :aria-invalid="Boolean(errorMessage)"
                    :aria-describedby="errorMessage ? 'group-version-name-error' : undefined"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p
                    v-if="errorMessage"
                    id="group-version-name-error"
                    class="mt-1 text-xs text-red-600"
                    role="alert"
                >
                    {{ errorMessage }}
                </p>
            </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button
                type="button"
                class="rounded-lg border border-gray-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                @click="emit('cancel')"
            >
                Cancel
            </button>
            <button
                type="button"
                :disabled="!inputName.trim()"
                class="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                @click="onSubmit"
            >
                Create version
            </button>
        </div>
    </div>
</template>
