import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../src/stores/index';
import { useSelectionStore, type SelectedMarker } from '../../src/stores/selectionStore';
import { useMapStore } from '../../src/stores/mapStore';
import {
    executeAreaDelete,
    executeCopy,
    executePaste,
    polygonIntersectsBounds
} from '../../src/composables/useAreaSelection';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';

/** Minimal IMapLayer stub with a real GeoJSON layer for testing. */
function makePointLayer(id: string): IMapLayer {
    const geoJsonLayer = new L.GeoJSON();
    return {
        id,
        title: id,
        kind: 'point',
        selected: false,
        visible: true,
        groupName: '',
        iconHtml: '',
        getToolbarButton: vi.fn(),
        getLegendEntry: vi.fn(),
        loadFromGeoJSON: vi.fn(),
        getLayer: () => geoJsonLayer,
        toGeoJSON: () => ({}),
        clearLayer: vi.fn()
    } as unknown as IMapLayer;
}

/** Minimal IMapLayer stub for a polyline layer. */
function makePolylineLayer(id: string): IMapLayer {
    return {
        ...makePointLayer(id),
        kind: 'polyline'
    } as unknown as IMapLayer;
}

function makeMockMarker(): L.Layer {
    return {
        _isMock: true,
        getLatLng: () => ({ lat: 1, lng: 2 }),
        toGeoJSON: () => null
    } as unknown as L.Layer;
}

/** Polygon marker — no getLatLng so isPointMarker is false; has getLatLngs. */
function makePolygonMarker(): L.Layer {
    return {
        _isMock: true,
        toGeoJSON: () => null,
        getLatLngs: () => [
            [
                { lat: 0, lng: 0 },
                { lat: 1, lng: 0 },
                { lat: 0, lng: 1 }
            ]
        ]
    } as unknown as L.Layer;
}

function makeSelected(layerId: string, marker: L.Layer): SelectedMarker {
    return {
        layerId,
        historyId: 'h-1',
        latLng: { lat: 1, lng: 2 } as L.LatLng,
        marker
    };
}

describe('polygonIntersectsBounds', () => {
    it('returns true when the rectangle overlaps polygon interior', () => {
        const polygon = {
            getLatLngs: () => [
                [
                    { lat: 0, lng: 0 },
                    { lat: 0, lng: 10 },
                    { lat: 10, lng: 5 }
                ]
            ]
        } as unknown as L.Layer;

        const bounds = {
            contains: (p: L.LatLng) => p.lat >= 2 && p.lat <= 6 && p.lng >= 3 && p.lng <= 7,
            getSouthWest: () => ({ lat: 2, lng: 3 }),
            getNorthEast: () => ({ lat: 6, lng: 7 })
        } as unknown as L.LatLngBounds;

        expect(polygonIntersectsBounds(polygon, bounds)).toBe(true);
    });

    it('returns false when the rectangle only overlaps the polygon bounding box', () => {
        const polygon = {
            getLatLngs: () => [
                [
                    { lat: 0, lng: 0 },
                    { lat: 0, lng: 10 },
                    { lat: 10, lng: 5 }
                ]
            ]
        } as unknown as L.Layer;

        // Small box in the top-left of the polygon bounding box, but fully
        // outside the triangle geometry.
        const bounds = {
            contains: (p: L.LatLng) => p.lat >= 7 && p.lat <= 9 && p.lng >= 0 && p.lng <= 2,
            getSouthWest: () => ({ lat: 7, lng: 0 }),
            getNorthEast: () => ({ lat: 9, lng: 2 })
        } as unknown as L.LatLngBounds;

        expect(polygonIntersectsBounds(polygon, bounds)).toBe(false);
    });
});

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

