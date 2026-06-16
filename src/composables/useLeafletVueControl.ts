import * as L from 'leaflet';
import { createApp, type Component } from 'vue';
import { pinia } from '../stores/index';

/**
 * Creates a Leaflet control that mounts a Vue component inside it.
 * All mounted components share the app-wide Pinia instance so they
 * can read/write the same stores as App.vue.
 *
 * Click and scroll propagation to the Leaflet map is disabled on the
 * container element so interactions with the control are not accidentally
 * forwarded to the map.
 */
export function makeLeafletVueControl(
  Component: Component,
  position: L.ControlPosition = 'topleft',
): L.Control {
  const control = new L.Control({ position });

  control.onAdd = (): HTMLElement => {
    const container = L.DomUtil.create('div');
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    createApp(Component).use(pinia).mount(container);
    return container;
  };

  return control;
}
