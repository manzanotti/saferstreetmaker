import { createApp } from 'vue';
import * as L from 'leaflet';
import App from './App.vue';
import { pinia } from './stores/index';
import { FileManager } from './scripts/FileManager';
import { ModalFilterLayer } from './scripts/layers/ModalFilterLayer';
import { MobilityLaneLayer } from './scripts/layers/MobilityLaneLayer';
import { TramLineLayer } from './scripts/layers/TramLineLayer';
import { CarFreeStreetLayer } from './scripts/layers/CarFreeStreetLayer';
import { SchoolStreetLayer } from './scripts/layers/SchoolStreetLayer';
import { OneWayStreetLayer } from './scripts/layers/OneWayStreetLayer';
import { LtnLayer } from './scripts/layers/LtnLayer';
import { BusGateLayer } from './scripts/layers/BusGateLayer';
import { TrafficLightsLayer } from './scripts/layers/TrafficLightsLayer';
import { PedestrianLightsLayer } from './scripts/layers/PedestrianLightsLayer';
import { ZebraCrossingLayer } from './scripts/layers/ZebraCrossingLayer';
import { useMapStore } from './stores/mapStore';
import { useSettingsStore } from './stores/settingsStore';
import { setupMapEngine } from './composables/useMapEngine';
import { setupMapManager } from './composables/useMapManager';
import { makeLeafletVueControl } from './composables/useLeafletVueControl';
import TheToolbar from './components/controls/TheToolbar.vue';
import TheLegend from './components/controls/TheLegend.vue';
import TheModalContainer from './components/controls/TheModalContainer.vue';

// Mount the Vue overlay app (HelpModal, ErrorModal) immediately.
createApp(App).use(pinia).mount('#app');

// Bootstrap the Leaflet map in DOMContentLoaded — identical timing to the
// original scripts/index.ts so Playwright test timings are unaffected.
document.addEventListener('DOMContentLoaded', async () => {
  const fileManager = new FileManager();

  // ── Initialise Leaflet map + engine ──────────────────────────────────────
  const { map } = setupMapEngine();

  // ── Register all layer instances in the store ────────────────────────────
  const mapStore = useMapStore(pinia);
  const settingsStore = useSettingsStore(pinia);

  const allLayers = [
    new ModalFilterLayer(),
    new MobilityLaneLayer(),
    new TramLineLayer(),
    new CarFreeStreetLayer(),
    new SchoolStreetLayer(),
    new OneWayStreetLayer(),
    new LtnLayer(),
    new BusGateLayer(),
    new TrafficLightsLayer(),
    new PedestrianLightsLayer(),
    new ZebraCrossingLayer(),
  ];
  mapStore.setLayers(allLayers);

  // Pre-populate activeLayers so the toolbar and legend render before loadMap.
  settingsStore.activeLayers = allLayers.map((l) => l.id);

  // ── Set up map manager (loads/saves maps, bridges PubSub events) ─────────
  const { loadMap, setUserLocation, setDefaultView } = setupMapManager(fileManager);

  // ── Add Vue-backed Leaflet controls ──────────────────────────────────────
  map.addControl(makeLeafletVueControl(TheToolbar, 'topleft'));
  map.addControl(makeLeafletVueControl(TheLegend, 'topright'));
  map.addControl(makeLeafletVueControl(TheModalContainer, 'bottomleft'));

  // ── Parse URL params and load initial map ────────────────────────────────
  const params = new URLSearchParams(window.location.search);

  const remoteMapFile = params.get('map');
  const hash = window.location.hash;
  const hideToolbar = params.get('hide-toolbar') === 'true';
  const zoom = params.get('zoom');
  const centreString = params.get('centre');

  let centre: number[] | null = null;
  if (centreString) {
    const parts = centreString.split(',');
    if (parts.length === 2) {
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) centre = [lat, lng];
    }
  }

  const mapLoaded = await loadMap(remoteMapFile, hash, hideToolbar, zoom, centre);

  if (!mapLoaded && window.navigator.geolocation) {
    window.navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation(pos),
      () => setDefaultView(),
    );
  }
});
