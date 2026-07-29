<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    GROUP_DESCRIPTION_MAX_LENGTH,
    sanitizeGroupDescription
} from '../../features/groups/groupDescription';

const props = defineProps<{
    groupName: string;
    description?: string;
}>();

const emit = defineEmits<{
    save: [description: string];
}>();

const isEditing = ref(false);
const draft = ref('');
const renderedDescription = computed(() => sanitizeGroupDescription(props.description));

watch(
    () => props.description,
    (description) => {
        if (!isEditing.value) {
            draft.value = description ?? '';
        }
    },
    { immediate: true }
);

function beginEditing() {
    draft.value = props.description ?? '';
    isEditing.value = true;
}

function cancelEditing() {
    draft.value = props.description ?? '';
    isEditing.value = false;
}

function saveEditing() {
    emit('save', draft.value);
    isEditing.value = false;
}
</script>

<template>
    <div class="group-description mt-2 pl-1">
        <div v-if="isEditing" class="space-y-2">
            <label :for="`group-description-${groupName}`" class="sr-only">
                Description for {{ groupName }}
            </label>
            <textarea
                :id="`group-description-${groupName}`"
                v-model="draft"
                :maxlength="GROUP_DESCRIPTION_MAX_LENGTH"
                rows="4"
                class="w-full resize-y rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                @keydown.esc.stop.prevent="cancelEditing"
            ></textarea>
            <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] text-gray-500"
                    >{{ draft.length }}/{{ GROUP_DESCRIPTION_MAX_LENGTH }}</span
                >
                <div class="flex gap-2">
                    <button
                        type="button"
                        class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                        @click="cancelEditing"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="rounded bg-green-700 px-2 py-1 text-xs font-medium text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                        @click="saveEditing"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
        <template v-else>
            <div
                v-if="renderedDescription"
                class="group-description-content text-xs leading-relaxed text-gray-600"
                v-html="renderedDescription"
            ></div>
            <button
                type="button"
                class="mt-1 text-xs font-medium text-green-700 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 rounded"
                @click="beginEditing"
            >
                {{ renderedDescription ? 'Edit description' : 'Add description' }}
            </button>
        </template>
    </div>
</template>

<style scoped>
.group-description-content :deep(p),
.group-description-content :deep(h3),
.group-description-content :deep(h4),
.group-description-content :deep(blockquote),
.group-description-content :deep(pre),
.group-description-content :deep(ul),
.group-description-content :deep(ol) {
    margin: 0.35rem 0;
}

.group-description-content :deep(ul),
.group-description-content :deep(ol) {
    padding-left: 1.25rem;
}

.group-description-content :deep(ul) {
    list-style: disc;
}

.group-description-content :deep(ol) {
    list-style: decimal;
}

.group-description-content :deep(blockquote) {
    border-left: 2px solid #d1d5db;
    padding-left: 0.5rem;
}

.group-description-content :deep(pre),
.group-description-content :deep(code) {
    overflow-wrap: anywhere;
}

.group-description-content :deep(a) {
    color: #047857;
    text-decoration: underline;
}
</style>
