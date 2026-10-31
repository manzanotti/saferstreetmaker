/**
 * Unit tests for keyboard shortcuts — Ctrl/Command+I image export.
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

    it.each([{ ctrlKey: true }, { metaKey: true }])(
        'downloads directly with Ctrl/Command+I, including Presentation mode: %j',
        (modifier) => {
            useSettingsStore(pinia).readOnly = true;
            const selection = useSelectionStore(pinia);
            selection.markGroupSelection('selected-group');
            useUiStore(pinia).openPanel('groups');
            expect(press({ key: 'i', ...modifier }).defaultPrevented).toBe(true);
            expect(mocks.exportPng).toHaveBeenCalledWith(1280, 720);
            expect(useUiStore(pinia).activePanel).toBe('groups');
            expect(selection.selectedGroupId).toBe('selected-group');
            expect(selection.isGroupSelection).toBe(true);
        }
    );

    it.each([
        { ctrlKey: false },
        { ctrlKey: true, metaKey: true },
        { altKey: true },
        { shiftKey: true },
        { repeat: true },
        { isComposing: true }
    ])('ignores invalid image shortcut events: %j', (options) => {
        expect(press({ key: 'i', ctrlKey: true, ...options }).defaultPrevented).toBe(false);
        expect(useUiStore(pinia).activePanel).toBeNull();
        expect(mocks.exportPng).not.toHaveBeenCalled();
    });

    it.each(['dialog', 'alertdialog'])('blocks the image shortcut behind a %s', (role) => {
        const dialog = document.createElement('div');
        dialog.setAttribute('role', role);
        const button = document.createElement('button');
        dialog.append(button);
        document.body.append(dialog);

        expect(press({ key: 'i', ctrlKey: true }, button).defaultPrevented).toBe(false);
        expect(mocks.exportPng).not.toHaveBeenCalled();
    });

    it('allows downloading from Share but blocks its errors and additional dialogs', () => {
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-labelledby', 'sharing-panel-title');
        const form = document.createElement('form');
        form.id = 'sharing';
        const button = document.createElement('button');
        form.append(button);
        dialog.append(form);
        document.body.append(dialog);
        useUiStore(pinia).openPanel('sharing');
        const error = document.createElement('p');
        error.setAttribute('role', 'alert');
        form.append(error);

        expect(press({ key: 'i', ctrlKey: true }, button).defaultPrevented).toBe(false);
        error.remove();
        const prompt = document.createElement('div');
        prompt.setAttribute('role', 'dialog');
        document.body.append(prompt);
        expect(press({ key: 'i', ctrlKey: true }, button).defaultPrevented).toBe(false);
        prompt.remove();
        expect(mocks.exportPng).not.toHaveBeenCalled();

        expect(press({ key: 'i', ctrlKey: true }, button).defaultPrevented).toBe(true);
        expect(mocks.exportPng).toHaveBeenCalledOnce();
        expect(useUiStore(pinia).activePanel).toBe('sharing');
    });

    it('does not export while typing, exporting, replaying, or showing errors', () => {
        const ui = useUiStore(pinia);
        const input = document.createElement('input');
        document.body.append(input);
        press({ key: 'i', ctrlKey: true }, input);
        const editable = document.createElement('div');
        Object.defineProperty(editable, 'isContentEditable', { value: true });
        document.body.append(editable);
        press({ key: 'i', ctrlKey: true }, editable);
        ui.setImageExportState(true, null);
        press({ key: 'i', ctrlKey: true });
        ui.setImageExportState(false, null);
        useHistoryStore(pinia).setBusy(true);
        press({ key: 'i', ctrlKey: true });
        useHistoryStore(pinia).setBusy(false);
        ui.showErrors(['Cannot export']);
        press({ key: 'i', ctrlKey: true });
        ui.clearErrors();
        const modal = document.createElement('div');
        modal.setAttribute('aria-modal', 'true');
        document.body.append(modal);
        press({ key: 'i', ctrlKey: true });
        modal.remove();
        const event = new KeyboardEvent('keydown', {
            key: 'i',
            ctrlKey: true,
            bubbles: true,
            cancelable: true
        });
        event.preventDefault();
        map.getContainer().dispatchEvent(event);
        expect(ui.activePanel).toBeNull();
        expect(mocks.exportPng).not.toHaveBeenCalled();
    });

    it('blocks overlapping shortcut exports and releases the lock after completion', async () => {
        let finish: () => void = () => {
            throw new Error('Export not started');
        };
        mocks.exportPng.mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                })
        );
        press({ key: 'i', ctrlKey: true });
        press({ key: 'i', ctrlKey: true });
        expect(mocks.exportPng).toHaveBeenCalledOnce();
        finish();
        await Promise.resolve();
        press({ key: 'i', ctrlKey: true });
        expect(mocks.exportPng).toHaveBeenCalledTimes(2);
    });

    it('surfaces export errors and permits a retry after dismissal', async () => {
        mocks.exportPng.mockRejectedValueOnce(new Error('Finish the active map tool'));
        press({ key: 'i', ctrlKey: true });
        await vi.waitFor(() =>
            expect(useUiStore(pinia).errorMessages).toEqual([
                'The image could not be exported:',
                'Finish the active map tool'
            ])
        );
        useUiStore(pinia).clearErrors();
        press({ key: 'i', ctrlKey: true });
        expect(mocks.exportPng).toHaveBeenCalledTimes(2);
        expect(useUiStore(pinia).activePanel).toBeNull();
    });
});
