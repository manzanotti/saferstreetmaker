<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useUiStore } from '../../stores/uiStore';
import SettingsPanel from '../panels/SettingsPanel.vue';
import MapManagerPanel from '../panels/MapManagerPanel.vue';
import SharingPanel from '../panels/SharingPanel.vue';
import GroupsPanel from '../panels/group/GroupsPanel.vue';
import LayersPanel from '../panels/LayersPanel.vue';

const uiStore = useUiStore();

function closePanelOnEscape(event: KeyboardEvent) {
    if (
        event.key !== 'Escape' ||
        uiStore.imageExportInProgress ||
        (event.target instanceof Element && event.target.closest('[role="alertdialog"]'))
    ) {
        return;
    }

    if (
        uiStore.activePanel === 'settings' ||
        uiStore.activePanel === 'mapManager' ||
        uiStore.activePanel === 'sharing' ||
        uiStore.activePanel === 'help'
    ) {
        event.preventDefault();
        uiStore.closePanel();
    }
}

onMounted(() => window.addEventListener('keydown', closePanelOnEscape, true));
onBeforeUnmount(() => window.removeEventListener('keydown', closePanelOnEscape, true));
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
