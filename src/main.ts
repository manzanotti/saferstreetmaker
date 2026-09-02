import { createApp, nextTick } from 'vue';
import App from './App.vue';
import { pinia } from './stores/index';
import { FileManager } from './services/FileManager';
import { useMapStore } from './stores/mapStore';
import { useSettingsStore } from './stores/settingsStore';
import { setupMapEngine } from './composables/useMapEngine';
import { setupMapManager, getMapManager } from './composables/useMapManager';
import { setupKeyboardShortcuts } from './composables/useKeyboardShortcuts';
import { makeLeafletVueControl } from './composables/useLeafletVueControl';
import { createAllLayers } from './composables/layers/index';
import CommandsToolbar from './components/controls/CommandsToolbar.vue';
import LayersToolbar from './components/controls/LayersToolbar.vue';
import Legend from './components/controls/Legend.vue';
import AreaSelectionPanel from './components/panels/AreaSelectionPanel.vue';
import { setupAreaSelection } from './composables/useAreaSelection';
import { viewGroupVersion } from './composables/useGroups';
import { useGroupStore } from './stores/groupStore';
import { useUiStore } from './stores/uiStore';
import { getGroupVersions } from './features/groups/groupVersions';
import { parseGeoJson } from './features/map/importedGeoJson';
import type { ImportedGeoJsonLayer } from './models/ImportedGeoJsonLayer';

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

    let defaultImportedLayers: ImportedGeoJsonLayer[] = [];
    const defaultLayerPromise = fetch('/Birmingham%20Wards.geojson')
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const featureCollection = parseGeoJson(await response.json());
            return {
                id: 'birmingham-wards',
                name: 'Birmingham Wards',
                nameProperty: 'wd25nm',
                visible: false,
                featureCollection
            };
        })
        .catch((error) => {
            console.warn('Unable to load the default Birmingham Wards layer.', error);
            return null;
        });

    // ── Set up map manager (loads/saves maps, wires layer-update and file-loaded callbacks) ─────
    const {
        loadMap,
        setUserLocation,
        setDefaultView,
        getMapGeneration,
        initialiseDefaultImportedLayers
    } = setupMapManager(fileManager, () => defaultImportedLayers);

    // ── Add Vue-backed Leaflet controls ──────────────────────────────────────
    map.addControl(makeLeafletVueControl(CommandsToolbar, 'topleft'));
    map.addControl(makeLeafletVueControl(LayersToolbar, 'topleft'));
    map.addControl(makeLeafletVueControl(AreaSelectionPanel, 'topleft'));
    map.addControl(makeLeafletVueControl(Legend, 'topright'));

    // ── Wire area-selection composable ───────────────────────────────────────
    setupAreaSelection(map);

    // ── Global keyboard shortcuts ────────────────────────────────────────────
    setupKeyboardShortcuts(map);

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
    const initialMapGeneration = getMapGeneration();

    void defaultLayerPromise.then((defaultLayer) => {
        if (!defaultLayer) {
            return;
        }
        defaultImportedLayers = [defaultLayer];
        if (!mapLoaded && remoteMapFile === null && hash === '') {
            initialiseDefaultImportedLayers([defaultLayer], initialMapGeneration);
        }
    });

    if (mapLoaded) {
        const groupReference = params.get('group');
        const versionNumber = Number(params.get('version'));
        const groupStore = useGroupStore(pinia);
        const group = groupReference
            ? (groupStore.groups.find((item) => item.id === groupReference) ??
              groupStore.groups.find(
                  (item) => item.name.trim().toLowerCase() === groupReference.trim().toLowerCase()
              ))
            : undefined;
        const versions = group ? getGroupVersions(group) : [];
        const version =
            Number.isInteger(versionNumber) && versionNumber > 0
                ? versions[versionNumber - 1]
                : undefined;

        if (group && version) {
            settingsStore.readOnly = true;
        }

        if (group && version && viewGroupVersion(group.id, version.id)) {
            const hasDescription = Boolean(group.description?.trim());
            const hasPhases = (version.phases?.length ?? 0) > 0;
            if (hasDescription || hasPhases) {
                groupStore.openDetailsDialog(group.id);
            }
        }

        if (group && version) {
            await nextTick();
            useUiStore(pinia).setLegendLayerIds(
                new Set(version.members.map((member) => member.layerId))
            );
        }
    }

    if (!mapLoaded && window.navigator.geolocation) {
        window.navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation(pos),
            () => setDefaultView()
        );
    }

    // One-time cleanup of legacy pan/zoom-only checkpoints from existing undo
    // stacks. Runs after the map has loaded so it never blocks first paint.
    void getMapManager().runViewCheckpointMigration();
});
