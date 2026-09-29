import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';
import { setFeatureGroupHidden } from '../../src/features/groups/featureVisibility';
import { getVisibleLegendLayers } from '../../src/features/export/visibleLegendLayers';

function createMap(zoom = 18) {
    const container = document.createElement('div');
    const southWest = new L.LatLng(0, 0);
    const northEast = new L.LatLng(100, 100);
    const bounds = {
        getSouthWest: () => southWest,
        getNorthEast: () => northEast,
        getSouth: () => southWest.lat,
        getNorth: () => northEast.lat,
        getWest: () => southWest.lng,
        getEast: () => northEast.lng,
        contains: (point: L.LatLng) =>
            point.lat >= southWest.lat &&
            point.lat <= northEast.lat &&
            point.lng >= southWest.lng &&
            point.lng <= northEast.lng
    } as unknown as L.LatLngBounds;
    return {
        getContainer: () => container,
        getBounds: () => bounds,
        getSize: () => ({ x: 100, y: 100 }),
        getZoom: () => zoom,
        getMaxZoom: () => 18,
        latLngToContainerPoint: (latLng: L.LatLng) => ({ x: latLng.lng, y: 100 - latLng.lat }),
        hasLayer: () => true
    } as unknown as L.Map;
}

function createPoint(lat: number, lng: number) {
    const marker = new L.CircleMarker(new L.LatLng(lat, lng));
    return Object.assign(marker, { getLatLng: () => marker.latlng });
}

function createFeatureGroup(features: L.Layer[]) {
    return {
        eachLayer(callback: (feature: L.Layer) => void) {
            features.forEach(callback);
        }
    } as unknown as L.GeoJSON;
}

function createLayer(id: string, feature: L.Layer): IMapLayer {
    return {
        id,
        title: id,
        selected: false,
        visible: true,
        groupName: '',
        kind: 'point',
        iconHtml: '',
        getToolbarButton: () => ({}) as never,
        getLegendEntry: () => document.createElement('li'),
        loadFromGeoJSON: () => {},
        getLayer: () => createFeatureGroup([feature]),
        toGeoJSON: () => ({}),
        clearLayer: () => {}
    };
}

function filter(
    layers: IMapLayer[],
    map = createMap(),
    visibleIds = new Set(layers.map((layer) => layer.id))
) {
    return getVisibleLegendLayers({
        map,
        layers,
        activeLayerIds: layers.map((layer) => layer.id),
        visibleLayerIds: visibleIds,
        legendLayerIds: null
    });
}

describe('getVisibleLegendLayers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('includes points whose symbols overlap the viewport and excludes outside points', () => {
        const inside = createPoint(50, 50);
        const outside = createPoint(150, 150);

        expect(filter([createLayer('inside', inside), createLayer('outside', outside)])).toEqual([
            expect.objectContaining({ id: 'inside' })
        ]);
    });

    it('includes a polyline crossing the viewport even when both endpoints are outside', () => {
        const crossing = new L.Polyline([new L.LatLng(50, -10), new L.LatLng(50, 110)]);

        expect(filter([createLayer('crossing', crossing)])).toHaveLength(1);
    });

    it('does not bridge separate offscreen line paths just because their combined bounds overlap', () => {
        const separatePaths = new L.Polyline([
            [new L.LatLng(-10, -10), new L.LatLng(-5, -5)],
            [new L.LatLng(105, 105), new L.LatLng(110, 110)]
        ] as never);

        expect(filter([createLayer('outside', separatePaths)])).toHaveLength(0);
    });

    it('includes polygons enclosing the viewport and excludes disjoint polygons', () => {
        const enclosing = new L.Polygon([
            new L.LatLng(-10, -10),
            new L.LatLng(-10, 110),
            new L.LatLng(110, 110),
            new L.LatLng(110, -10)
        ]);
        const outside = new L.Polygon([
            new L.LatLng(120, 120),
            new L.LatLng(120, 130),
            new L.LatLng(130, 130),
            new L.LatLng(130, 120)
        ]);

        expect(
            filter([createLayer('enclosing', enclosing), createLayer('outside', outside)])
        ).toEqual([expect.objectContaining({ id: 'enclosing' })]);
    });

    it('omits group-hidden features, disabled layers, and features hidden at the current zoom', () => {
        const hidden = createPoint(50, 50);
        setFeatureGroupHidden(hidden, true);
        const lowZoom = createMap(10);
        const visible = createPoint(50, 50);

        expect(filter([createLayer('group-hidden', hidden)])).toHaveLength(0);
        expect(filter([createLayer('disabled', visible)], createMap(), new Set())).toHaveLength(0);
        expect(filter([createLayer('zoom-hidden', visible)], lowZoom)).toHaveLength(0);

        setFeatureGroupHidden(hidden, false);
    });

    it('respects active layers and an existing legend scope without reordering entries', () => {
        const first = createLayer('first', createPoint(50, 50));
        const second = createLayer('second', createPoint(50, 50));
        const result = getVisibleLegendLayers({
            map: createMap(),
            layers: [first, second],
            activeLayerIds: ['second'],
            visibleLayerIds: new Set(['first', 'second']),
            legendLayerIds: new Set(['first', 'second'])
        });

        expect(result).toEqual([second]);
    });
});
