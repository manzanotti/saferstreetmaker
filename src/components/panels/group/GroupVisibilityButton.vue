<script setup lang="ts">
import { computed, useId } from 'vue';

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

const stateId = useId();
const stateText = computed(() =>
    props.solo ? 'Showing only this group' : props.hidden ? 'Hidden' : 'Visible'
);

const emit = defineEmits<{
    toggle: [];
}>();
</script>

<template>
    <button
        type="button"
        :aria-label="actionLabel"
        :title="actionLabel"
        :aria-describedby="stateId"
        :data-visibility="solo ? 'solo' : hidden ? 'hidden' : 'visible'"
        :class="[
            'flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700',
            solo ? 'text-green-700' : 'text-gray-500'
        ]"
        @click="emit('toggle')"
    >
        <svg
            v-if="hidden"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
            aria-hidden="true"
        >
            <path d="M3 3l18 18" />
            <path
                d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.4 3.1M6.5 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4-.9"
            />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </svg>
        <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
            aria-hidden="true"
        >
            <path
                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                :fill="solo ? 'currentColor' : 'none'"
            />
            <circle
                cx="12"
                cy="12"
                r="3"
                :fill="solo ? 'white' : 'none'"
                :stroke="solo ? 'white' : 'currentColor'"
            />
        </svg>
        <span :id="stateId" class="sr-only">{{ stateText }}</span>
    </button>
</template>
