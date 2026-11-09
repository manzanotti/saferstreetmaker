import * as L from 'leaflet';

export type BaseMapStyle = 'street' | 'satellite';

const SITE_ATTRIBUTION =
    '<a href="https://saferstreetmaker.org" target="_blank">saferstreetmaker.org</a>';

export const STREET_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const SATELLITE_TILE_URL = 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';

export function createBaseTileLayer(style: BaseMapStyle): L.TileLayer {
    if (style === 'satellite') {
        return new L.TileLayer(SATELLITE_TILE_URL, {
            attribution: `${SITE_ATTRIBUTION} | Imagery &copy; Google`,
            subdomains: ['0', '1', '2', '3'],
            crossOrigin: 'anonymous',
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
