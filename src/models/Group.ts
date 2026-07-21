import type * as L from 'leaflet';

export interface GroupMember {
    layerId: string;
    historyId: string;
}

export interface Group {
    id: string;
    name: string;
    members: GroupMember[];
}

export interface PartialPolylineSplit {
    layerId: string;
    layerTitle: string;
    marker: L.Layer;
    selectedLatLngs: L.LatLng[];
    allLatLngs: L.LatLng[];
    clipBounds?: L.LatLngBounds | null;
}
