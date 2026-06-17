import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ModalId = 'settings' | 'mapManager' | 'sharing' | 'help';

export const useUiStore = defineStore('ui', () => {
    const activeModal = ref<ModalId | null>(null);
    const errorMessages = ref<string[]>([]);

    function openModal(id: ModalId) {
        activeModal.value = id;
    }

    function closeModal() {
        activeModal.value = null;
    }

    function showErrors(messages: string[]) {
        errorMessages.value = messages;
    }

    function clearErrors() {
        errorMessages.value = [];
    }

    return {
        activeModal,
        errorMessages,
        openModal,
        closeModal,
        showErrors,
        clearErrors,
    };
});
