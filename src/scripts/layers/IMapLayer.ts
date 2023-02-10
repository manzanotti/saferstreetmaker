import * as L from 'leaflet';
import 'leaflet-toolbar';

export interface IMapLayer {
    id: string;
    title: string;
    getToolbarAction: (map: L.Map) => L.Toolbar2.Action;
    getLegendEntry: () => Array<HTMLElement>;
    loadFromGeoJSON: (geoJson: L.GeoJSON) => void;
    getLayer: () => L.GeoJSON;
    toGeoJSON: () => {};
    clearLayer: () => void;
}
