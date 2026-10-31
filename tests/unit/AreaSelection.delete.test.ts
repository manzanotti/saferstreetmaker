/**
 * Tests for useAreaSelection — executeAreaDelete() for points and batch mutations.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../src/stores/index';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useMapStore } from '../../src/stores/mapStore';
import { executeAreaDelete } from '../../src/composables/useAreaSelection';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';
import {
    makePointLayer,
    makeMockMarker,
    makePolygonMarker,
    makeSelected
} from './AreaSelection.helpers';

describe('executeAreaDelete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(pinia);
        useMapStore(pinia).setLayers([]);
        useSelectionStore(pinia).deactivate();
    });

    it('does nothing when no markers are selected', () => {
        const mapStore = useMapStore();
        mapStore.setLayers([makePointLayer('ModalFilters')]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        // No setSelected call — selection is empty

        const markLayerUpdatedSpy = vi.spyOn(mapStore, 'markLayerUpdated');
        executeAreaDelete();

        expect(markLayerUpdatedSpy).not.toHaveBeenCalled();
        expect(selectionStore.isActive).toBe(true);
    });

    it('removes each selected marker from its GeoJSON layer', () => {
        const layer = makePointLayer('ModalFilters');
        const marker = makeMockMarker();
        layer.getLayer().addLayer(marker as unknown as L.Layer);
        expect(layer.getLayer().getLayers()).toHaveLength(1);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', marker)]);

        executeAreaDelete();

        expect(layer.getLayer().getLayers()).toHaveLength(0);
    });

    it('calls markLayerUpdated with points-batch-delete', () => {
        const layer = makePointLayer('ModalFilters');
        const marker = makeMockMarker();
        layer.getLayer().addLayer(marker as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', marker)]);

        executeAreaDelete();

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith({
            kind: 'point-batch-delete',
            layerId: 'ModalFilters',
            payload: {
                points: [null]
            }
        });
    });

    it('deactivates the selection store after deleting', () => {
        const layer = makePointLayer('ModalFilters');
        const marker = makeMockMarker();
        layer.getLayer().addLayer(marker as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', marker)]);

        executeAreaDelete();

        expect(selectionStore.isActive).toBe(false);
        expect(selectionStore.selected).toHaveLength(0);
    });

    it('handles markers across multiple layers in a single call', () => {
        const layer1 = makePointLayer('ModalFilters');
        const layer2 = makePointLayer('BusGates');
        const m1 = makeMockMarker();
        const m2 = makeMockMarker();
        layer1.getLayer().addLayer(m1 as unknown as L.Layer);
        layer2.getLayer().addLayer(m2 as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer1, layer2]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([
            makeSelected('ModalFilters', m1),
            makeSelected('BusGates', m2)
        ]);

        executeAreaDelete();

        expect(layer1.getLayer().getLayers()).toHaveLength(0);
        expect(layer2.getLayer().getLayers()).toHaveLength(0);
    });

    it('calls markLayerUpdated once with no mutation for multi-layer point batches', () => {
        const layer1 = makePointLayer('ModalFilters');
        const layer2 = makePointLayer('BusGates');
        const m1 = makeMockMarker();
        const m2 = makeMockMarker();
        layer1.getLayer().addLayer(m1 as unknown as L.Layer);
        layer2.getLayer().addLayer(m2 as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer1, layer2]);
        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([
            makeSelected('ModalFilters', m1),
            makeSelected('BusGates', m2)
        ]);

        executeAreaDelete();

        // Exactly one call with no mutation — snapshot fallback restores both layers.
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith();
    });

    it('accumulates multiple same-layer points into one point-batch-delete call', () => {
        const layer = makePointLayer('ModalFilters');
        const m1 = makeMockMarker();
        const m2 = makeMockMarker();
        layer.getLayer().addLayer(m1 as unknown as L.Layer);
        layer.getLayer().addLayer(m2 as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);
        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([
            makeSelected('ModalFilters', m1),
            makeSelected('ModalFilters', m2)
        ]);

        executeAreaDelete();

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith({
            kind: 'point-batch-delete',
            layerId: 'ModalFilters',
            payload: { points: [null, null] }
        });
    });

    it('single polygon delete emits polygon-batch-delete structured mutation', () => {
        const layer = {
            ...makePointLayer('LtnCells'),
            kind: 'polygon' as const
        } as unknown as IMapLayer;
        const polygon = makePolygonMarker();
        layer.getLayer().addLayer(polygon as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);
        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('LtnCells', polygon)]);

        executeAreaDelete();

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith({
            kind: 'polygon-batch-delete',
            layerId: 'LtnCells',
            payload: { before: null }
        });
    });

    it('silently skips a marker whose layer is not in the store', () => {
        const mapStore = useMapStore();
        mapStore.setLayers([]); // empty — no layers registered

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', makeMockMarker())]);

        // Should not throw
        expect(() => executeAreaDelete()).not.toThrow();
    });
});
