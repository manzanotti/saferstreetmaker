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

    describe('mergeSelected()', () => {
        it('adds entries whose marker is not yet in the selection', () => {
            const store = useSelectionStore();
            const m1 = makeMockMarker(1, 2);
            const m2 = makeMockMarker(3, 4);
            store.setSelected([makeMockSelected('ModalFilters', 1, 2)]);
            // Override the marker reference so we can match exactly
            (store.selected as any)[0] = {
                layerId: 'ModalFilters',
                historyId: 'id-1-2',
                latLng: { lat: 1, lng: 2 } as L.LatLng,
                marker: m1
            };

            const added = store.mergeSelected([
                {
                    layerId: 'MobilityLanes',
                    historyId: 'id-3-4',
                    latLng: { lat: 3, lng: 4 } as L.LatLng,
                    marker: m2
                }
            ]);

            expect(added).toHaveLength(1);
            expect(store.selected).toHaveLength(2);
        });

        it('skips entries whose marker and latLng are already in the selection', () => {
            const store = useSelectionStore();
            const m1 = makeMockMarker(1, 2);
            store.setSelected([
                {
                    layerId: 'ModalFilters',
                    historyId: 'id-1-2',
                    latLng: { lat: 1, lng: 2 } as L.LatLng,
                    marker: m1 as unknown as L.Layer
                }
            ]);

            const added = store.mergeSelected([
                {
                    layerId: 'ModalFilters',
                    historyId: 'id-1-2',
                    latLng: { lat: 1, lng: 2 } as L.LatLng,
                    marker: m1 as unknown as L.Layer
                }
            ]);

            expect(added).toHaveLength(0);
            expect(store.selected).toHaveLength(1);
        });

        it('does nothing when every new entry is already present', () => {
            const store = useSelectionStore();
            const m1 = makeMockMarker(1, 2);
            const existing = [
                {
                    layerId: 'MobilityLanes',
                    historyId: 'id-1-2',
                    latLng: { lat: 1, lng: 2 } as L.LatLng,
                    marker: m1 as unknown as L.Layer
                }
            ];
            store.setSelected(existing);
            const before = store.selected;

            const added = store.mergeSelected(existing);

            // Array reference unchanged (no new array created)
            expect(added).toHaveLength(0);
            expect(store.selected).toBe(before);
            expect(store.selected).toHaveLength(1);
        });

        it('handles merging into an empty selection', () => {
            const store = useSelectionStore();
            const m1 = makeMockMarker(1, 2);

            const added = store.mergeSelected([
                {
                    layerId: 'MobilityLanes',
                    historyId: 'id-1-2',
                    latLng: { lat: 1, lng: 2 } as L.LatLng,
                    marker: m1 as unknown as L.Layer
                }
            ]);

            expect(added).toHaveLength(1);
            expect(store.selected).toHaveLength(1);
        });

        it('adds missing vertices from an already-selected polyline', () => {
            const store = useSelectionStore();
            const polyline = makeMockMarker(1, 2);

            store.setSelected([
                {
                    layerId: 'MobilityLanes',
                    historyId: 'id-1-2',
                    latLng: { lat: 1, lng: 2 } as L.LatLng,
                    marker: polyline
                }
            ]);

            const added = store.mergeSelected([
                {
                    layerId: 'MobilityLanes',
                    historyId: 'id-1-2',
                    latLng: { lat: 1, lng: 2 } as L.LatLng,
                    marker: polyline
                },
                {
                    layerId: 'MobilityLanes',
                    historyId: 'id-1-2',
                    latLng: { lat: 3, lng: 4 } as L.LatLng,
                    marker: polyline
                }
            ]);

            expect(added).toHaveLength(1);
            expect(added[0].latLng).toMatchObject({ lat: 3, lng: 4 });
            expect(store.selected).toHaveLength(2);
        });

        it('de-dupes duplicate rows within the incoming merge batch', () => {
            const store = useSelectionStore();
            const polyline = makeMockMarker(1, 2);

            const added = store.mergeSelected([
                {
                    layerId: 'MobilityLanes',
                    historyId: 'id-1-2',
                    latLng: { lat: 3, lng: 4 } as L.LatLng,
                    marker: polyline
                },
                {
                    layerId: 'MobilityLanes',
                    historyId: 'id-1-2',
                    latLng: { lat: 3, lng: 4 } as L.LatLng,
                    marker: polyline
                }
            ]);

            expect(added).toHaveLength(1);
            expect(store.selected).toHaveLength(1);
        });
    });
});
