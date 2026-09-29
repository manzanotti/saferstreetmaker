<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted } from 'vue';
import { useUiStore, type PanelId } from '../../stores/uiStore';
import SettingsPanel from '../panels/SettingsPanel.vue';
import MapManagerPanel from '../panels/MapManagerPanel.vue';
import SharingPanel from '../panels/SharingPanel.vue';
import GroupsPanel from '../panels/group/GroupsPanel.vue';
import LayersPanel from '../panels/LayersPanel.vue';

const uiStore = useUiStore();
let suppressEscapeKeyup = false;
const panelOpenerIds: Partial<Record<PanelId, string>> = {
    settings: 'settings-button',
    mapManager: 'map-manager-button',
    sharing: 'share-button',
    help: 'help-button'
};

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
        const openerId = uiStore.activePanel ? panelOpenerIds[uiStore.activePanel] : undefined;
        uiStore.closePanel();
        if (openerId) {
            void nextTick(() => document.getElementById(openerId)?.focus());
        }
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