// ---------------------------------------------------------------------------
// executeCopy
// ---------------------------------------------------------------------------
describe('executeCopy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(pinia);
        useMapStore(pinia).setLayers([]);
        useSelectionStore(pinia).deactivate();
        useSelectionStore(pinia).copyToClipboard([]);
    });

    it('does nothing when no features are selected', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        // No setSelected — selection is empty

        executeCopy();

        expect(selectionStore.clipboard).toHaveLength(0);
    });

    it('stores each unique selected marker as a clipboard entry', () => {
        const layer = makePointLayer('ModalFilters');
        const marker = {
            _isMock: true,
            getLatLng: () => ({ lat: 1, lng: 2 }),
            toGeoJSON: () => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [2, 1] },
                properties: { historyId: 'h-1' }
            })
        } as unknown as L.Layer;
        layer.getLayer().addLayer(marker as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', marker)]);

        executeCopy();

        expect(selectionStore.clipboard).toHaveLength(1);
        expect(selectionStore.clipboard[0].layerId).toBe('ModalFilters');
        expect(selectionStore.clipboard[0].feature.type).toBe('Feature');
    });

    it('deduplicates shared-marker entries (polygon/polyline with multiple vertex rows)', () => {
        const layer = {
            ...makePointLayer('LtnCells'),
            kind: 'polygon' as const
        } as unknown as IMapLayer;
        // Polygon marker with a real toGeoJSON so executeCopy can capture it.
        const polygon = {
            _isMock: true,
            toGeoJSON: () => ({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        [
                            [0, 0],
                            [1, 0],
                            [0, 1],
                            [0, 0]
                        ]
                    ]
                },
                properties: { historyId: 'poly-1' }
            }),
            getLatLngs: () => [
                [
                    { lat: 0, lng: 0 },
                    { lat: 1, lng: 0 },
                    { lat: 0, lng: 1 }
                ]
            ]
        } as unknown as L.Layer;
        layer.getLayer().addLayer(polygon as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        // Same marker, three vertex entries
        selectionStore.setSelected([
            makeSelected('LtnCells', polygon),
            makeSelected('LtnCells', polygon),
            makeSelected('LtnCells', polygon)
        ]);

        executeCopy();

        // Should only appear once in the clipboard
        expect(selectionStore.clipboard).toHaveLength(1);
    });

    it('skips markers whose toGeoJSON returns null', () => {
        const layer = makePointLayer('ModalFilters');
        const marker = makeMockMarker(); // toGeoJSON returns null
        layer.getLayer().addLayer(marker as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', marker)]);

        executeCopy();

        expect(selectionStore.clipboard).toHaveLength(0);
    });

    it('sets hasClipboard to true after a successful copy', () => {
        const layer = makePointLayer('ModalFilters');
        const marker = {
            _isMock: true,
            getLatLng: () => ({ lat: 1, lng: 2 }),
            toGeoJSON: () => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [2, 1] },
                properties: {}
            })
        } as unknown as L.Layer;
        layer.getLayer().addLayer(marker as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', marker)]);

        expect(selectionStore.hasClipboard).toBe(false);
        executeCopy();
        expect(selectionStore.hasClipboard).toBe(true);
    });

    it('copies only the selected polyline vertices rather than the whole line', () => {
        const layer = makePolylineLayer('MobilityLanes');
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
        const polyline = {
            getLatLngs: () => [v1, v2, v3],
            toGeoJSON: () => ({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [1, 1],
                        [2, 2],
                        [3, 3]
                    ]
                },
                properties: { historyId: 'line-1' }
            })
        } as unknown as L.Layer;
        layer.getLayer().addLayer(polyline as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: 'line-1', latLng: v2, marker: polyline },
            { layerId: 'MobilityLanes', historyId: 'line-1', latLng: v3, marker: polyline }
        ]);

        executeCopy();

        expect(selectionStore.clipboard).toHaveLength(1);
        expect(selectionStore.clipboard[0].feature.geometry).toEqual({
            type: 'LineString',
            coordinates: [
                [2, 2],
                [3, 3]
            ]
        });
    });
});

// ---------------------------------------------------------------------------
// executePaste
// ---------------------------------------------------------------------------
describe('executePaste', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(pinia);
        useMapStore(pinia).setLayers([]);
        useSelectionStore(pinia).deactivate();
        useSelectionStore(pinia).copyToClipboard([]);
    });

    it('does nothing when clipboard is empty', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);
        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        executePaste();

        expect(layer.loadFromGeoJSON).not.toHaveBeenCalled();
        expect(spy).not.toHaveBeenCalled();
    });

    it('calls loadFromGeoJSON on the target layer with the clipboard features', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'original-id' }
        };

        const selectionStore = useSelectionStore();
        selectionStore.copyToClipboard([{ layerId: 'ModalFilters', feature }]);

        executePaste();

        expect(layer.loadFromGeoJSON).toHaveBeenCalledOnce();
        const call = (layer.loadFromGeoJSON as ReturnType<typeof vi.fn>).mock.calls[0][0] as any;
        expect(call.type).toBe('FeatureCollection');
        expect(call.features).toHaveLength(1);
    });

    it('assigns a new historyId to each pasted feature', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'original-id' }
        };

        const selectionStore = useSelectionStore();
        selectionStore.copyToClipboard([{ layerId: 'ModalFilters', feature }]);

        executePaste();

        const call = (layer.loadFromGeoJSON as ReturnType<typeof vi.fn>).mock.calls[0][0] as any;
        const pastedHistoryId = call.features[0].properties?.historyId;
        expect(pastedHistoryId).toBeDefined();
        expect(pastedHistoryId).not.toBe('original-id');
    });

    it('calls markLayerUpdated once after pasting', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);
        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'h-1' }
        };

        useSelectionStore().copyToClipboard([{ layerId: 'ModalFilters', feature }]);

        executePaste();

        expect(spy).toHaveBeenCalledOnce();
    });

    it('skips clipboard entries whose layer is not in the store', () => {
        const mapStore = useMapStore();
        mapStore.setLayers([]);
        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: {}
        };

        useSelectionStore().copyToClipboard([{ layerId: 'ModalFilters', feature }]);

        // Should not throw, and markLayerUpdated is still called
        expect(() => executePaste()).not.toThrow();
        expect(spy).toHaveBeenCalledOnce();
    });

    it('groups multiple clipboard entries for the same layer into one loadFromGeoJSON call', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const mkFeature = (id: string): GeoJSON.Feature => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: id }
        });

        useSelectionStore().copyToClipboard([
            { layerId: 'ModalFilters', feature: mkFeature('a') },
            { layerId: 'ModalFilters', feature: mkFeature('b') }
        ]);

        executePaste();

        expect(layer.loadFromGeoJSON).toHaveBeenCalledOnce();
        const call = (layer.loadFromGeoJSON as ReturnType<typeof vi.fn>).mock.calls[0][0] as any;
        expect(call.features).toHaveLength(2);
    });

    it('does not mutate the original clipboard feature', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'original-id' }
        };

        useSelectionStore().copyToClipboard([{ layerId: 'ModalFilters', feature }]);
        executePaste();

        // The original clipboard entry must be unchanged
        expect(useSelectionStore().clipboard[0].feature.properties?.historyId).toBe('original-id');
    });

    it('makes a hidden target layer visible when pasting into it', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);
        mapStore.visibleLayerIds = new Set();

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'original-id' }
        };

        useSelectionStore().copyToClipboard([{ layerId: 'ModalFilters', feature }]);
        executePaste();

        expect(mapStore.visibleLayerIds.has('ModalFilters')).toBe(true);
    });
});
