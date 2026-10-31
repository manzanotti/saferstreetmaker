/**
 * Unit tests for keyboard shortcuts — Escape, editing and redo shortcuts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { setupKeyboardShortcuts } from '../../src/composables/useKeyboardShortcuts';
import { pinia } from '../../src/stores';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useUiStore } from '../../src/stores/uiStore';
import { useHistoryStore } from '../../src/stores/historyStore';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useMapStore } from '../../src/stores/mapStore';
import { Settings } from '../../src/models/Settings';

const mocks = vi.hoisted(() => ({
    applySettings: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    clearEditing: vi.fn(),
    exportPng: vi.fn()
}));
vi.mock('leaflet', () => import('./__mocks__/leaflet'));
vi.mock('../../src/features/export/mapImageExport', () => ({
    exportMapAsPng: mocks.exportPng
}));
vi.mock('../../src/composables/useMapManager', () => ({
    getMapManager: () => mocks
}));
vi.mock('../../src/composables/useGroups', () => ({
    clearReadOnlyEditingState: mocks.clearEditing
}));
vi.mock('../../src/composables/useAreaSelection', () => ({
    clearFeatureHighlight: vi.fn(),
    executeAreaDelete: vi.fn(),
    executeCopy: vi.fn(),
    executePaste: vi.fn()
}));

describe('Keyboard shortcuts', () => {
    let map: L.Map;
    let removeListener: () => void;

    function press(options: KeyboardEventInit = {}, target: EventTarget = map.getContainer()) {
        const event = new KeyboardEvent('keydown', {
            key: 'p',
            bubbles: true,
            cancelable: true,
            ...options
        });
        target.dispatchEvent(event);
        return event;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.exportPng.mockReset().mockResolvedValue(undefined);
        document.body.replaceChildren();
        const settings = new Settings();
        settings.title = 'Presentation test';
        settings.activeLayers = ['MobilityLanes'];
        useSettingsStore(pinia).applyFromSettings(settings);
        useUiStore(pinia).closePanel();
        useUiStore(pinia).clearErrors();
        useUiStore(pinia).setImageExportState(false, null);
        useHistoryStore(pinia).setBusy(false);
        useSelectionStore(pinia).deactivate();
        useMapStore(pinia).setDrawLayer(null);
        mocks.applySettings.mockImplementation(async (nextSettings: Settings) => {
            useSettingsStore(pinia).applyFromSettings(nextSettings);
        });
        map = new L.Map(document.createElement('div'));
        Object.assign(map, { getSize: () => L.point(1280.4, 720.4) });
        document.body.append(map.getContainer());
        const listenerSpy = vi.spyOn(document, 'addEventListener');
        setupKeyboardShortcuts(map);
        const listener = listenerSpy.mock.calls.find(([type]) => type === 'keydown')?.[1];
        if (!listener) {
            throw new Error('Keyboard listener was not registered');
        }
        removeListener = () => document.removeEventListener('keydown', listener);
        listenerSpy.mockRestore();
    });

    afterEach(() => {
        removeListener();
        document.body.replaceChildren();
    });

    it.each([
        ['the body', () => document.body],
        ['the map', () => map.getContainer()]
    ])('Escape from %s deselects the active map tool', (_name, target) => {
        const mapStore = useMapStore(pinia);
        const closePopup = vi.spyOn(map, 'closePopup');
        mapStore.setDrawLayer('ModalFilters');

        expect(press({ key: 'Escape' }, target()).defaultPrevented).toBe(true);
        expect(closePopup).toHaveBeenCalledOnce();
        expect(mapStore.drawLayerId).toBeNull();
        expect(mapStore.activeLayerId).toBeNull();
    });

    it('Escape leaves the map tool selected for inputs, controls, and handled events', () => {
        const mapStore = useMapStore(pinia);
        mapStore.setDrawLayer('ModalFilters');
        const input = document.createElement('input');
        const control = document.createElement('div');
        control.className = 'leaflet-control';
        const button = document.createElement('button');
        control.append(button);
        const panel = document.createElement('div');
        map.getContainer().append(input, control);
        document.body.append(panel);

        for (const target of [input, button, panel]) {
            press({ key: 'Escape' }, target);
        }
        const handled = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true
        });
        handled.preventDefault();
        document.body.dispatchEvent(handled);

        expect(mapStore.drawLayerId).toBe('ModalFilters');
        expect(mapStore.activeLayerId).toBe('ModalFilters');
    });

    it('blocks editing shortcuts in Presentation mode but allows layer visibility controls', () => {
        useSettingsStore(pinia).readOnly = true;
        press({ key: 's' });
        press({ key: 'g' });
        press({ key: 'z', ctrlKey: true });
        expect(useSelectionStore(pinia).isActive).toBe(false);
        expect(useUiStore(pinia).activePanel).toBeNull();
        expect(mocks.undo).not.toHaveBeenCalled();
        press({ key: 'l' });
        expect(useUiStore(pinia).activePanel).toBe('layers');
    });

    it('recognizes uppercase Z in the documented Shift+Z redo shortcut', async () => {
        press({ key: 'Z', ctrlKey: true, shiftKey: true });
        await vi.waitFor(() => expect(mocks.redo).toHaveBeenCalledOnce());
        expect(mocks.undo).not.toHaveBeenCalled();
    });
});
