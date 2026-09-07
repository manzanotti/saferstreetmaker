import { onMounted, onUnmounted, ref } from 'vue';
import type * as L from 'leaflet';

export function useToolbarSubmenus(getMap: () => L.Map | null | undefined) {
    const openSubmenus = ref<Record<string, boolean>>({});
    const longPressTimers: Record<string, ReturnType<typeof setTimeout>> = {};

    function showSubmenu(groupName: string) {
        openSubmenus.value = { ...openSubmenus.value, [groupName]: true };
    }

    function hideSubmenu(groupName: string) {
        openSubmenus.value = { ...openSubmenus.value, [groupName]: false };
    }

    function hideAllSubmenus() {
        const anyOpen = Object.values(openSubmenus.value).some(Boolean);
        if (!anyOpen) {
            return;
        }
        openSubmenus.value = {};
    }

    function onDocumentKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            hideAllSubmenus();
        }
    }

    function onTouchStart(groupName: string) {
        longPressTimers[groupName] = setTimeout(() => {
            delete longPressTimers[groupName];
            showSubmenu(groupName);
        }, 500);
    }

    function cancelLongPress(groupName: string) {
        clearTimeout(longPressTimers[groupName]);
        delete longPressTimers[groupName];
    }

    onMounted(() => {
        getMap()?.on('click', hideAllSubmenus);
        document.addEventListener('keydown', onDocumentKeydown);
    });

    onUnmounted(() => {
        getMap()?.off('click', hideAllSubmenus);
        document.removeEventListener('keydown', onDocumentKeydown);
    });

    return {
        openSubmenus,
        showSubmenu,
        hideSubmenu,
        hideAllSubmenus,
        onTouchStart,
        cancelLongPress
    };
}
