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
import { useSettingsStore } from '../stores/settingsStore';
import { useHistoryStore } from '../stores/historyStore';
import { clearReadOnlyEditingState } from './useGroups';
import { isSaveErrorAlreadyShown } from './saveErrorMarker';

const SHORTCUTS = {
    toggleSelection: 's',
    toggleGroups: 'g',
    toggleLayers: 'l',
    togglePresentation: 'p',
    imageExport: 'i',
    undo: 'z',
    copy: 'c',
    paste: 'v',
    redo: 'y',
    ltnLayer: 'ltn'
} as const;

function isTyping(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName ?? '';

    return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable === true
    );
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
    const settingsStore = useSettingsStore(pinia);
    const historyStore = useHistoryStore(pinia);
    const mapElement = map.getContainer();
    let presentationToggleInProgress = false;

    const handleKeydown = async (event: KeyboardEvent): Promise<void> => {
        if (uiStore.imageExportInProgress) {
            return;
        }

        if (
            event.key.toLowerCase() === SHORTCUTS.imageExport &&
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            !event.shiftKey &&
            !event.repeat &&
            !event.isComposing &&
            !event.defaultPrevented &&
            !isTyping(event) &&
            !historyStore.busy &&
            uiStore.errorMessages.length === 0 &&
            !document.querySelector('[role="alertdialog"], [aria-modal="true"]')
        ) {
            event.preventDefault();
            uiStore.openImageSharingPanel();
            return;
        }

        if (event.key === 'Escape') {
            if (
                uiStore.errorMessages.length > 0 ||
                (event.target instanceof Element && event.target.closest('[role="alertdialog"]'))
            ) {
                return;
            }

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

        if (
            event.key.toLowerCase() === SHORTCUTS.togglePresentation &&
            isMapAction(event, mapElement) &&
            !event.repeat &&
            !event.isComposing &&
            !event.defaultPrevented &&
            !presentationToggleInProgress &&
            !historyStore.busy &&
            uiStore.activePanel === null &&
            uiStore.errorMessages.length === 0 &&
            !document.querySelector('[role="dialog"], [role="alertdialog"]')
        ) {
            event.preventDefault();
            presentationToggleInProgress = true;
            try {
                const settings = settingsStore.toSettings();
                settings.readOnly = !settings.readOnly;
                if (settings.readOnly) {
                    map.closePopup();
                    clearReadOnlyEditingState();
                }
                await getMapManager().applySettings(settings);
            } catch (error) {
                if (!isSaveErrorAlreadyShown(error)) {
                    uiStore.showErrors([
                        'There was a problem saving Presentation mode:',
                        String(error instanceof Error ? error.message : error)
                    ]);
                }
            } finally {
                presentationToggleInProgress = false;
            }
            return;
        }

        if (settingsStore.readOnly && event.key !== SHORTCUTS.toggleLayers) {
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
                (event.key.toLowerCase() === SHORTCUTS.undo &&
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
