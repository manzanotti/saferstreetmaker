<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import { DEFAULT_GROUP_COLOUR } from '../../features/groups/groupColours';

const props = defineProps<{
    groupId: string;
    groupName: string;
    color?: string;
}>();

const emit = defineEmits<{
    apply: [color: string];
}>();

const draftColor = shallowRef(props.color ?? DEFAULT_GROUP_COLOUR);

watch(
    () => props.color,
    (color) => {
        draftColor.value = color ?? DEFAULT_GROUP_COLOUR;
    }
);

function onApply() {
    emit('apply', draftColor.value);
}

function onCancel() {
    draftColor.value = props.color ?? DEFAULT_GROUP_COLOUR;
}
</script>

<template>
    <div class="flex items-center gap-2" @click.stop>
        <input
            :id="`group-colour-${groupId}`"
            v-model="draftColor"
            type="color"
            class="group-colour-swatch h-7 w-7 cursor-pointer rounded border border-gray-200 p-0.5"
            :aria-label="`Choose colour for group ${groupName}`"
        />
        <button
            v-if="draftColor !== (color ?? DEFAULT_GROUP_COLOUR)"
            type="button"
            class="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
            :aria-label="`Apply colour to group ${groupName}`"
            @click="onApply"
        >
            Apply
        </button>
        <button
            v-if="draftColor !== (color ?? DEFAULT_GROUP_COLOUR)"
            type="button"
            class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            :aria-label="`Cancel colour change for group ${groupName}`"
            @click="onCancel"
        >
            Cancel
        </button>
    </div>
</template>
