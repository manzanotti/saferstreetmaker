<script setup lang="ts">
import { computed } from 'vue';
import VisibilityButton from '../../shared/VisibilityButton.vue';

const props = defineProps<{
    groupName: string;
    hidden: boolean;
    solo?: boolean;
    soloActive?: boolean;
    canSolo?: boolean;
}>();

const actionLabel = computed(() =>
    props.soloActive
        ? 'Show all groups'
        : props.hidden
          ? `${props.canSolo ? 'Show only group' : 'Show group'} ${props.groupName}`
          : `Hide group ${props.groupName}`
);
const stateText = computed(() =>
    props.solo ? 'Showing only this group' : props.hidden ? 'Hidden' : 'Visible'
);
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
    <VisibilityButton
        :action-label="actionLabel"
        :state-text="stateText"
        :hidden="hidden"
        :solo="solo"
        @toggle="emit('toggle')"
    />
</template>
