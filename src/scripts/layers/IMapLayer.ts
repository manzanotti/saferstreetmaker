import * as L from 'leaflet';
import 'leaflet-toolbar';

export interface IMapLayer {
    id: string;
    title: string;
    visible: boolean;
    getToolbarAction: (map: L.Map) => L.Toolbar2.Action;
    getLegendEntry: () => HTMLElement;
    loadFromGeoJSON: (geoJson: L.GeoJSON) => void;
    getLayer: () => L.GeoJSON;
    toGeoJSON: () => {};
    clearLayer: () => void;
}
