/**
 * Shared map/feature factories for the polyline layer unit tests.
 */
import * as L from 'leaflet';

export function makeMockMap(): L.Map {
    return new L.Map();
}

// -----------------------------------------------------------------------
// Helper – build a GeoJSON FeatureCollection for a polyline
// -----------------------------------------------------------------------
export function polylineFeatureCollection(lines: [number, number][][]) {
    return {
        features: lines.map((coords) => ({
            geometry: {
                type: 'LineString',
                coordinates: coords
            }
        }))
    };
}
