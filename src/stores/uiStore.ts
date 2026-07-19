import { defineStore } from 'pinia';
import { ref } from 'vue';

export type PanelId = 'settings' | 'mapManager' | 'sharing' | 'help' | 'groups';

export const useUiStore = defineStore('ui', () => {
    const activePanel = ref<PanelId | null>(null);
    const errorMessages = ref<string[]>([]);
    const showDownloadStorageLink = ref(false);

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

    return {
        activePanel,
        errorMessages,
        showDownloadStorageLink,
        openPanel,
        closePanel,
        showErrors,
        clearErrors
    };
});
