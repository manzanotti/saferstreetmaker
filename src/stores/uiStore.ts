import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ModalId = 'settings' | 'mapManager' | 'sharing' | 'help';

export const useUiStore = defineStore('ui', () => {
    const activeModal = ref<ModalId | null>(null);
    const errorMessages = ref<string[]>([]);
    const showDownloadStorageLink = ref(false);

    function openModal(id: ModalId) {
        activeModal.value = id;
    }

    function closeModal() {
        activeModal.value = null;
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
        activeModal,
        errorMessages,
        showDownloadStorageLink,
        openModal,
        closeModal,
        showErrors,
        clearErrors,
    };
});
