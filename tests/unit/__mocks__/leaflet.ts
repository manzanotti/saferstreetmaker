/**
 * Shared Leaflet mock for unit tests.
 * Import this file's path in vi.mock() calls.
 *
 * Usage in a test file:
 *   vi.mock('leaflet', () => import('../__mocks__/leaflet'));
 */
export { LatLng, LatLngBounds, latLngBounds, Point, point } from './leaflet-mock/geometry';
export { CircleMarker, Polyline, Polygon } from './leaflet-mock/vectors';
export {
    GeoJSON,
    geoJSON,
    layerGroup,
    circleMarker,
    rectangle,
    Marker,
    DivIcon,
    popup
} from './leaflet-mock/layers';
export { DomEvent, Draw, Map, TileLayer, Control, DomUtil } from './leaflet-mock/map';
