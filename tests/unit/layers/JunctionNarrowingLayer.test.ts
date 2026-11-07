import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createJunctionNarrowingLayer } from '../../../src/composables/layers/useJunctionNarrowingLayer';
import { replayFeatureMutation } from '../../../src/features/history/featureMutationReplay';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { makeMockMap } from './PolylineLayers.helpers';

const feature: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [-1.9, 52.5],
                [-1.8, 52.5],
                [-1.8, 52.6],
                [-1.9, 52.5]
            ],
            [
                [-1.89, 52.51],
                [-1.88, 52.51],
                [-1.88, 52.52],
                [-1.89, 52.51]
            ]
        ]
    },
    properties: { historyId: 'junction-1', name: 'High Street junction' }
};

describe('Junction Narrowing layer', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        useMapStore(pinia).setDrawLayer(null);
    });

    it('provides a polygon toolbar button and black legend entry', () => {
        const layer = createJunctionNarrowingLayer(makeMockMap());

        expect(layer).toMatchObject({
            id: 'JunctionNarrowings',
            title: 'Junction Narrowings',
            kind: 'polygon',
            selected: false,
            visible: false
        });
        expect(layer.getToolbarButton()).toMatchObject({
            id: 'junction-narrowing',
            tooltip: 'Add junction narrowings to the map',
            iconSrc: expect.any(String)
        });
        expect(layer.getToolbarButton().iconSrc).not.toBe('');
        expect(layer.getLegendEntry().textContent).toContain('Junction Narrowings');
        expect(layer.iconHtml).toContain('rgb(0, 0, 0)');
    });

    it('loads black polygons and preserves geometry, names, and identity', () => {
        const layer = createJunctionNarrowingLayer(makeMockMap());
        layer.loadFromGeoJSON({ type: 'FeatureCollection', features: [feature] });

        const polygon = layer.getLayer().getLayers()[0] as L.Polygon;
        expect(polygon).toBeInstanceOf(L.Polygon);
        expect(polygon.options).toMatchObject({
            color: '#000000',
            fillColor: '#000000',
            fillOpacity: 1
        });
        expect(layer.toGeoJSON().features).toEqual([feature]);
    });

    it('gives cloned features a new identity while preserving their geometry', () => {
        const layer = createJunctionNarrowingLayer(makeMockMap());

        expect(layer.loadFeature?.(feature, 'cloned-junction')).toBe('cloned-junction');
        expect(layer.toGeoJSON().features[0]).toMatchObject({
            geometry: feature.geometry,
            properties: { historyId: 'cloned-junction', name: 'High Street junction' }
        });
    });

    it('rejects invalid polygon rings instead of silently dropping them', () => {
        const layer = createJunctionNarrowingLayer(makeMockMap());
        const invalid: GeoJSON.Feature<GeoJSON.Polygon> = {
            ...feature,
            geometry: { type: 'Polygon', coordinates: [[[-1.9, 52.5]]] }
        };

        expect(() =>
            layer.loadFromGeoJSON({ type: 'FeatureCollection', features: [invalid] })
        ).toThrow('Layer "JunctionNarrowings" contains an invalid polygon feature.');
    });

    it('records drawn polygons as polygon-add mutations', () => {
        const map = makeMockMap();
        const layer = createJunctionNarrowingLayer(map);
        const mapStore = useMapStore(pinia);
        mapStore.setDrawLayer('junction-narrowing');
        const drawn = new L.Polygon([
            new L.LatLng(52.5, -1.9),
            new L.LatLng(52.5, -1.8),
            new L.LatLng(52.6, -1.8)
        ]);

        map.fire('draw:created', { layer: drawn });

        expect(layer.getLayer().getLayers()).toHaveLength(1);
        expect(mapStore.lastLayerMutation).toMatchObject({
            kind: 'polygon-add',
            layerId: 'JunctionNarrowings',
            payload: { geometry: { type: 'Polygon' } }
        });
        mapStore.setDrawLayer(null);
    });

    it('records polygon edits as undoable before-and-after features', () => {
        const layer = createJunctionNarrowingLayer(makeMockMap());
        const mapStore = useMapStore(pinia);
        layer.loadFromGeoJSON({ type: 'FeatureCollection', features: [feature] });
        const polygon = layer.getLayer().getLayers()[0] as L.Polygon & {
            latlngs: L.LatLng[][];
        };
        polygon.latlngs = [
            [
                new L.LatLng(52.5, -1.9),
                new L.LatLng(52.5, -1.7),
                new L.LatLng(52.6, -1.8),
                new L.LatLng(52.5, -1.9)
            ]
        ];
        polygon.fire('edit');

        const mutation = mapStore.lastLayerMutation;
        expect(mutation).toMatchObject({
            kind: 'polygon-edit',
            layerId: 'JunctionNarrowings',
            payload: { before: feature, after: { geometry: { type: 'Polygon' } } }
        });
        if (!mutation) {
            throw new Error('Expected a polygon edit mutation');
        }
        expect(replayFeatureMutation(layer.toGeoJSON(), mutation, 'undo')?.features).toEqual([
            feature
        ]);
    });
});
