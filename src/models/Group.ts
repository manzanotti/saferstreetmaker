import type * as L from 'leaflet';

export interface GroupMember {
    layerId: string;
    historyId: string;
}

export interface GroupPhase {
    id: string;
    members: GroupMember[];
}

export interface GroupVersion {
    id: string;
    name: string;
    members: GroupMember[];
    phases?: GroupPhase[];
}

export interface Group {
    id: string;
    name: string;
    /** Optional HTML description shared by every version of this group. */
    description?: string;
    /** Optional colour used when rendering this group's LTN members. */
    color?: string;
    /** New versioned representation. Legacy groups may omit this field. */
    versions?: GroupVersion[];
    /** The version shown after loading a map. */
    defaultVersionId?: string;
    /** Legacy representation, accepted during migration. */
    members?: GroupMember[];
}

export interface PartialPolylineSplit {
    layerId: string;
    layerTitle: string;
    marker: L.Layer;
    selectedLatLngs: L.LatLng[];
    allLatLngs: L.LatLng[];
    clipBounds?: L.LatLngBounds | null;
}
