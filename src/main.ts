import { createApp } from 'vue';
import App from './App.vue';
import { pinia } from './stores/index';
import { FileManager } from './services/FileManager';
import { useMapStore } from './stores/mapStore';
import { useSettingsStore } from './stores/settingsStore';
import { setupMapEngine } from './composables/useMapEngine';
import { setupMapManager } from './composables/useMapManager';
import { makeLeafletVueControl } from './composables/useLeafletVueControl';
import { createAllLayers } from './composables/layers/index';
import UndoRedoToolbar from './components/controls/UndoRedoToolbar.vue';
import Toolbar from './components/controls/Toolbar.vue';
import Legend from './components/controls/Legend.vue';
import PanelContainer from './components/controls/PanelContainer.vue';

// Mount the Vue overlay app (HelpPanel, ErrorPanel) immediately.
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

    const allLayers = createAllLayers(map);
    mapStore.setLayers(allLayers);

    // Pre-populate activeLayers so the toolbar and legend render before loadMap.
    settingsStore.activeLayers = allLayers.map((l) => l.id);

    // ── Set up map manager (loads/saves maps, wires layer-update and file-loaded callbacks) ─────
    const { loadMap, setUserLocation, setDefaultView } = setupMapManager(fileManager);

    // ── Add Vue-backed Leaflet controls ──────────────────────────────────────
    map.addControl(makeLeafletVueControl(UndoRedoToolbar, 'topleft'));
    map.addControl(makeLeafletVueControl(Toolbar, 'topleft'));
    map.addControl(makeLeafletVueControl(Legend, 'topright'));
    map.addControl(makeLeafletVueControl(PanelContainer, 'bottomleft'));

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
            if (!isNaN(lat) && !isNaN(lng)) {
                centre = [lat, lng];
            }
        }
    }

    const mapLoaded = await loadMap(remoteMapFile, hash, hideToolbar, zoom, centre);

    if (!mapLoaded && window.navigator.geolocation) {
        window.navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation(pos),
            () => setDefaultView()
        );
    }
});
