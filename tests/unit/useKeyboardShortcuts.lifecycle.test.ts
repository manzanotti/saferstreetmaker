import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { setupKeyboardShortcuts } from '../../src/composables/useKeyboardShortcuts';
import { pinia } from '../../src/stores';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useUiStore } from '../../src/stores/uiStore';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));
vi.mock('../../src/composables/useMapManager', () => ({
    getMapManager: vi.fn()
}));
vi.mock('../../src/composables/useGroups', () => ({
    clearReadOnlyEditingState: vi.fn()
}));
vi.mock('../../src/composables/useAreaSelection', () => ({
    clearFeatureHighlight: vi.fn(),
    executeAreaDelete: vi.fn(),
    executeCopy: vi.fn(),
    executePaste: vi.fn()
}));

describe('keyboard shortcut lifecycle', () => {
    const disposers: Array<() => void> = [];

    function pressLayersShortcut() {
        const event = new KeyboardEvent('keydown', {
            key: 'l',
            bubbles: true,
            cancelable: true
        });
        document.body.dispatchEvent(event);
        return event;
    }

    beforeEach(() => {
        useSettingsStore(pinia).readOnly = false;
        useUiStore(pinia).closePanel();
        useUiStore(pinia).setImageExportState(false, null);
    });

    afterEach(() => {
        for (const dispose of disposers.splice(0)) {
            dispose();
        }
        useUiStore(pinia).closePanel();
        vi.restoreAllMocks();
    });

    it('returns an idempotent disposer that removes both listeners', () => {
        const map = new L.Map(document.createElement('div'));
        const off = vi.spyOn(map, 'off');
        const remove = vi.spyOn(document, 'removeEventListener');
        const dispose = setupKeyboardShortcuts(map);
        disposers.push(dispose);

        expect(pressLayersShortcut().defaultPrevented).toBe(true);
        expect(useUiStore(pinia).activePanel).toBe('layers');
        useUiStore(pinia).closePanel();

        dispose();
        dispose();
        expect(pressLayersShortcut().defaultPrevented).toBe(false);
        expect(useUiStore(pinia).activePanel).toBeNull();
        expect(remove.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
        expect(off).toHaveBeenCalledOnce();
        expect(off).toHaveBeenCalledWith('unload', dispose);
    });

    it('disposes on map unload and only handles shortcuts once after remount', () => {
        const first = new L.Map(document.createElement('div'));
        disposers.push(setupKeyboardShortcuts(first));
        first.fire('unload');

        expect(pressLayersShortcut().defaultPrevented).toBe(false);
        expect(useUiStore(pinia).activePanel).toBeNull();

        const second = new L.Map(document.createElement('div'));
        disposers.push(setupKeyboardShortcuts(second));
        expect(pressLayersShortcut().defaultPrevented).toBe(true);
        expect(useUiStore(pinia).activePanel).toBe('layers');
        second.fire('unload');
        useUiStore(pinia).closePanel();
        expect(pressLayersShortcut().defaultPrevented).toBe(false);
        expect(useUiStore(pinia).activePanel).toBeNull();
    });
});
