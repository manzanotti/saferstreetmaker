<script setup lang="ts">
import { watch } from 'vue';
import { useUiStore } from '../../stores/uiStore';

const uiStore = useUiStore();

watch(
    () => uiStore.imageCopied,
    (copied, _previous, onCleanup) => {
        if (copied) {
            const timer = window.setTimeout(() => uiStore.setImageCopied(false), 4000);
            onCleanup(() => window.clearTimeout(timer));
        }
    },
    { immediate: true }
);
</script>

<template>
    <div
        id="image-copy-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="fixed bottom-4 right-4 z-[11000] pointer-events-none"
    >
        <p
            v-if="uiStore.imageCopied"
            class="rounded-lg bg-green-800 px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
            Map image copied to clipboard.
        </p>
    </div>
</template>
