<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '../../stores/uiStore';

const uiStore = useUiStore();

const hasErrors = computed(() => uiStore.errorMessages.length > 0);
</script>

<template>
    <!-- Render the error overlay only when errors exist. -->
    <Transition name="overlay-fade">
        <div
            v-if="hasErrors"
            id="errors"
            class="modal modal-dialog modal-dialog-scrollable modal-lg z-0 overflow-hidden"
            style="pointer-events: none"
        >
            <div
                style="pointer-events: auto"
                class="modal-content border-none shadow-lg relative flex flex-col w-full pointer-events-auto bg-white bg-clip-padding rounded-md outline-hidden text-current"
            >
                <div
                    class="modal-header flex shrink-0 items-center justify-between p-4 border-b border-gray-200 rounded-t-md"
                >
                    <h1>Sorry, an error has occurred</h1>
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div id="errorMessages" v-html="uiStore.errorMessages.join('<br />')"></div>
                </div>
            </div>
        </div>
    </Transition>
</template>
