<script setup lang="ts">
import { useUiStore } from '../../stores/uiStore';
import SettingsModal from '../modals/SettingsModal.vue';
import MapManagerModal from '../modals/MapManagerModal.vue';
import SharingModal from '../modals/SharingModal.vue';

const uiStore = useUiStore();
</script>

<template>
  <div>
    <SettingsModal v-if="uiStore.activeModal === 'settings'" />
    <MapManagerModal v-if="uiStore.activeModal === 'mapManager'" />
    <SharingModal v-if="uiStore.activeModal === 'sharing'" />
  </div>
</template>
