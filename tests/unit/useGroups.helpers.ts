/**
 * Shared layer/marker factories for the useGroups unit tests.
 */
import { vi } from 'vitest';
import * as L from 'leaflet';
import { type SelectedMarker } from '../../src/stores/selectionStore';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';

// ── Helpers ───────────────────────────────────────────────────────────────

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

export function makePolylineLayer(id: string): IMapLayer {
    const geoJsonLayer = new L.GeoJSON();
    return {
        ...makePointLayer(id),
        kind: 'polyline',
        getLayer: () => geoJsonLayer,
        loadFromGeoJSON: vi.fn()
    } as unknown as IMapLayer;
}

export function makePointMarker(historyId: string): L.Layer {
    const m = {
        feature: { properties: { historyId } },
        getLatLng: () => ({ lat: 1, lng: 2 }),
        toGeoJSON: () => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId }
        })
    } as unknown as L.Layer;
    return m;
}

export function makePolylineMarker(historyId: string, latlngs: L.LatLng[]): any {
    return {
        feature: { properties: { historyId } },
        getLatLngs: () => latlngs,
        setLatLngs: vi.fn(),
        toGeoJSON: () => ({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: latlngs.map((v) => [v.lng, v.lat]) },
            properties: { historyId }
        })
    };
}

export function makeSelected(
    layerId: string,
    historyId: string,
    marker: L.Layer,
    latLng = { lat: 1, lng: 2 } as unknown as L.LatLng
): SelectedMarker {
    return { layerId, historyId, latLng, marker };
}

/** A point marker that supports setStyle (like a CircleMarker) for visibility tests. */
export function makeStyledMarker(historyId: string): any {
    return {
        feature: { properties: { historyId } },
        options: { opacity: 1, fillOpacity: 0.5 },
        getLatLng: () => ({ lat: 1, lng: 2 }),
        setStyle: vi.fn(function (this: any, style: any) {
            Object.assign(this.options, style);
        }),
        toGeoJSON: () => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId }
        })
    };
}
