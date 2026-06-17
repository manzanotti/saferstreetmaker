import type * as L from 'leaflet';

export interface ToolbarButton {
  id: string;
  text?: string;
  tooltip: string;
  selected: boolean;
  groupName: string;
  buttons?: ToolbarButton[];
  action: (e: Event, map: L.Map) => void;
  isFirst?: boolean;
}
