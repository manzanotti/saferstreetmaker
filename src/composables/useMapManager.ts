/**
 * useMapManager.ts
 *
 * Replaces MapContainer's map-data responsibilities:
 *  - loadMap / loadMapData / saveMap / createNewMap / applySettings
 *
 * All PubSub removed — layerUpdated is now a Pinia counter watch,
 * fileLoaded is a FileManager callback.
 */
import * as L from 'leaflet';
import { watch } from 'vue';
import { FileManager } from '../services/FileManager';
import { escapeHtml } from '../services/escapeHtml';
import type { SerializedMap } from '../services/MapSerializer';
import { Settings } from '../models/Settings';
import { useMapStore } from '../stores/mapStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { pinia } from '../stores/index';

const APP_VERSION = '0.9.0';

export interface MapManager {
    loadMap: (
        remoteMapFile: string | null,
        hash: string,
        hideToolbar: boolean,
        zoom: string | null,
        centre: number[] | null
    ) => Promise<boolean>;
    saveMap: () => Promise<void>;
    applySettings: (newSettings: Settings) => Promise<void>;
    createNewMap: (title: string) => Promise<boolean>;
    loadMapFromStorage: (mapName: string) => Promise<void>;
    setUserLocation: (position: GeolocationPosition) => void;
    setDefaultView: () => void;
    downloadStorageMap: () => Promise<void>;
}

let _instance: MapManager | null = null;
let _fileManager: FileManager | null = null;

export function getMapManager(): MapManager {
    if (!_instance) {
        throw new Error('MapManager not initialised');
    }
    return _instance;
}

export function getFileManager(): FileManager {
    if (!_fileManager) {
        throw new Error('FileManager not initialised');
    }
    return _fileManager;
}

