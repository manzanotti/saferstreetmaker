<script setup lang="ts">
import { useUiStore } from '../../stores/uiStore';
import SettingsPanel from '../panels/SettingsPanel.vue';
import MapManagerPanel from '../panels/MapManagerPanel.vue';
import SharingPanel from '../panels/SharingPanel.vue';
import GroupsPanel from '../panels/GroupsPanel.vue';
import LayersPanel from '../panels/LayersPanel.vue';

const uiStore = useUiStore();
</script>

<template>
    <div>
        <SettingsPanel v-if="uiStore.activePanel === 'settings'" />
        <MapManagerPanel v-if="uiStore.activePanel === 'mapManager'" />
        <SharingPanel v-if="uiStore.activePanel === 'sharing'" />
        <GroupsPanel v-if="uiStore.activePanel === 'groups'" />
        <LayersPanel v-if="uiStore.activePanel === 'layers'" />
    </div>
</template>
