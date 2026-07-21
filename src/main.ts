import { createApp } from 'vue';
import App from './App.vue';
import { pinia } from './stores/index';
import { FileManager } from './services/FileManager';
import { useMapStore } from './stores/mapStore';
import { useSettingsStore } from './stores/settingsStore';
import { setupMapEngine } from './composables/useMapEngine';
import { setupMapManager, getMapManager } from './composables/useMapManager';
import { makeLeafletVueControl } from './composables/useLeafletVueControl';
import { createAllLayers } from './composables/layers/index';
import CommandsToolbar from './components/controls/CommandsToolbar.vue';
import LayersToolbar from './components/controls/LayersToolbar.vue';
import Legend from './components/controls/Legend.vue';
import PanelContainer from './components/controls/PanelContainer.vue';
import AreaSelectionPanel from './components/panels/AreaSelectionPanel.vue';
import {
    setupAreaSelection,
    executeAreaDelete,
    executeCopy,
    executePaste,
    clearFeatureHighlight
} from './composables/useAreaSelection';
import { useSelectionStore } from './stores/selectionStore';
import { useUiStore } from './stores/uiStore';

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
    map.addControl(makeLeafletVueControl(CommandsToolbar, 'topleft'));
    map.addControl(makeLeafletVueControl(LayersToolbar, 'topleft'));
    map.addControl(makeLeafletVueControl(AreaSelectionPanel, 'topleft'));
    map.addControl(makeLeafletVueControl(Legend, 'topright'));
    map.addControl(makeLeafletVueControl(PanelContainer, 'bottomleft'));

    // ── Wire area-selection composable ───────────────────────────────────────
    setupAreaSelection(map);

    // ── Global keyboard shortcuts ────────────────────────────────────────────
    // Guard: never intercept shortcuts while the user is typing in an input.
    function isTyping(e: KeyboardEvent): boolean {
        const tag = (e.target as HTMLElement | null)?.tagName ?? '';
        return (
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            (e.target as HTMLElement | null)?.isContentEditable === true
        );
    }

    function isMapContext(e: KeyboardEvent): boolean {
        const target = e.target as HTMLElement | null;
        if (!target) {
            return false;
        }

        return target === document.body || target.id === 'map';
    }

    document.addEventListener('keydown', async (e: KeyboardEvent) => {
        const selectionStore = useSelectionStore(pinia);
        const activeTextSelection = window.getSelection?.()?.toString().trim() ?? '';

        // Group selection highlights features without activating area-selection
        // mode or a drawing layer. Escape should still clear that selection.
        if (
            e.key === 'Escape' &&
            !isTyping(e) &&
            !selectionStore.isActive &&
            selectionStore.selected.length > 0 &&
            mapStore.activeLayerId === null
        ) {
            clearFeatureHighlight();
        }

        // Escape — exit LTN edit mode even when the map no longer owns focus
        // (for example after closing its popup). Other feature layers still
        // use Escape to dismiss the popup while preserving the remembered
        // pre-selection used by additive Shift/Ctrl-click flows.
        if (e.key === 'Escape' && mapStore.activeLayerId === 'ltn') {
            e.preventDefault();
            map.closePopup();
            mapStore.setDrawLayer(null);
            return;
        }

        // s — toggle area-selection mode
        if (
            e.key === 's' &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            !isTyping(e) &&
            isMapContext(e)
        ) {
            e.preventDefault();
            if (selectionStore.isActive) {
                selectionStore.deactivate();
            } else {
                selectionStore.activate();
            }
            return;
        }

        // g — toggle the Groups popup
        if (
            e.key === 'g' &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            !isTyping(e) &&
            isMapContext(e)
        ) {
            e.preventDefault();
            const uiStore = useUiStore(pinia);
            if (uiStore.activePanel === 'groups') {
                uiStore.closePanel();
            } else {
                uiStore.openPanel('groups');
            }
            return;
        }

        // Delete / Backspace — delete the current area selection
        if (
            (e.key === 'Delete' || e.key === 'Backspace') &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            !isTyping(e) &&
            isMapContext(e) &&
            selectionStore.isActive &&
            selectionStore.selected.length > 0
        ) {
            e.preventDefault();
            executeAreaDelete();
            return;
        }

        // Ctrl+Z / Cmd+Z — undo
        if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !isTyping(e)) {
            e.preventDefault();
            await getMapManager().undo();
            return;
        }

        // Ctrl+C / Cmd+C — copy the current area selection
        if (
            e.key === 'c' &&
            (e.ctrlKey || e.metaKey) &&
            !isTyping(e) &&
            activeTextSelection.length === 0 &&
            selectionStore.isActive &&
            selectionStore.selected.length > 0
        ) {
            e.preventDefault();
            executeCopy();
            return;
        }

        // Ctrl+V / Cmd+V — paste the clipboard into the current map
        if (
            e.key === 'v' &&
            (e.ctrlKey || e.metaKey) &&
            !isTyping(e) &&
            selectionStore.isActive &&
            selectionStore.hasClipboard
        ) {
            e.preventDefault();
            executePaste();
            return;
        }

        // Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z — redo
        if (
            ((e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
                (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) &&
            !isTyping(e)
        ) {
            e.preventDefault();
            await getMapManager().redo();
            return;
        }
    });

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

    // One-time cleanup of legacy pan/zoom-only checkpoints from existing undo
    // stacks. Runs after the map has loaded so it never blocks first paint.
    void getMapManager().runViewCheckpointMigration();
});
