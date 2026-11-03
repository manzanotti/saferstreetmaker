/**
 * Tests for useAreaSelection — executeCopy() polygon metadata handling.
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
import { makePointLayer, makeSelected } from './AreaSelection.helpers';

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

    it('preserves LTN label and colour in the clipboard feature', () => {
        const layer = {
            ...makePointLayer('LtnCells'),
            kind: 'polygon' as const
        } as unknown as IMapLayer;
        const polygon = {
            _isMock: true,
            properties: { label: 'Zone A', historyId: 'poly-1' },
            options: { color: '#00aa00' },
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
        selectionStore.setSelected([makeSelected('LtnCells', polygon)]);

        executeCopy();

        expect(selectionStore.clipboard).toHaveLength(1);
        expect(selectionStore.clipboard[0].feature.properties).toMatchObject({
            historyId: 'poly-1',
            label: 'Zone A',
            color: '#00aa00'
        });
    });

    it('ignores non-object marker properties when copying polygon metadata', () => {
        const layer = {
            ...makePointLayer('LtnCells'),
            kind: 'polygon' as const
        } as unknown as IMapLayer;
        const polygon = {
            _isMock: true,
            properties: 'Zone A',
            options: { color: '#00aa00' },
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
        selectionStore.setSelected([makeSelected('LtnCells', polygon)]);

        executeCopy();

        expect(selectionStore.clipboard).toHaveLength(1);
        expect(selectionStore.clipboard[0].feature.properties).toEqual({
            historyId: 'poly-1'
        });
    });

    it('ignores non-plain marker properties when copying polygon metadata', () => {
        const layer = {
            ...makePointLayer('LtnCells'),
            kind: 'polygon' as const
        } as unknown as IMapLayer;
        const polygon = {
            _isMock: true,
            properties: new Date('2026-07-06T00:00:00Z'),
            options: { color: '#00aa00' },
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
        selectionStore.setSelected([makeSelected('LtnCells', polygon)]);

        executeCopy();

        expect(selectionStore.clipboard).toHaveLength(1);
        expect(selectionStore.clipboard[0].feature.properties).toEqual({
            historyId: 'poly-1'
        });
    });

    it('does not inject color metadata for non-LTN layers', () => {
        const layer = makePointLayer('ModalFilters');
        const marker = {
            _isMock: true,
            properties: { historyId: 'point-1' },
            options: { color: '#00aa00' },
            getLatLng: () => ({ lat: 1, lng: 2 }),
            toGeoJSON: () => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [2, 1] },
                properties: { historyId: 'point-1' }
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
        expect(selectionStore.clipboard[0].feature.properties).toEqual({
            historyId: 'point-1'
        });
    });

    it('reuses the source feature when no marker metadata is applied', () => {
        const layer = makePointLayer('ModalFilters');
        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'point-1' }
        };
        const marker = {
            _isMock: true,
            getLatLng: () => ({ lat: 1, lng: 2 }),
            toGeoJSON: () => feature
        } as unknown as L.Layer;
        layer.getLayer().addLayer(marker as unknown as L.Layer);

        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const selectionStore = useSelectionStore();
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', marker)]);

        executeCopy();

        (feature.properties as Record<string, unknown>).historyId = 'point-2';

        expect(selectionStore.clipboard).toHaveLength(1);
        expect(selectionStore.clipboard[0].feature.properties).toEqual({
            historyId: 'point-2'
        });
    });
});
