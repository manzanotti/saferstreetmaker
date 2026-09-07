<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ToolbarButton } from '../../models/ToolbarButton';

const props = withDefaults(
    defineProps<{
        button: ToolbarButton;
        active: boolean;
        scale?: number;
        docked?: boolean;
        expanded?: boolean;
        showSubmenuIndicator?: boolean;
    }>(),
    {
        scale: 1,
        docked: false,
        expanded: undefined,
        showSubmenuIndicator: false
    }
);

const emit = defineEmits<{
    activate: [];
    showSubmenu: [];
    hideSubmenu: [];
    register: [id: string, el: HTMLButtonElement | null];
}>();

const buttonEl = ref<HTMLButtonElement | null>(null);
let registeredId: string | null = null;

function registerCurrentButton() {
    if (registeredId && registeredId !== props.button.id) {
        emit('register', registeredId, null);
    }
    if (buttonEl.value) {
        emit('register', props.button.id, buttonEl.value);
        registeredId = props.button.id;
    }
}

onMounted(registerCurrentButton);
watch(
    () => props.button.id,
    () => void nextTick(registerCurrentButton)
);
onBeforeUnmount(() => {
    if (registeredId) {
        emit('register', registeredId, null);
    }
});
</script>

<template>
    <button
        :id="`${button.id}-button`"
        ref="buttonEl"
        type="button"
        :aria-label="button.tooltip"
        :title="button.tooltip"
        :aria-pressed="active"
        :aria-expanded="expanded"
        :style="docked ? { transform: `scale(${scale})` } : undefined"
        :class="[
            showSubmenuIndicator ? 'relative' : '',
            'w-12 h-12 rounded-xl flex items-center justify-center',
            docked
                ? 'transition-transform duration-150 ease-out origin-left'
                : 'transition-transform duration-150 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1',
            '[touch-action:manipulation] cursor-pointer select-none',
            active ? 'bg-green-700 shadow-inner' : 'bg-slate-50 hover:bg-green-100'
        ]"
        @click.stop="emit('activate')"
        @contextmenu.prevent.stop="emit('showSubmenu')"
        @keydown.down.prevent="emit('showSubmenu')"
        @keydown.escape="emit('hideSubmenu')"
    >
        <img
            v-if="button.iconSrc"
            :src="button.iconSrc"
            width="28"
            height="28"
            alt=""
            aria-hidden="true"
            class="w-7 h-7 object-contain pointer-events-none"
            :class="{ invert: active }"
        />
        <span
            v-else-if="button.text"
            aria-hidden="true"
            class="text-xl font-bold pointer-events-none leading-none"
            :class="active ? 'text-white' : 'text-gray-700'"
            >{{ button.text }}</span
        >
        <span
            v-if="showSubmenuIndicator"
            class="absolute top-0.5 right-0.5 text-base leading-none pointer-events-none font-bold"
            :class="active ? 'text-white/80' : 'text-gray-500'"
            aria-hidden="true"
            >&#9656;</span
        >
    </button>
</template>
