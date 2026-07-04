/**
 * useMapEngine.ts
 *
 * Creates the Leaflet map, panes, tile layer, and wires all Leaflet map events.
 * PubSub has been fully removed — all coordination now goes through Pinia stores
 * and direct Leaflet event handlers.
 */
import * as L from 'leaflet';
import { watch } from 'vue';
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
    const map = new L.Map('map', { zoomControl: false });
    mapStore.setMap(map);

    // Zoom control at bottom-right, away from the left-side toolbars.
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // ── Custom panes ─────────────────────────────────────────────────────────
    const ltnsPane = map.createPane('ltns');
    ltnsPane.style.zIndex = '300';
    const filtersPane = map.createPane('filters');
    filtersPane.style.zIndex = '500';

    // ── Tile layer ────────────────────────────────────────────────────────────
    new L.TileLayer('https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution:
            '<a href="https://saferstreetmaker.org" target="_blank">saferstreetmaker.org</a> | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        maxZoom: 20
    }).addTo(map);

    // ── Keyboard: Escape deselects active layer ───────────────────────────────
    map.on('keyup', (e: L.LeafletKeyboardEvent) => {
        if (e.originalEvent.key === 'Escape') {
            map.closePopup();
            mapStore.setActiveLayer(null);
        }
    });

    // ── Zoom: update CSS class and settings store ─────────────────────────────
    map.on('zoomend', () => {
        const zoom = map.getZoom();

        const mapEl = document.getElementById('map');
        if (mapEl) {
            for (let i = mapEl.classList.length - 1; i >= 0; i--) {
                const cls = mapEl.classList[i];
                if (cls.startsWith('zoom')) {
                    mapEl.classList.remove(cls);
                }
            }
            mapEl.classList.add(`zoom-${zoom}`);
        }

        settingsStore.zoom = zoom;
        settingsStore.centre = map.getCenter();
    });

    map.on('moveend', () => {
        settingsStore.zoom = map.getZoom();
        settingsStore.centre = map.getCenter();
    });

    // ── Layer visibility watch ────────────────────────────────────────────────
    // Add/remove layers from the map when visibleLayerIds changes in the store.
    watch(
        () => mapStore.visibleLayerIds,
        (newIds, oldIds) => {
            mapStore.layers.forEach((layer) => {
                const wasVisible = oldIds?.has(layer.id) ?? false;
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
        { deep: false }
    );

    return { map };
}
