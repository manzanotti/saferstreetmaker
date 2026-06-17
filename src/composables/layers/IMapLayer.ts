import * as L from 'leaflet';
import { ToolbarButton } from '../../models/ToolbarButton';

export interface IMapLayer {
  id: string;
  title: string;
  selected: boolean;
  visible: boolean;
  groupName: string;

  getToolbarButton: () => ToolbarButton;
  getLegendEntry: () => HTMLElement;
  loadFromGeoJSON: (geoJson: L.GeoJSON) => void;
  getLayer: () => L.GeoJSON;
  toGeoJSON: () => {};
  clearLayer: () => void;
}
