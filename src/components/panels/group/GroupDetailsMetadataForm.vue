<script setup lang="ts">
import { ref } from 'vue';
import { GROUP_DESCRIPTION_MAX_LENGTH } from '../../../features/groups/groupDescription';

defineProps<{
    name: string;
    color: string;
    description: string;
    renderedDescription: string;
    readOnly: boolean;
}>();

const emit = defineEmits<{
    'update:name': [name: string];
    'update:color': [color: string];
    'update:description': [description: string];
}>();

const nameInput = ref<HTMLInputElement | null>(null);

function focusNameInput() {
    nameInput.value?.focus();
}

defineExpose({ focusNameInput });
</script>

<template>
    <div class="space-y-3">
        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
                <label
                    for="group-details-name"
                    class="mb-1 block text-sm font-medium text-gray-700"
                >
                    Group name
                </label>
                <input
                    id="group-details-name"
                    ref="nameInput"
                    :value="name"
                    type="text"
                    :disabled="readOnly"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    @input="emit('update:name', ($event.target as HTMLInputElement).value)"
                />
            </div>
            <div>
                <label
                    for="group-details-colour"
                    class="mb-1 block text-sm font-medium text-gray-700"
                >
                    Colour
                </label>
                <input
                    id="group-details-colour"
                    :value="color"
                    type="color"
                    :disabled="readOnly"
                    class="group-colour-swatch h-10 w-14 cursor-pointer rounded border border-gray-200 p-1"
                    aria-label="Choose group colour"
                    @input="emit('update:color', ($event.target as HTMLInputElement).value)"
                />
            </div>
        </div>

        <div>
            <div class="mb-1 flex items-center justify-between gap-2">
                <label
                    for="group-details-description"
                    class="block text-sm font-medium text-gray-700"
                >
                    Description
                </label>
                <span class="text-xs text-gray-500">
                    {{ description.length }}/{{ GROUP_DESCRIPTION_MAX_LENGTH }} characters
                </span>
            </div>
            <textarea
                id="group-details-description"
                :value="description"
                :maxlength="GROUP_DESCRIPTION_MAX_LENGTH"
                :disabled="readOnly"
                rows="4"
                placeholder="Optional description"
                class="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                @input="emit('update:description', ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
            <div
                v-if="renderedDescription"
                class="group-description-content mt-2 rounded border border-gray-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-gray-600"
                v-html="renderedDescription"
            ></div>
        </div>
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

.group-description-content :deep(a) {
    color: #047857;
    text-decoration: underline;
}
</style>
