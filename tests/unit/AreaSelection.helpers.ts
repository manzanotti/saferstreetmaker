/**
 * Shared layer/marker factories for the area-selection unit tests.
 */
import { vi } from 'vitest';
import * as L from 'leaflet';
import { type SelectedMarker } from '../../src/stores/selectionStore';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';

/** Minimal IMapLayer stub with a real GeoJSON layer for testing. */
export function makePointLayer(id: string): IMapLayer {
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
export function makePolylineLayer(id: string): IMapLayer {
    return {
        ...makePointLayer(id),
        kind: 'polyline'
    } as unknown as IMapLayer;
}

export function makeMockMarker(): L.Layer {
    return {
        _isMock: true,
        getLatLng: () => ({ lat: 1, lng: 2 }),
        toGeoJSON: () => null
    } as unknown as L.Layer;
}

/** Polygon marker — no getLatLng so isPointMarker is false; has getLatLngs. */
export function makePolygonMarker(): L.Layer {
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

export function makeSelected(layerId: string, marker: L.Layer): SelectedMarker {
    return {
        layerId,
        historyId: 'h-1',
        latLng: { lat: 1, lng: 2 } as L.LatLng,
        marker
    };
}