export function setupMapManager(fileManager: FileManager): MapManager {
    _fileManager = fileManager;
    const mapStore = useMapStore(pinia);
    const settingsStore = useSettingsStore(pinia);
    const uiStore = useUiStore(pinia);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const getMap = (): L.Map => {
        const m = mapStore.map;
        if (!m) {
            throw new Error('Leaflet map not initialised');
        }
        return m;
    };

    // ── View save debounce ────────────────────────────────────────────────────
    let saveViewTimer: ReturnType<typeof setTimeout> | undefined;

    const saveViewDebounced = () => {
        if (saveViewTimer !== undefined) {
            clearTimeout(saveViewTimer);
        }
        saveViewTimer = setTimeout(() => {
            saveViewTimer = undefined;
            saveMap();
        }, 500);
    };

    // Watch settingsStore.zoom/centre changes (set by useMapEngine on zoom/move events)
    // to trigger a debounced save. Replaces the PubSub mapZoomChanged subscription.
    watch([() => settingsStore.zoom, () => settingsStore.centre], () => {
        saveViewDebounced();
    });

    // ── saveMap ───────────────────────────────────────────────────────────────
    const saveMap = async () => {
        try {
            await fileManager.saveMap(settingsStore.toSettings(), mapStore.toLayers());
        } catch (e: any) {
            const errors = ['There was a problem saving the map:', escapeHtml(e.message)];
            if (e.stack) {
                errors.push(escapeHtml(e.stack));
            }
            uiStore.showErrors(errors);
        }
    };

    // ── Layer helpers ─────────────────────────────────────────────────────────
    const addLayersToMap = (activeLayers: string[]) => {
        const map = getMap();
        mapStore.layers.forEach((layer) => {
            if (activeLayers.includes(layer.id)) {
                layer.visible = true;
                map.addLayer(layer.getLayer());
            }
        });
    };

    const removeAllLayersFromMap = () => {
        const map = getMap();
        mapStore.layers.forEach((layer) => map.removeLayer(layer.getLayer()));
    };

    const clearAllLayers = () => {
        const map = getMap();
        mapStore.layers.forEach((layer) => {
            layer.clearLayer();
            map.removeLayer(layer.getLayer());
        });
    };

    const buildAllActiveLayerIds = (): string[] => {
        return mapStore.layers.map((l) => l.id);
    };

    // ── loadMapData ───────────────────────────────────────────────────────────
    const loadMapData = (
        geoJSON: SerializedMap | null,
        zoom: string | null,
        centre: number[] | null
    ): boolean => {
        if (geoJSON === null) {
            return false;
        }

        const map = getMap();

        // Apply settings from JSON
        if (geoJSON.title !== undefined) {
            settingsStore.title = geoJSON.title;
        }

        if (geoJSON.settings !== undefined) {
            const rawCentre = geoJSON.settings.centre;
            const settingsCentre = rawCentre ? new L.LatLng(rawCentre.lat, rawCentre.lng) : null;

            const s: Settings = Object.assign(new Settings(), geoJSON.settings);
            settingsStore.applyFromSettings({
                title: s.title,
                readOnly: s.readOnly,
                hideToolbar: s.hideToolbar,
                activeLayers: s.activeLayers,
                centre: settingsCentre,
                zoom: s.zoom,
                version: s.version
            });
        }

        // Load layer data
        if (geoJSON.layers !== undefined) {
            const layersJSON = geoJSON.layers;
            mapStore.layers.forEach((layer) => {
                let layerName = layer.id;

                // Handle legacy key renames
                if (layerName === 'ModalFilters' && layersJSON['Modals'] !== undefined) {
                    layerName = 'Modals';
                } else if (
                    layerName === 'MobilityLanes' &&
                    layersJSON['CycleLanes'] !== undefined
                ) {
                    layerName = 'CycleLanes';
                }

                const layerJSON = layersJSON[layerName];
                if (layerJSON) {
                    layer.loadFromGeoJSON(layerJSON as L.GeoJSON);
                }

                if (settingsStore.activeLayers.includes(layer.id)) {
                    layer.visible = true;
                    map.addLayer(layer.getLayer());
                } else {
                    map.removeLayer(layer.getLayer());
                }
            });
        }

        // Apply stored centre/zoom from legacy JSON documents (only when settings is absent)
        if (
            geoJSON.settings === undefined &&
            geoJSON.centre !== undefined &&
            geoJSON.zoom !== undefined
        ) {
            settingsStore.centre = new L.LatLng(geoJSON.centre.lat, geoJSON.centre.lng);
            settingsStore.zoom = geoJSON.zoom;
        }

        settingsStore.version = APP_VERSION;

        // URL param overrides
        if (zoom) {
            const z = Number(zoom);
            if (!Number.isNaN(z)) {
                settingsStore.zoom = z;
            }
        }
        if (centre && centre.length === 2) {
            settingsStore.centre = new L.LatLng(centre[0], centre[1]);
        }

        // Set view
        if (settingsStore.centre) {
            map.setView([settingsStore.centre.lat, settingsStore.centre.lng], settingsStore.zoom);
        } else {
            setDefaultView();
        }

        // Sync visibleLayerIds store from the layers that were just added
        const newVisible = new Set(settingsStore.activeLayers);
        mapStore.visibleLayerIds = newVisible;

        return true;
    };

    // ── loadMap ───────────────────────────────────────────────────────────────
    let mapInitialised = false;

    const loadMap = async (
        remoteMapFile: string | null,
        hash: string,
        hideToolbar: boolean,
        zoom: string | null,
        centre: number[] | null
    ): Promise<boolean> => {
        if (mapInitialised) {
            removeAllLayersFromMap();
            resetSettings();
        } else {
            // First load: add layers but don't call addLayersToMap yet (loadMapData does it)
            mapInitialised = true;
        }

        let geoJSON: SerializedMap | null = null;
        let errorIntro = '';
        let loadingFromStorage = false;
        let storageMapName = '';
        const errors: string[] = [];
        let mapLoaded = false;

        try {
            if (remoteMapFile) {
                errorIntro = 'There was a problem loading the map from the remote file location:';
                geoJSON = await fileManager.loadMapFromRemoteFile(remoteMapFile);
            } else if (hash !== '') {
                errorIntro = 'There was a problem loading the map from the hash:';
                geoJSON = fileManager.loadMapFromHash(hash.slice(1));
            } else {
                loadingFromStorage = true;
                const lastMapSelected = await fileManager.loadLastMapSelected();
                storageMapName = lastMapSelected || settingsStore.title;
                errorIntro = 'There was a problem loading the map from local storage:';
                geoJSON = await fileManager.loadMapFromStorage(storageMapName);
            }

            errorIntro = 'There was a problem processing the map file:';
            mapLoaded = loadMapData(geoJSON, zoom, centre);
        } catch (e: any) {
            errors.push(errorIntro);

            errors.push(escapeHtml(e.message));
            errors.push(escapeHtml(e.stack));
            const canDownloadStorageMap =
                loadingFromStorage &&
                storageMapName !== '' &&
                (await fileManager.hasMapInStorage(storageMapName));

            uiStore.showErrors(errors, { showDownloadStorageLink: canDownloadStorageMap });
        }

        settingsStore.hideToolbar = hideToolbar;

        return mapLoaded;
    };

    // ── resetSettings ─────────────────────────────────────────────────────────
    const resetSettings = () => {
        settingsStore.readOnly = false;
        const allLayerIds = buildAllActiveLayerIds();
        settingsStore.activeLayers = allLayerIds;
        mapStore.visibleLayerIds = new Set(allLayerIds);
    };

    // ── applySettings ─────────────────────────────────────────────────────────
    const applySettings = async (newSettings: Settings) => {
        settingsStore.applyFromSettings({
            title: newSettings.title,
            readOnly: newSettings.readOnly,
            hideToolbar: newSettings.hideToolbar,
            activeLayers: newSettings.activeLayers,
            centre: newSettings.centre,
            zoom: newSettings.zoom,
            version: newSettings.version
        });

        // Re-sync which layers are on the map
        removeAllLayersFromMap();
        addLayersToMap(newSettings.activeLayers);

        // Update visible ids to match newly active layers
        mapStore.visibleLayerIds = new Set(newSettings.activeLayers);

        await saveMap();
    };

    // ── createNewMap ──────────────────────────────────────────────────────────
    /**
     * Returns false if the title is already taken (caller shows an error).
     * Returns true on success.
     */
    const createNewMap = async (title: string): Promise<boolean> => {
        const existing = await fileManager.loadMapListFromStorage();
        if (existing.includes(title)) {
            return false;
        }

        clearAllLayers();

        const allLayerIds = buildAllActiveLayerIds();
        const newSettings = new Settings();
        newSettings.title = title;
        newSettings.readOnly = false;
        newSettings.activeLayers = allLayerIds;
        newSettings.zoom = settingsStore.zoom;
        newSettings.centre = settingsStore.centre ?? new L.LatLng(0, 0);

        settingsStore.applyFromSettings({
            title: newSettings.title,
            readOnly: newSettings.readOnly,
            hideToolbar: newSettings.hideToolbar,
            activeLayers: newSettings.activeLayers,
            centre: newSettings.centre,
            zoom: newSettings.zoom,
            version: newSettings.version
        });

        addLayersToMap(allLayerIds);
        mapStore.visibleLayerIds = new Set(allLayerIds);

        await saveMap();
        return true;
    };

    // ── loadMapFromStorage ────────────────────────────────────────────────────
    const loadMapFromStorage = async (mapName: string) => {
        clearAllLayers();
        resetSettings();

        const errors: string[] = [];
        try {
            const mapData = await fileManager.loadMapFromStorage(mapName);
            const ok = loadMapData(mapData, null, null);
            if (ok) {
                await saveMap();
            }
        } catch (e: any) {
            errors.push('There was a problem loading the map:');
            errors.push(escapeHtml(e.message));
            errors.push(escapeHtml(e.stack));
            uiStore.showErrors(errors);
        }
    };

    // ── Geolocation helpers ───────────────────────────────────────────────────
    const setUserLocation = (position: GeolocationPosition) => {
        getMap().setView([position.coords.latitude, position.coords.longitude], 17);
    };

    const setDefaultView = () => {
        getMap().setView([52.5, -1.9], 12);
    };

    // ── downloadStorageMap ────────────────────────────────────────────────────
    const downloadStorageMap = async () => {
        const lastMapSelected = await fileManager.loadLastMapSelected();
        const mapName = lastMapSelected || settingsStore.title;
        const mapJSON = await fileManager.loadMapFromStorage(mapName);
        const mapString = JSON.stringify(mapJSON);
        const blob = new Blob([mapString], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = 'invalidMapData.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    // ── Wire event bridges (replaces PubSub subscriptions) ───────────────────

    // fileLoaded: FileManager calls this callback when a file is loaded via OS picker.
    fileManager.setOnFileLoaded((data: unknown) => {
        uiStore.closeModal();
        clearAllLayers();
        resetSettings();

        const errors: string[] = [];
        try {
            const ok = loadMapData(data as SerializedMap | null, null, null);
            if (ok) {
                void saveMap();
            }
        } catch (e: any) {
            errors.push('There was a problem loading the map from uploaded file:');
            errors.push(escapeHtml(e.message));
            errors.push(escapeHtml(e.stack));
            uiStore.showErrors(errors);
        }
    });

    // layerUpdateCount: watch Pinia counter incremented by layer composables.
    // Replaces PubSub.subscribe(EventTopics.layerUpdated, saveMap).
    watch(
        () => mapStore.layerUpdateCount,
        () => {
            void saveMap();
        }
    );

    _instance = {
        loadMap,
        saveMap,
        applySettings,
        createNewMap,
        loadMapFromStorage,
        setUserLocation,
        setDefaultView,
        downloadStorageMap
    };

    return _instance;
}
