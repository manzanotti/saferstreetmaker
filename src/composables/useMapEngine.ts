/**
 * useMapEngine.ts
 *
 * Replaces MapContainer's map-infrastructure responsibilities:
 *  - creates the Leaflet map, panes, and tile layer
 *  - wires Leaflet map events (click, keyup, draw:created, zoom, move)
 *  - subscribes to map-level PubSub events still emitted by the legacy layer engine
 *    (showPopup, closePopup) – removed in Phase 3
 *  - bridges Pinia store changes back to PubSub for the legacy layer classes
 *    (layerSelected/Deselected, showLayer/hideLayer) – bridge removed in Phase 3
 */
import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { watch } from 'vue';
import { EventTopics } from '../scripts/EventTopics';
import { useMapStore } from '../stores/mapStore';
import { useSettingsStore } from '../stores/settingsStore';
import { pinia } from '../stores/index';

export interface MapEngineResult {
  map: L.Map;
}

export function setupMapEngine(): MapEngineResult {
  const mapStore = useMapStore(pinia);
  const settingsStore = useSettingsStore(pinia);

  // ── Create the Leaflet map ────────────────────────────────────────────────
  const map = new L.Map('map');
  mapStore.setMap(map);

  // ── Custom panes ─────────────────────────────────────────────────────────
  const ltnsPane = map.createPane('ltns');
  ltnsPane.style.zIndex = '300';
  const filtersPane = map.createPane('filters');
  filtersPane.style.zIndex = '500';

  // ── Tile layer ────────────────────────────────────────────────────────────
  new L.TileLayer('https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    attribution:
      '<a href="https://saferstreetmaker.org" target="_blank">saferstreetmaker.org</a> | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    maxZoom: 20,
  }).addTo(map);

  // ── Leaflet map events ────────────────────────────────────────────────────
  // These still publish PubSub events so the legacy layer classes continue to work.
  map.on('click', (e: L.LeafletMouseEvent) => {
    PubSub.publish(EventTopics.mapClicked, e);
  });

  map.on('keyup', (e: L.LeafletKeyboardEvent) => {
    if (e.originalEvent.key === 'Escape') {
      map.closePopup();
      // Synchronously notify the layer engine that the active layer is deselected.
      // mapStore.activeLayerId is updated via the PubSub subscriber below.
      if (mapStore.activeLayerId !== null) {
        PubSub.publish(EventTopics.layerDeselected, mapStore.activeLayerId);
      }
      mapStore.setActiveLayer(null);
    }
  });

  map.on('draw:created', (e: any) => {
    const layer = e.layer;
    PubSub.publish(EventTopics.drawCreated, { latLngs: layer.getLatLngs(), map });
  });

  map.on('zoomend', () => {
    const zoom = map.getZoom();

    // Keep a zoom-N CSS class on #map for Playwright tests.
    const mapEl = document.getElementById('map');
    if (mapEl) {
      for (let i = mapEl.classList.length - 1; i >= 0; i--) {
        const cls = mapEl.classList[i];
        if (cls.startsWith('zoom')) mapEl.classList.remove(cls);
      }
      mapEl.classList.add(`zoom-${zoom}`);
    }

    PubSub.publish(EventTopics.mapZoomChanged, zoom);
    settingsStore.zoom = zoom;
    settingsStore.centre = map.getCenter();
  });

  map.on('moveend', () => {
    settingsStore.zoom = map.getZoom();
    settingsStore.centre = map.getCenter();
  });

  // ── PubSub subscriptions for map-level popup events ──────────────────────
  // These are published by legacy layer classes and consumed here.
  PubSub.subscribe(EventTopics.showPopup, (_msg: string, popup: L.Popup) => {
    map.openPopup(popup);
  });

  PubSub.subscribe(EventTopics.closePopup, (_msg: string, popup: L.Popup) => {
    map.closePopup(popup);
  });

  // ── Keep mapStore.activeLayerId in sync with layer engine events ──────────
  // When a layer is deselected (e.g., Escape key, or by another layer being
  // selected), reset the store to null so the toolbar deselects the button.
  // We do NOT subscribe to layerSelected here because the toolbar already sets
  // activeLayerId synchronously before btn.action() fires, and the PubSub
  // layerSelected event carries the LAYER id (e.g. 'CarFreeStreets') which
  // differs from the BUTTON id (e.g. 'car-free-street') — overwriting would
  // break the toolbar selected state.
  PubSub.subscribe(EventTopics.layerDeselected, () => {
    mapStore.setActiveLayer(null);
  });

  // When visible layers change, add/remove from Leaflet map directly
  // (no longer going via PubSub hideLayer/showLayer).
  watch(
    () => mapStore.visibleLayerIds,
    (newIds, oldIds) => {
      const layers = mapStore.layers;

      layers.forEach((layer) => {
        const wasVisible = oldIds?.has(layer.id) ?? true;
        const isVisible = newIds.has(layer.id);

        if (wasVisible && !isVisible) {
          layer.visible = false;
          map.removeLayer(layer.getLayer());
        } else if (!wasVisible && isVisible) {
          layer.visible = true;
          map.addLayer(layer.getLayer());
        }
      });
    },
    { deep: false },
  );

  return { map };
}
