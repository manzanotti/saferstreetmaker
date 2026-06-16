import { createApp } from 'vue';
import { FileManager } from './scripts/FileManager';
import { MapContainer } from './scripts/MapContainer';
import { initTabs } from './scripts/initTabs';
import App from './App.vue';
import { pinia } from './stores/index';

// Mount the Vue app shell (overlay components added in Phase 2+)
createApp(App).use(pinia).mount('#app');

// Bootstrap the Leaflet map exactly as the original scripts/index.ts did,
// preserving DOMContentLoaded timing so Playwright tests keep working.
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();

  const fileManager = new FileManager();
  const mapContainer = new MapContainer(fileManager);

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
      if (!isNaN(lat) && !isNaN(lng)) {
        centre = [lat, lng];
      }
    }
  }

  const mapLoaded = await mapContainer.loadMap(remoteMapFile, hash, hideToolbar, zoom, centre);

  if (!mapLoaded && window.navigator.geolocation) {
    window.navigator.geolocation.getCurrentPosition(
      mapContainer.setUserLocation,
      mapContainer.setDefaultView,
    );
  }
});
