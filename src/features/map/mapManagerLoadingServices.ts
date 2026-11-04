import * as L from 'leaflet';
import type { Settings } from '../../models/Settings';
import type { SerializedMap } from '../../services/MapSerializer';
import { clearReadOnlyGroupPresentation } from '../../composables/useGroups';
import { createSettingsMutationPayload } from '../history/settingsMutationReplay';
import { cloneImportedLayers } from './importedGeoJson';
import { MapLoadSourceResolver } from './MapLoadSourceResolver';
import { StoredMapLoader } from './StoredMapLoader';
import { NewMapCreator } from './NewMapCreator';
import { StorageMapDownloader } from './StorageMapDownloader';
import { SettingsApplier } from './SettingsApplier';
import { MapLoadCoordinator } from './MapLoadCoordinator';
import { APP_VERSION, type MapManagerContext } from './mapManagerContext';
import type { MapManagerLayers } from './mapManagerLayers';
import type { MapManagerHistory } from './mapManagerHistory';
import type { MapManagerPersistence } from './mapManagerPersistence';

export function createMapManagerLoadingServices(
    context: MapManagerContext,
    layers: MapManagerLayers,
    history: MapManagerHistory,
    persistence: MapManagerPersistence
) {
    const {
        fileManager,
        getDefaultImportedLayers,
        mapStore,
        settingsStore,
        uiStore,
        importedLayerStore,
        undoJournal,
        state
    } = context;
    const mapState = layers.mapStateCoordinator;
    const setLastSavedSnapshot = (snapshot: SerializedMap) => {
        state.lastSavedSnapshot = snapshot;
    };
    const activateExistingHistory = (title: string) =>
        history.activateHistory(title, { reset: false });
    const persistWithoutHistory = async () => {
        await persistence.persistMap({ throwOnFailure: true, recordHistory: false });
    };
    const applySettings = (settings: Settings) => {
        settingsStore.applyFromSettings({
            title: settings.title,
            readOnly: settings.readOnly,
            hideToolbar: settings.hideToolbar,
            activeLayers: settings.activeLayers,
            centre: settings.centre,
            zoom: settings.zoom,
            version: settings.version
        });
    };

    const storedMapLoader = new StoredMapLoader({
        loadMapFromStorage: (mapName) => fileManager.loadMapFromStorage(mapName),
        hasMapInStorage: (mapName) => fileManager.hasMapInStorage(mapName),
        clearAndReset: () => {
            mapState.clearAllLayers();
            mapState.resetSettings();
        },
        loadMapData: (data) => layers.loadMapData(data, null, null),
        buildSnapshot: history.buildCurrentSnapshot,
        setLastSavedSnapshot,
        activateHistory: activateExistingHistory,
        getCurrentTitle: () => settingsStore.title,
        persistMap: persistWithoutHistory,
        showErrors: (errors, options) => uiStore.showErrors(errors, options)
    });
    const newMapCreator = new NewMapCreator({
        appVersion: APP_VERSION,
        loadMapListFromStorage: () => fileManager.loadMapListFromStorage(),
        clearAndReset: () => mapState.clearAllLayers(),
        resetImportedLayers: () =>
            importedLayerStore.setLayers(cloneImportedLayers(getDefaultImportedLayers())),
        getAllLayerIds: () => mapState.getAllLayerIds(),
        getCurrentZoom: () => settingsStore.zoom,
        getCurrentCentre: () => settingsStore.centre ?? new L.LatLng(0, 0),
        getDefaultCentre: () => new L.LatLng(0, 0),
        applySettings,
        addLayers: (layerIds) => mapState.addLayers(layerIds),
        setVisibleLayerIds: (layerIds) => {
            mapStore.visibleLayerIds = layerIds;
        },
        buildSnapshot: history.buildCurrentSnapshot,
        setLastSavedSnapshot,
        activateHistory: (title) => history.activateHistory(title, { reset: true }),
        persistMap: persistWithoutHistory
    });
    const storageMapDownloader = new StorageMapDownloader({
        loadLastMapSelected: () => fileManager.loadLastMapSelected(),
        getCurrentTitle: () => settingsStore.title,
        loadRawMapFromStorage: (mapName) => fileManager.loadRawMapFromStorage(mapName),
        showErrors: (errors) => uiStore.showErrors(errors)
    });
    const settingsApplier = new SettingsApplier({
        getCurrentTitle: () => settingsStore.title,
        getCurrentSettings: () => settingsStore.toSettings(),
        buildSnapshot: history.buildCurrentSnapshot,
        getActiveHistoryTitle: () => history.lifecycle.getActiveHistoryTitle(),
        setLastSavedSnapshot,
        activateHistory: activateExistingHistory,
        setPendingHistoryMutation: (mutation) => {
            state.pendingHistoryMutation = mutation;
        },
        createMutationPayload: (before, after) => createSettingsMutationPayload(before, after),
        clearReadOnlyPresentation: clearReadOnlyGroupPresentation,
        applySettings,
        removeAllLayers: () => mapState.removeAllLayers(),
        addLayers: (layerIds) => mapState.addLayers(layerIds),
        setVisibleLayerIds: (layerIds) => {
            mapStore.visibleLayerIds = layerIds;
        },
        saveMapOrThrow: persistence.saveMapOrThrow,
        renameHistory: (fromTitle, toTitle) => undoJournal.renameHistory(fromTitle, toTitle)
    });
    const mapLoadCoordinator = new MapLoadCoordinator({
        sourceResolver: new MapLoadSourceResolver(fileManager, () => settingsStore.title),
        resetMap: () => {
            mapState.removeAllLayers();
            layers.resetSettings();
        },
        loadMapData: layers.loadMapData,
        buildSnapshot: history.buildCurrentSnapshot,
        setLastSavedSnapshot,
        activateHistory: activateExistingHistory,
        getActiveHistoryTitle: () => history.lifecycle.getActiveHistoryTitle(),
        getCurrentTitle: () => settingsStore.title,
        setHideToolbar: (hideToolbar) => {
            settingsStore.hideToolbar = hideToolbar;
        },
        hasMapInStorage: (mapName) => fileManager.hasMapInStorage(mapName),
        showErrors: (errors, options) => uiStore.showErrors(errors, options)
    });

    return {
        storedMapLoader,
        newMapCreator,
        storageMapDownloader,
        settingsApplier,
        mapLoadCoordinator
    };
}

export type MapManagerLoadingServices = ReturnType<typeof createMapManagerLoadingServices>;
