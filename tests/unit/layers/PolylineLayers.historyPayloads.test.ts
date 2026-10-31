/**
 * Unit tests for MobilityLanes polyline edit history payloads.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';
import { useMapStore } from '../../../src/stores/mapStore';
import { pinia } from '../../../src/stores/index';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createMobilityLaneLayer } from '../../../src/composables/layers/useMobilityLaneLayer';
import { makeMockMap, polylineFeatureCollection } from './PolylineLayers.helpers';

describe('MobilityLanes history payloads', () => {
    beforeEach(() => {
        setActivePinia(pinia);
    });

    it('emits compact coordinates for polyline edits', () => {
        const mapStore = useMapStore(pinia);
        const layer = createMobilityLaneLayer(makeMockMap());

        layer.loadFromGeoJSON(
            polylineFeatureCollection([
                [
                    [-1.9, 52.5],
                    [-1.8, 52.6]
                ]
            ])
        );

        const line = layer.getLayer().getLayers()[0] as any;
        line.latlngs = [new L.LatLng(52.5, -1.9), new L.LatLng(52.7, -1.7)];
        line.fire('edit');

        expect(mapStore.lastLayerMutation?.kind).toBe('polyline-edit');
        expect(mapStore.lastLayerMutation?.layerId).toBe('MobilityLanes');
        expect(mapStore.lastLayerMutation?.payload).toMatchObject({
            historyId: expect.any(String),
            pointChanges: [
                {
                    type: 'update',
                    index: 1,
                    before: [-1.8, 52.6],
                    after: [-1.7, 52.7]
                }
            ]
        });
    });

    it('emits insert operations when a polyline gains a vertex', () => {
        const mapStore = useMapStore(pinia);
        const layer = createMobilityLaneLayer(makeMockMap());

        layer.loadFromGeoJSON(
            polylineFeatureCollection([
                [
                    [-1.9, 52.5],
                    [-1.7, 52.7]
                ]
            ])
        );

        const line = layer.getLayer().getLayers()[0] as any;
        line.latlngs = [
            new L.LatLng(52.5, -1.9),
            new L.LatLng(52.6, -1.8),
            new L.LatLng(52.7, -1.7)
        ];
        line.fire('edit');

        expect(mapStore.lastLayerMutation?.payload).toMatchObject({
            historyId: expect.any(String),
            pointChanges: [
                {
                    type: 'insert',
                    index: 1,
                    after: [-1.8, 52.6]
                }
            ]
        });
    });

    it('persists name edits with an undoable whole-feature mutation', () => {
        const mapStore = useMapStore(pinia);
        const layer = createMobilityLaneLayer(makeMockMap());
        const popupFactory = vi.spyOn(L, 'popup');
        layer.loadFromGeoJSON({
            features: [
                {
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [-1.9, 52.5],
                            [-1.8, 52.6]
                        ]
                    },
                    properties: { historyId: 'line-1', name: 'Old name' }
                }
            ]
        });

        const line = layer.getLayer().getLayers()[0] as any;
        const popup = popupFactory.mock.results[0].value as any;
        const popupContent = popup.setContent.mock.calls[0][0] as HTMLElement;
        const nameInput = popupContent.querySelector('.name-editor') as HTMLInputElement;
        const nameInputRow = popupContent.querySelector('.feature-name-input-row');
        expect(popupContent.querySelector('.feature-name-editor')?.children).toHaveLength(1);
        expect(nameInputRow?.contains(nameInput)).toBe(true);
        expect(popupContent.querySelector('.apply-name-button')).toBeNull();
        expect(popupContent.children[1].classList.contains('popup-buttons')).toBe(true);

        nameInput.value = 'New name';
        nameInput.dispatchEvent(new Event('blur'));

        expect((layer.toGeoJSON() as any).features[0].properties.name).toBe('New name');
        expect(mapStore.lastLayerMutation).toMatchObject({
            kind: 'polyline-edit',
            layerId: 'MobilityLanes',
            payload: {
                before: { properties: { historyId: 'line-1', name: 'Old name' } },
                after: { properties: { historyId: 'line-1', name: 'New name' } }
            }
        });
    });
});
