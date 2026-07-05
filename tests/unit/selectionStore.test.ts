import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSelectionStore } from '../../src/stores/selectionStore';
import type { SelectedMarker } from '../../src/stores/selectionStore';
import type * as L from 'leaflet';

function makeMockMarker(lat: number, lng: number): L.Layer {
    return { _lat: lat, _lng: lng } as unknown as L.Layer;
}

function makeMockSelected(layerId: string, lat: number, lng: number): SelectedMarker {
    return {
        layerId,
        historyId: `id-${lat}-${lng}`,
        latLng: { lat, lng } as L.LatLng,
        marker: makeMockMarker(lat, lng)
    };
}

describe('selectionStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('initialises inactive with no selection', () => {
        const store = useSelectionStore();
        expect(store.isActive).toBe(false);
        expect(store.selected).toHaveLength(0);
    });

    describe('activate()', () => {
        it('sets isActive to true', () => {
            const store = useSelectionStore();
            store.activate();
            expect(store.isActive).toBe(true);
        });

        it('does not clear an existing selection', () => {
            const store = useSelectionStore();
            store.setSelected([makeMockSelected('ModalFilters', 1, 2)]);
            store.activate();
            expect(store.selected).toHaveLength(1);
        });
    });

    describe('deactivate()', () => {
        it('sets isActive to false', () => {
            const store = useSelectionStore();
            store.activate();
            store.deactivate();
            expect(store.isActive).toBe(false);
        });

        it('clears the selection', () => {
            const store = useSelectionStore();
            store.setSelected([makeMockSelected('ModalFilters', 1, 2)]);
            store.deactivate();
            expect(store.selected).toHaveLength(0);
        });
    });

    describe('setSelected()', () => {
        it('replaces the selection', () => {
            const store = useSelectionStore();
            const markers = [
                makeMockSelected('ModalFilters', 1, 2),
                makeMockSelected('BusGates', 3, 4)
            ];
            store.setSelected(markers);
            expect(store.selected).toHaveLength(2);
            expect(store.selected[0].layerId).toBe('ModalFilters');
            expect(store.selected[1].layerId).toBe('BusGates');
        });

        it('overwrites a previous selection', () => {
            const store = useSelectionStore();
            store.setSelected([makeMockSelected('ModalFilters', 1, 2)]);
            store.setSelected([makeMockSelected('BusGates', 3, 4)]);
            expect(store.selected).toHaveLength(1);
            expect(store.selected[0].layerId).toBe('BusGates');
        });
    });

    describe('clear()', () => {
        it('empties the selection without deactivating', () => {
            const store = useSelectionStore();
            store.activate();
            store.setSelected([makeMockSelected('ModalFilters', 1, 2)]);
            store.clear();
            expect(store.selected).toHaveLength(0);
            expect(store.isActive).toBe(true);
        });
    });
});
