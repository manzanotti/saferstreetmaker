import { defineStore } from 'pinia';
import { ref } from 'vue';

export type PanelId = 'settings' | 'mapManager' | 'sharing' | 'help' | 'groups' | 'layers';
export type SharingExportFormat = 'image' | 'html' | 'url';

export const useUiStore = defineStore('ui', () => {
    const activePanel = ref<PanelId | null>(null);
    const sharingExportFormat = ref<SharingExportFormat>('html');
    const errorMessages = ref<string[]>([]);
    const showDownloadStorageLink = ref(false);
    const legendLayerIds = ref<Set<string> | null>(null);
    const imageExportInProgress = ref(false);
    const imageExportLegendLayerIds = ref<Set<string> | null>(null);

    function openPanel(id: PanelId) {
        if (id === 'sharing' && activePanel.value !== 'sharing') {
            sharingExportFormat.value = 'html';
        }
        activePanel.value = id;
    }

    function openImageSharingPanel() {
        openPanel('sharing');
        sharingExportFormat.value = 'image';
    }

    function closePanel() {
        activePanel.value = null;
    }

    function showErrors(messages: string[], options?: { showDownloadStorageLink?: boolean }) {
        errorMessages.value = messages;
        showDownloadStorageLink.value = options?.showDownloadStorageLink ?? false;
    }

    function clearErrors() {
        errorMessages.value = [];
        showDownloadStorageLink.value = false;
    }

    function setLegendLayerIds(layerIds: Set<string> | null) {
        legendLayerIds.value = layerIds;
    }

    function setImageExportState(inProgress: boolean, layerIds: Set<string> | null) {
        imageExportInProgress.value = inProgress;
        imageExportLegendLayerIds.value = layerIds;
    }

    return {
        activePanel,
        sharingExportFormat,
        errorMessages,
        showDownloadStorageLink,
        legendLayerIds,
        imageExportInProgress,
        imageExportLegendLayerIds,
        openPanel,
        openImageSharingPanel,
        closePanel,
        showErrors,
        clearErrors,
        setLegendLayerIds,
        setImageExportState
    };
});
