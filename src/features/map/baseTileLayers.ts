import * as L from 'leaflet';

export type BaseMapStyle = 'street' | 'satellite';

const SITE_ATTRIBUTION =
    '<a href="https://saferstreetmaker.org" target="_blank">saferstreetmaker.org</a>';

export const STREET_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const SATELLITE_TILE_URL =
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const SATELLITE_LABELS_TILE_URL =
    'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}';

export function createBaseTileLayer(style: BaseMapStyle): L.TileLayer {
    if (style === 'satellite') {
        return new L.TileLayer(SATELLITE_TILE_URL, {
            attribution: `${SITE_ATTRIBUTION} | <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank">Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community</a>`,
            crossOrigin: 'anonymous',
            maxNativeZoom: 23,
            maxZoom: 20
        });
    }

    return new L.TileLayer(STREET_TILE_URL, {
        attribution: `${SITE_ATTRIBUTION} | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors`,
        crossOrigin: 'anonymous',
        maxNativeZoom: 19,
        maxZoom: 20
    });
}

export function createSatelliteLabelsLayer(): L.TileLayer {
    return new L.TileLayer(SATELLITE_LABELS_TILE_URL, {
        attribution:
            '<a href="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer" target="_blank">&copy; Esri, HERE, Garmin, (c) OpenStreetMap contributors</a>',
        crossOrigin: 'anonymous',
        maxNativeZoom: 23,
        maxZoom: 20
    });
}
