/**
 * Unit tests for keyboard shortcuts — Presentation mode toggle.
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
import { SAVE_ERROR_ALREADY_SHOWN } from '../../src/composables/saveErrorMarker';

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

    it('toggles both ways through persisted settings, preserving other settings', async () => {
        const closePopup = vi.spyOn(map, 'closePopup');
        expect(press().defaultPrevented).toBe(true);
        await vi.waitFor(() => expect(useSettingsStore(pinia).readOnly).toBe(true));
        expect(mocks.clearEditing).toHaveBeenCalledOnce();
        expect(closePopup).toHaveBeenCalledOnce();
        expect(mocks.applySettings).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Presentation test',
                readOnly: true,
                activeLayers: ['MobilityLanes']
            })
        );
        press({ key: 'P' });
        await vi.waitFor(() => expect(useSettingsStore(pinia).readOnly).toBe(false));
        expect(mocks.clearEditing).toHaveBeenCalledOnce();
    });

    it.each([
        { ctrlKey: true },
        { metaKey: true },
        { altKey: true },
        { repeat: true },
        { isComposing: true }
    ])('ignores modified, repeating, or composing events: %j', (options) => {
        press(options);
        expect(mocks.applySettings).not.toHaveBeenCalled();
    });

    it.each(['input', 'textarea', 'select', 'button'])(
        'ignores a focused %s outside the map',
        (tag) => {
            const element = document.createElement(tag);
            document.body.append(element);
            press({}, element);
            expect(mocks.applySettings).not.toHaveBeenCalled();
        }
    );

    it('ignores text editing and toolbar controls inside the map', () => {
        const input = document.createElement('input');
        const editable = document.createElement('div');
        Object.defineProperty(editable, 'isContentEditable', { value: true });
        const toolbar = document.createElement('div');
        toolbar.className = 'leaflet-control';
        const button = document.createElement('button');
        toolbar.append(button);
        map.getContainer().append(input, editable, toolbar);
        for (const target of [input, editable, button]) {
            press({}, target);
        }
        expect(mocks.applySettings).not.toHaveBeenCalled();
    });

    it('ignores panels, dialogs, errors, export, history replay, and handled events', () => {
        const ui = useUiStore(pinia);
        ui.openPanel('settings');
        press();
        ui.closePanel();
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        document.body.append(dialog);
        press();
        dialog.remove();
        ui.showErrors(['Cannot save']);
        press();
        ui.clearErrors();
        ui.setImageExportState(true, null);
        press();
        ui.setImageExportState(false, null);
        useHistoryStore(pinia).setBusy(true);
        press();
        useHistoryStore(pinia).setBusy(false);
        const event = new KeyboardEvent('keydown', { key: 'p', cancelable: true, bubbles: true });
        event.preventDefault();
        map.getContainer().dispatchEvent(event);
        expect(mocks.applySettings).not.toHaveBeenCalled();
    });

    it('prevents overlapping saves, then allows the next toggle', async () => {
        let finishSave: () => void = () => {
            throw new Error('Save did not start');
        };
        mocks.applySettings.mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    finishSave = resolve;
                })
        );
        press();
        press();
        expect(mocks.applySettings).toHaveBeenCalledOnce();
        finishSave();
        await Promise.resolve();
        press();
        expect(mocks.applySettings).toHaveBeenCalledTimes(2);
    });

    it('reports failures and releases the toggle lock for retry', async () => {
        mocks.applySettings.mockRejectedValueOnce(new Error('Storage unavailable'));
        press();
        await vi.waitFor(() =>
            expect(useUiStore(pinia).errorMessages).toEqual([
                'There was a problem saving Presentation mode:',
                'Storage unavailable'
            ])
        );
        useUiStore(pinia).clearErrors();
        press();
        await vi.waitFor(() => expect(mocks.applySettings).toHaveBeenCalledTimes(2));
    });

    it('does not replace an error already surfaced by the save path', async () => {
        mocks.applySettings.mockRejectedValueOnce(
            Object.assign(new Error('Quota exceeded'), { [SAVE_ERROR_ALREADY_SHOWN]: true })
        );
        const showErrors = vi.spyOn(useUiStore(pinia), 'showErrors');
        press();
        await Promise.resolve();
        expect(showErrors).not.toHaveBeenCalled();
        showErrors.mockRestore();
    });
});
