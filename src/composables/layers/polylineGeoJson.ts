import * as L from 'leaflet';
import { isPositionArray } from '../../features/map/geoJsonCoordinates';

/**
 * Load a polyline FeatureCollection into a GeoJSON layer.
 * Handles the legacy "nested coordinates" format.
 */
export function loadPolylineGeoJSON(
    geoJson: GeoJSON.FeatureCollection,
    addFn: (points: L.LatLng[], historyId?: string, name?: string) => void
): void {
    if (!geoJson?.features) {
        return;
    }
    geoJson.features.forEach((feature) => {
        if (feature.geometry?.type !== 'LineString') {
            throw new Error('The layer contains a non-line feature.');
        }
        const points: L.LatLng[] = [];
        const raw: unknown = feature.geometry.coordinates;
        // Legacy: coordinates wrapped in an extra array
        const coords =
            Array.isArray(raw) && raw.length === 1 && isPositionArray(raw[0], 0) ? raw[0] : raw;
        if (!isPositionArray(coords, 0)) {
            throw new Error('The layer contains invalid line coordinates.');
        }
        coords.forEach((c) => points.push(new L.LatLng(c[1], c[0])));
        addFn(points, feature.properties?.historyId, feature.properties?.name);
    });
}
