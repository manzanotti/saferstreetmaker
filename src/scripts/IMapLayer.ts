import * as L from 'leaflet';
import 'leaflet-toolbar/src/Action';

export interface IMapLayer {
    id: string;
    title: string;
    addMarker: (latitude: number, longitude: number) => void;
    deleteMarker: (e: Event) => void;
    getToolbarAction: () => L.Toolbar2.Action;
    setCursor: () => void;
    removeCursor: () => void;
    loadFromGeoJSON: (geoJson: L.GeoJSON) => void;
    getLayer: () => L.GeoJSON;
}
