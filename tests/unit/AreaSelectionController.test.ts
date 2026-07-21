import { describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import type * as L from 'leaflet';
import { AreaSelectionController } from '../../src/features/selection/AreaSelectionController';
import type { SelectedMarker } from '../../src/stores/selectionStore';

function createHarness() {
    const handlers = new Map<string, (event: any) => void>();
    const container = document.createElement('div');
    const map = {
        dragging: { disable: vi.fn(), enable: vi.fn() },
        getContainer: () => container,
        closePopup: vi.fn(),
        on: vi.fn((event: string, handler: (event: any) => void) => {
            handlers.set(event, handler);
            return map;
        }),
        off: vi.fn((event: string, handler: (event: any) => void) => {
            if (handlers.get(event) === handler) {
                handlers.delete(event);
            }
            return map;
        })
    } as unknown as L.Map;
    const selected: SelectedMarker[] = [
        {
            layerId: 'ModalFilters',
            historyId: null,
            latLng: { lat: 1, lng: 2 } as L.LatLng,
            marker: {} as L.Layer
        }
    ];
    const highlighter = { add: vi.fn(), clear: vi.fn() };
    const setDrawLayer = vi.fn();
    const deactivateSelection = vi.fn();
    const setSelected = vi.fn();
    const setLastAreaBounds = vi.fn();
    const found = [...selected];

    const controller = new AreaSelectionController({
        map,
        highlighter: highlighter as any,
        getSelected: () => selected,
        setSelected,
        mergeSelected: vi.fn((markers) => markers),
        clearSelection: vi.fn(),
        setLastAreaBounds,
        findMarkersInBounds: () => found,
        getDrawLayerId: () => 'modal-filter',
        setDrawLayer,
        clearAddToGroupTarget: vi.fn(),
        isSelectionActive: () => true,
        deactivateSelection
    });

    return {
        controller,
        handlers,
        container,
        map,
        highlighter,
        setDrawLayer,
        deactivateSelection,
        setSelected,
        setLastAreaBounds,
        found
    };
}

describe('AreaSelectionController', () => {
    it('activates and restores the previous draw layer on deactivation', () => {
        const harness = createHarness();

        harness.controller.activate();
        expect(harness.map.dragging.disable).toHaveBeenCalledOnce();
        expect(harness.container.classList.contains('area-select')).toBe(true);
        expect(harness.setDrawLayer).toHaveBeenCalledWith(null);
        expect(harness.handlers.has('mousedown')).toBe(true);

        harness.controller.deactivate();
        expect(harness.map.dragging.enable).toHaveBeenCalledOnce();
        expect(harness.container.classList.contains('area-select')).toBe(false);
        expect(harness.setDrawLayer).toHaveBeenLastCalledWith('modal-filter');
        expect(harness.highlighter.clear).toHaveBeenCalledOnce();
    });

    it('completes a drag by storing bounds and replacing the selection', () => {
        const harness = createHarness();
        harness.controller.activate();
        const preventDefault = vi.fn();

        harness.handlers.get('mousedown')?.({
            latlng: { lat: 0, lng: 0 },
            originalEvent: {
                preventDefault,
                shiftKey: false,
                ctrlKey: false,
                metaKey: false
            }
        });
        harness.handlers.get('mouseup')?.({ latlng: { lat: 2, lng: 2 } });

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(harness.setLastAreaBounds).toHaveBeenCalledOnce();
        expect(harness.setSelected).toHaveBeenCalledWith(harness.found);
        expect(harness.highlighter.add).toHaveBeenCalledWith(harness.found);
    });

    it('deactivates selection on Escape and removes listeners when disposed', () => {
        const harness = createHarness();

        harness.handlers.get('keyup')?.({ originalEvent: { key: 'Escape' } });
        expect(harness.deactivateSelection).toHaveBeenCalledOnce();

        harness.controller.dispose();
        expect(harness.handlers.has('keyup')).toBe(false);
    });
});
