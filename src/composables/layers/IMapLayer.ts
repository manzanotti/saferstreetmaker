import * as L from 'leaflet';
import { ToolbarButton } from '../../models/ToolbarButton';

export interface IMapLayer {
    id: string;
    title: string;
    selected: boolean;
    visible: boolean;
    groupName: string;
    kind: 'point' | 'polyline' | 'polygon';

    /** Outer HTML of the `<i>` icon element shown in the Legend for this layer. */
    iconHtml: string;

    getToolbarButton: () => ToolbarButton;
    getLegendEntry: () => HTMLElement;
    loadFromGeoJSON: (geoJson: L.GeoJSON) => void;
    loadFeature?: (feature: GeoJSON.Feature, historyId?: string) => string | null;
    getLayer: () => L.GeoJSON;
    toGeoJSON: () => {};
    clearLayer: () => void;
}
