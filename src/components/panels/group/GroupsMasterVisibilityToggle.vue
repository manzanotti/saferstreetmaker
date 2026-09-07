<script setup lang="ts">
defineProps<{
    allHidden: boolean;
}>();

const emit = defineEmits<{
    toggle: [];
}>();
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
                    aria-label="Hide all groups"
                    @change="emit('toggle')"
                />
                <label for="groups-master-toggle" class="sr-only">Hide all groups</label>
            </div>
        </div>
    </div>
</template>
