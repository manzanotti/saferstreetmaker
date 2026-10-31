/**
 * Unit tests for LtnLayer — polygon edit history payloads.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createLtnLayer } from '../../../src/composables/layers/useLtnLayer';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { makeMockMap, polygonFeatureCollection } from './LtnLayer.helpers';

describe('LtnLayer history payloads', () => {
    beforeEach(() => {
        setActivePinia(pinia);
    });

    it('emits compact coordinates and metadata for polygon edits', () => {
        const layer = createLtnLayer(makeMockMap());
        const mapStore = useMapStore(pinia);

        layer.loadFromGeoJSON(
            polygonFeatureCollection([
                [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0]
                    ]
                ]
            ]) as any
        );

        const polygon = layer.getLayer().getLayers()[0] as any;
        polygon.latlngs = [
            new L.LatLng(0, 0),
            new L.LatLng(0, 2),
            new L.LatLng(2, 2),
            new L.LatLng(2, 0),
            new L.LatLng(0, 0)
        ];
        polygon.properties.label = 'LTN 2';
        polygon.options.color = '#00aa00';
        polygon.fire('edit');

        expect(mapStore.lastLayerMutation?.kind).toBe('polygon-edit');
        expect(mapStore.lastLayerMutation?.layerId).toBe('LtnCells');
        expect(mapStore.lastLayerMutation?.payload).toMatchObject({
            historyId: expect.any(String),
            pointChanges: [
                {
                    type: 'update',
                    ringIndex: 0,
                    pointIndex: 1,
                    before: [1, 0],
                    after: [2, 0]
                },
                {
                    type: 'update',
                    ringIndex: 0,
                    pointIndex: 2,
                    before: [1, 1],
                    after: [2, 2]
                },
                {
                    type: 'update',
                    ringIndex: 0,
                    pointIndex: 3,
                    before: [0, 1],
                    after: [0, 2]
                }
            ],
            beforeLabel: 'LTN 1',
            afterLabel: 'LTN 2',
            beforeColor: '#cc00cc',
            afterColor: '#00aa00'
        });
    });

    it('emits insert operations when a polygon gains a vertex', () => {
        const layer = createLtnLayer(makeMockMap());
        const mapStore = useMapStore(pinia);

        layer.loadFromGeoJSON(
            polygonFeatureCollection([
                [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 0]
                    ]
                ]
            ]) as any
        );

        const polygon = layer.getLayer().getLayers()[0] as any;
        polygon.latlngs = [
            new L.LatLng(0, 0),
            new L.LatLng(0, 1),
            new L.LatLng(1, 1),
            new L.LatLng(1, 0),
            new L.LatLng(0, 0)
        ];
        polygon.fire('edit');

        expect(mapStore.lastLayerMutation?.payload).toMatchObject({
            historyId: expect.any(String),
            pointChanges: [
                {
                    type: 'insert',
                    ringIndex: 0,
                    pointIndex: 3,
                    after: [0, 1]
                }
            ]
        });
    });

    it('does not emit point updates for unchanged polygon vertices', () => {
        const layer = createLtnLayer(makeMockMap());
        const mapStore = useMapStore(pinia);

        layer.loadFromGeoJSON(
            polygonFeatureCollection([
                [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0]
                    ]
                ]
            ]) as any
        );

        const polygon = layer.getLayer().getLayers()[0] as any;
        polygon.latlngs = [
            new L.LatLng(0, 0),
            new L.LatLng(0, 1),
            new L.LatLng(1, 1),
            new L.LatLng(1, 0),
            new L.LatLng(0, 0)
        ];
        polygon.fire('edit');

        expect(mapStore.lastLayerMutation?.payload).toMatchObject({
            historyId: expect.any(String),
            beforeCoordinates: expect.any(Array),
            afterCoordinates: expect.any(Array)
        });
        expect(mapStore.lastLayerMutation?.payload).not.toHaveProperty('pointChanges');
    });
});
