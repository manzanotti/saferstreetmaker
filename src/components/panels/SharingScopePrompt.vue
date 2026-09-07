<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
import type { Group } from '../../models/Group';

const props = defineProps<{
    group: Group;
}>();

const emit = defineEmits<{
    (e: 'choose', scope: 'all' | 'group'): void;
    (e: 'cancel'): void;
}>();

const scopePrompt = useTemplateRef<HTMLDivElement>('scopePrompt');
const scopePromptTrigger = ref<HTMLElement | null>(null);

function restoreScopePromptFocus() {
    const trigger = scopePromptTrigger.value;
    scopePromptTrigger.value = null;
    if (trigger?.isConnected) {
        trigger.focus();
    }
}

function onScopePromptKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        event.preventDefault();
        emit('cancel');
        return;
    }
    if (event.key !== 'Tab' || !scopePrompt.value) {
        return;
    }

    const focusable = Array.from(
        scopePrompt.value.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
    ).filter((element) => !element.hasAttribute('disabled'));
    if (focusable.length === 0) {
        event.preventDefault();
        scopePrompt.value.focus();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

watch(
    () => props.group,
    () => {
        scopePromptTrigger.value =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        void nextTick(() => scopePrompt.value?.querySelector<HTMLElement>('button')?.focus());
    },
    { immediate: true }
);

onBeforeUnmount(restoreScopePromptFocus);

defineExpose({ restoreScopePromptFocus });
</script>

<template>
    <div
        ref="scopePrompt"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sharing-scope-title"
        class="fixed inset-0 z-[10003] flex items-center justify-center bg-black/30 p-4"
        tabindex="-1"
        @keydown="onScopePromptKeydown"
    >
        <div class="w-80 rounded-xl bg-white p-5 shadow-xl">
            <h2 id="sharing-scope-title" class="text-base font-semibold text-gray-800">
                Share {{ group.name }}
            </h2>
            <p class="mt-2 text-sm text-gray-600">
                Include the whole map or just this selected group?
            </p>
            <div class="mt-5 flex flex-col gap-2">
                <button
                    type="button"
                    class="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                    @click="emit('choose', 'all')"
                >
                    Whole map
                </button>
                <button
                    type="button"
                    class="rounded-lg border border-gray-200 bg-slate-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-slate-100"
                    @click="emit('choose', 'group')"
                >
                    Just {{ group.name }}
                </button>
                <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                    @click="emit('cancel')"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
</template>
