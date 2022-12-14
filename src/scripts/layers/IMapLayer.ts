import * as L from 'leaflet';
import 'leaflet-toolbar';

export interface IMapLayer {
    id: string;
    title: string;
    addMarker: (points: Array<L.LatLng>) => void;
    selectLayer: () => void;
    deselectLayer: () => void;
    getToolbarAction: (map: L.Map) => L.Toolbar2.Action;
    getLegendEntry: () => Array<HTMLElement>;
    loadFromGeoJSON: (geoJson: L.GeoJSON) => void;
    getLayer: () => L.GeoJSON;
    toGeoJSON: () => {};
}
