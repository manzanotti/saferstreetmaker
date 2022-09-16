import * as L from 'leaflet';
import 'leaflet-toolbar/src/Action';

export interface IMapLayer {
    id: string;
    title: string;
    addMarker: (points: Array<L.LatLng>) => void;
    deselectLayer: () => void;
    getToolbarAction: (map: L.Map) => L.Toolbar2.Action;
    loadFromGeoJSON: (geoJson: L.GeoJSON) => void;
    getLayer: () => L.GeoJSON;
}
