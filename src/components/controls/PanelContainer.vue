<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useUiStore } from '../../stores/uiStore';
import SettingsPanel from '../panels/SettingsPanel.vue';
import MapManagerPanel from '../panels/MapManagerPanel.vue';
import SharingPanel from '../panels/SharingPanel.vue';
import GroupsPanel from '../panels/group/GroupsPanel.vue';
import LayersPanel from '../panels/LayersPanel.vue';

const uiStore = useUiStore();
let suppressEscapeKeyup = false;

function closePanelOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.repeat) {
        // A keyup lost to focus changes must not swallow a later Escape.
        suppressEscapeKeyup = false;
    }

    if (
        event.key !== 'Escape' ||
        uiStore.imageExportInProgress ||
        uiStore.errorMessages.length > 0 ||
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
        event.stopPropagation();
        suppressEscapeKeyup = true;
        uiStore.closePanel();
    }
}

function suppressHandledEscapeKeyup(event: KeyboardEvent) {
    if (event.key === 'Escape' && suppressEscapeKeyup) {
        event.preventDefault();
        event.stopPropagation();
        suppressEscapeKeyup = false;
    }
}

onMounted(() => window.addEventListener('keydown', closePanelOnEscape, true));
onMounted(() => window.addEventListener('keyup', suppressHandledEscapeKeyup, true));
onBeforeUnmount(() => {
    window.removeEventListener('keydown', closePanelOnEscape, true);
    window.removeEventListener('keyup', suppressHandledEscapeKeyup, true);
});
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
