import * as L from 'leaflet';
import {
    clearFeatureHighlight,
    executeAreaDelete,
    executeCopy,
    executePaste
} from './useAreaSelection';
import { getMapManager } from './useMapManager';
import { pinia } from '../stores/index';
import { useMapStore } from '../stores/mapStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore } from '../stores/uiStore';

const SHORTCUTS = {
    toggleSelection: 's',
    toggleGroups: 'g',
    toggleLayers: 'l',
    undo: 'z',
    copy: 'c',
    paste: 'v',
    redo: 'y',
    ltnLayer: 'ltn'
} as const;

function isTyping(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName ?? '';

    return tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable === true;
}

function hasModifier(event: KeyboardEvent): boolean {
    return event.ctrlKey || event.metaKey || event.altKey;
}

function isMapContext(event: KeyboardEvent, mapElement: HTMLElement): boolean {
    const target = event.target;

    if (target === document.body || target === mapElement) {
        return true;
    }

    return (
        target instanceof Node &&
        mapElement.contains(target) &&
        !(target instanceof Element && target.closest('.leaflet-control'))
    );
}

function isMapAction(event: KeyboardEvent, mapElement: HTMLElement): boolean {
    return !hasModifier(event) && !isTyping(event) && isMapContext(event, mapElement);
}

export function setupKeyboardShortcuts(map: L.Map): void {
    const mapStore = useMapStore(pinia);
    const selectionStore = useSelectionStore(pinia);
    const uiStore = useUiStore(pinia);
    const mapElement = map.getContainer();

    const handleKeydown = async (event: KeyboardEvent): Promise<void> => {
        if (event.key === 'Escape') {
            // LTN editing takes precedence and remains available after a popup
            // moved focus away from the map.
            if (mapStore.activeLayerId === SHORTCUTS.ltnLayer) {
                event.preventDefault();
                map.closePopup();
                mapStore.setDrawLayer(null);
                return;
            }

            if (
                !isTyping(event) &&
                !selectionStore.isActive &&
                selectionStore.selected.length > 0 &&
                mapStore.activeLayerId === null
            ) {
                clearFeatureHighlight();
            }
            return;
        }

        if (event.key === SHORTCUTS.toggleSelection && isMapAction(event, mapElement)) {
            event.preventDefault();
            if (selectionStore.isActive) {
                selectionStore.deactivate();
            } else {
                selectionStore.activate();
            }
            return;
        }

        if (event.key === SHORTCUTS.toggleGroups && isMapAction(event, mapElement)) {
            event.preventDefault();
            if (uiStore.activePanel === 'groups') {
                uiStore.closePanel();
            } else {
                uiStore.openPanel('groups');
            }
            return;
        }

        if (event.key === SHORTCUTS.toggleLayers && isMapAction(event, mapElement)) {
            event.preventDefault();
            if (uiStore.activePanel === 'layers') {
                uiStore.closePanel();
            } else {
                uiStore.openPanel('layers');
            }
            return;
        }

        if (
            (event.key === 'Delete' || event.key === 'Backspace') &&
            isMapAction(event, mapElement) &&
            !selectionStore.isGroupSelection &&
            selectionStore.selected.length > 0
        ) {
            event.preventDefault();
            executeAreaDelete();
            map.closePopup();
            return;
        }

        if (
            event.key === SHORTCUTS.undo &&
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey &&
            !isTyping(event)
        ) {
            event.preventDefault();
            await getMapManager().undo();
            return;
        }

        if (
            event.key === SHORTCUTS.copy &&
            (event.ctrlKey || event.metaKey) &&
            !isTyping(event) &&
            selectionStore.isActive &&
            selectionStore.selected.length > 0
        ) {
            const activeTextSelection = window.getSelection?.()?.toString().trim() ?? '';
            if (activeTextSelection.length > 0) {
                return;
            }

            event.preventDefault();
            executeCopy();
            return;
        }

        if (
            event.key === SHORTCUTS.paste &&
            (event.ctrlKey || event.metaKey) &&
            !isTyping(event) &&
            selectionStore.isActive &&
            selectionStore.hasClipboard
        ) {
            event.preventDefault();
            executePaste();
            return;
        }

        if (
            ((event.key === SHORTCUTS.redo && (event.ctrlKey || event.metaKey)) ||
                (event.key === SHORTCUTS.undo &&
                    (event.ctrlKey || event.metaKey) &&
                    event.shiftKey)) &&
            !isTyping(event)
        ) {
            event.preventDefault();
            await getMapManager().redo();
        }
    };

    document.addEventListener('keydown', handleKeydown);
}
