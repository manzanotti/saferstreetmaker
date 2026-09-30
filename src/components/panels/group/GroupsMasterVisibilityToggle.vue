<script setup lang="ts">
import { nextTick } from 'vue';

const props = defineProps<{
    allHidden: boolean;
    soloActive?: boolean;
}>();

const emit = defineEmits<{
    toggle: [];
}>();

async function toggle(event: Event) {
    const input = event.target as HTMLInputElement;
    emit('toggle');
    await nextTick();
    // A native click flips checked/indeterminate even when the bound props do not change.
    input.checked = props.allHidden;
    input.indeterminate = !!props.soloActive;
}
</script>

<template>
    <div class="border-b border-gray-100 px-5 py-3">
        <div class="toggle-row">
            <span class="text-sm text-gray-700">Hide all groups</span>
            <div class="toggle">
                <input
                    id="groups-master-toggle"
                    type="checkbox"
                    :checked="allHidden"
                    :indeterminate="!!soloActive"
                    aria-label="Hide all groups"
                    @change="toggle"
                />
                <label for="groups-master-toggle" class="sr-only">Hide all groups</label>
            </div>
        </div>
    </div>
</template>
