/**
 * layerUtils.ts
 *
 * Shared helpers for layer composables (cursor, toolbar button, legend entry).
 * Extracted from LayerHelpers.ts — PubSub removed entirely.
 */
import * as L from 'leaflet';
import { ToolbarButton } from '../../models/ToolbarButton';

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

export function setMapCursor(cssClass: string): void {
  const map = document.getElementById('map');
  map?.classList.remove('leaflet-grab');
  map?.classList.add(cssClass);
}

export function removeMapCursor(cssClass: string): void {
  const map = document.getElementById('map');
  map?.classList.remove(cssClass);
  map?.classList.add('leaflet-grab');
}

// ---------------------------------------------------------------------------
// Toolbar button builder
// ---------------------------------------------------------------------------

export interface ToolbarButtonOpts {
  id: string;
  tooltip: string;
  groupName: string;
  action: (e: Event, map: L.Map) => void;
  selected: boolean;
  isFirst?: boolean;
  text?: string;
}

export function buildToolbarButton(opts: ToolbarButtonOpts): ToolbarButton {
  const button = new ToolbarButton();
  button.id = opts.id;
  button.tooltip = opts.tooltip;
  button.groupName = opts.groupName;
  button.action = opts.action;
  button.selected = opts.selected;
  if (opts.isFirst !== undefined) button.isFirst = opts.isFirst;
  if (opts.text !== undefined) button.text = opts.text;
  return button;
}

// ---------------------------------------------------------------------------
// Legend entry builder
// ---------------------------------------------------------------------------

export interface LegendEntryOpts {
  layerId: string;
  title: string;
  toggleTitle: string;
  iconEl: HTMLElement;
  /** Object whose `visible` property is toggled on click. */
  visibilityState: { visible: boolean };
}

export function buildLegendEntry(opts: LegendEntryOpts): HTMLElement {
  const li = document.createElement('li');
  li.id = `${opts.layerId}-legend`;
  li.setAttribute('title', opts.toggleTitle);
  li.appendChild(opts.iconEl);

  const span = document.createElement('span');
  span.textContent = opts.title;
  li.appendChild(span);

  li.addEventListener('click', () => {
    opts.visibilityState.visible = !opts.visibilityState.visible;
    // Actual map visibility is handled by TheLegend.vue → mapStore.toggleLayerVisibility()
  });

  return li;
}

// ---------------------------------------------------------------------------
// Popup builder for polyline / polygon delete controls
// ---------------------------------------------------------------------------

export function buildDeletePopup(
  map: L.Map,
  popupOptions: L.PopupOptions,
  onDelete: () => void,
): L.Popup {
  const popup = L.popup(popupOptions);

  const controlList = document.createElement('ul');
  controlList.classList.add('popup-buttons');

  const deleteControl = document.createElement('li');
  deleteControl.classList.add('delete-button');
  deleteControl.addEventListener('click', () => {
    onDelete();
    map.closePopup(popup);
  });
  controlList.appendChild(deleteControl);
  popup.setContent(controlList);

  return popup;
}
