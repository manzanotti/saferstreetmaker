/**
 * Tests for useAreaSelection — executeAreaDelete() for polylines, polygons and vertices.
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
    makePolylineLayer,
    makeMockMarker,
    makeSelected
} from './AreaSelection.helpers';

describe('executeAreaDelete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(pinia);
        useMapStore(pinia).setLayers([]);
        useSelectionStore(pinia).deactivate();
    });

    it('removes a selected polyline or polygon feature from its GeoJSON layer when no getLatLngs', () => {
        // Fallback: a feature with no getLatLngs should be removed wholesale
        const layer = makePolylineLayer('MobilityLanes');
        const polyline = makeMockMarker(); // no getLatLngs on mock
        layer.getLayer().addLayer(polyline as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('MobilityLanes', polyline)]);

        executeAreaDelete();

        expect(layer.getLayer().getLayers()).toHaveLength(0);
    });

    it('deletes a polygon feature entirely (kind=polygon) even with multiple vertex entries', () => {
        const layer = {
            ...makePointLayer('LtnCells'),
            kind: 'polygon' as const
        } as unknown as IMapLayer;
        const polygon = makeMockMarker();
        layer.getLayer().addLayer(polygon as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([
            makeSelected('LtnCells', polygon),
            makeSelected('LtnCells', polygon),
            makeSelected('LtnCells', polygon)
        ]);

        executeAreaDelete();

        expect(layer.getLayer().getLayers()).toHaveLength(0);
    });

    it('removes only selected vertices from a polyline, leaving the rest intact', () => {
        const layer = makePolylineLayer('MobilityLanes');
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
        const capturedLatLngs: L.LatLng[] = [];

        const polyline = {
            getLatLngs: () => [v1, v2, v3],
            setLatLngs: (latlngs: L.LatLng[]) => {
                capturedLatLngs.length = 0;
                capturedLatLngs.push(...latlngs);
            }
        } as unknown as L.Layer;
        layer.getLayer().addLayer(polyline as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        // Select only the middle vertex
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: null, latLng: v2, marker: polyline }
        ]);

        executeAreaDelete();

        // Polyline stays in the layer (not removed)
        expect(layer.getLayer().getLayers()).toHaveLength(1);
        // setLatLngs called with the two unselected vertices
        expect(capturedLatLngs).toHaveLength(2);
        expect(capturedLatLngs).toContain(v1);
        expect(capturedLatLngs).toContain(v3);
    });

    it('records polyline-vertices-delete with before/after coordinates', () => {
        const layer = makePolylineLayer('MobilityLanes');
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;

        const polyline = {
            feature: { properties: { historyId: 'line-1' } },
            getLatLngs: () => [v1, v2, v3],
            setLatLngs: vi.fn()
        } as unknown as L.Layer;
        layer.getLayer().addLayer(polyline as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);
        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: 'line-1', latLng: v2, marker: polyline }
        ]);

        executeAreaDelete();

        expect(spy).toHaveBeenCalledWith({
            kind: 'polyline-vertices-delete',
            layerId: 'MobilityLanes',
            payload: {
                historyId: 'line-1',
                beforeCoordinates: [
                    [1, 1],
                    [2, 2],
                    [3, 3]
                ],
                afterCoordinates: [
                    [1, 1],
                    [3, 3]
                ]
            }
        });
    });

    it('removes the whole polyline when fewer than 2 vertices would remain', () => {
        const layer = makePolylineLayer('MobilityLanes');
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;

        const polyline = {
            getLatLngs: () => [v1, v2],
            setLatLngs: vi.fn()
        } as unknown as L.Layer;
        layer.getLayer().addLayer(polyline as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: null, latLng: v1, marker: polyline },
            { layerId: 'MobilityLanes', historyId: null, latLng: v2, marker: polyline }
        ]);

        executeAreaDelete();

        // Line is gone; setLatLngs should not have been called
        expect(layer.getLayer().getLayers()).toHaveLength(0);
        expect((polyline as any).setLatLngs).not.toHaveBeenCalled();
    });
});
