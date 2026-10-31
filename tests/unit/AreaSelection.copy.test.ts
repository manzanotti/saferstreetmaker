/**
 * Tests for useAreaSelection — executeCopy() clipboard entries.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../src/stores/index';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useMapStore } from '../../src/stores/mapStore';
import { executeCopy } from '../../src/composables/useAreaSelection';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';
import {
    makePointLayer,
    makePolylineLayer,
    makeMockMarker,
    makeSelected
} from './AreaSelection.helpers';

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
