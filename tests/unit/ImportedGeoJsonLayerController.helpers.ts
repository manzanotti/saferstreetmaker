/**
 * Shared imported-layer and map fixtures for the ImportedGeoJsonLayerController unit tests.
 */
import { vi } from 'vitest';
import * as L from 'leaflet';
import type { ImportedGeoJsonLayer } from '../../src/models/ImportedGeoJsonLayer';

export function makeLayer(id = 'layer-1', visible = true): ImportedGeoJsonLayer {
    return {
        id,
        name: 'Wards',
        nameProperty: 'name',
        visible,
        featureCollection: {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { name: 'Ward 1' },
                    geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
                }
            ]
        }
    };
}

export function makeLayerWithNullGeometry(): ImportedGeoJsonLayer {
    const layer = makeLayer();
    layer.featureCollection.features.unshift({
        type: 'Feature',
        properties: { name: 'Unknown' },
        geometry: null
    });
    return layer;
}

export function makeMap() {
    return {
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        fire: vi.fn(),
        closePopup: vi.fn(),
        getZoom: vi.fn().mockReturnValue(10),
        getMaxZoom: vi.fn().mockReturnValue(20),
        on: vi.fn()
    } as unknown as L.Map;
}
