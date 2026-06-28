import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useHistoryStore = defineStore('history', () => {
    const canUndo = ref(false);
    const canRedo = ref(false);
    const busy = ref(false);

    function setStatus(status: { canUndo: boolean; canRedo: boolean }) {
        canUndo.value = status.canUndo;
        canRedo.value = status.canRedo;
    }

    function clearStatus() {
        canUndo.value = false;
        canRedo.value = false;
    }

    function setBusy(value: boolean) {
        busy.value = value;
    }

    return {
        canUndo,
        canRedo,
        busy,
        setStatus,
        clearStatus,
        setBusy
    };
});
