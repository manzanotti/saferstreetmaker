<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '../stores/uiStore';

const uiStore = useUiStore();

const hasErrors = computed(() => uiStore.errorMessages.length > 0);
</script>

<template>
  <!--
    #errors is always in the DOM so CSS selectors always match.
    Content only renders when errors exist so the element has no natural
    height when hidden, preventing it from intercepting map clicks.
  -->
  <div
    id="errors"
    class="modal modal-dialog modal-dialog-scrollable modal-lg z-0 overflow-hidden animated faster"
    :class="hasErrors ? 'fadeIn' : ['fadeOut', 'hidden']"
    style="pointer-events: none"
  >
    <template v-if="hasErrors">
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
    </template>
  </div>
</template>
