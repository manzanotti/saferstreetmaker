/**
 * Shared map/feature factories for the LtnLayer unit tests.
 */
import * as L from 'leaflet';

export function makeMockMap(): L.Map {
    return new L.Map();
}

export function polygonFeatureCollection(polygons: [number, number][][][]) {
    return {
        features: polygons.map((rings) => ({
            geometry: { type: 'Polygon', coordinates: rings },
            properties: { label: 'LTN 1', color: '#cc00cc' }
        }))
    };
}
