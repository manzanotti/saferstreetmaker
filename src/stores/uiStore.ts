import { defineStore } from 'pinia';
import { ref } from 'vue';

export type PanelId = 'settings' | 'mapManager' | 'sharing' | 'help' | 'groups' | 'layers';

export const useUiStore = defineStore('ui', () => {
    const activePanel = ref<PanelId | null>(null);
    const errorMessages = ref<string[]>([]);
    const showDownloadStorageLink = ref(false);
    const legendLayerIds = ref<Set<string> | null>(null);
    const imageExportInProgress = ref(false);
    const imageExportLegendLayerIds = ref<Set<string> | null>(null);
    const imageCopied = ref(false);

    function openPanel(id: PanelId) {
        activePanel.value = id;
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

    function setImageCopied(copied: boolean) {
        imageCopied.value = copied;
    }

    return {
        activePanel,
        errorMessages,
        showDownloadStorageLink,
        legendLayerIds,
        imageExportInProgress,
        imageExportLegendLayerIds,
        imageCopied,
        openPanel,
        closePanel,
        showErrors,
        clearErrors,
        setLegendLayerIds,
        setImageExportState,
        setImageCopied
    };
});
