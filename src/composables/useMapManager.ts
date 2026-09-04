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
import { nextTick, toRaw, watch } from 'vue';
import { FileManager } from '../services/FileManager';
import { UndoJournal } from '../services/UndoJournal';
import type { SerializedMap } from '../services/MapSerializer';
import { Settings } from '../models/Settings';
import type { ImportedGeoJsonLayer } from '../models/ImportedGeoJsonLayer';
import { useHistoryStore } from '../stores/historyStore';
import { useMapStore } from '../stores/mapStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useGroupStore } from '../stores/groupStore';
import { useImportedLayerStore } from '../stores/importedLayerStore';
import { cloneImportedLayers } from '../features/map/importedGeoJson';
import {
    pruneDanglingGroupMembers,
    recomputeFeatureVisibility,
    resetGroupVisibility,
    showReplayedGroupPhases
} from './useGroups';
import { pinia } from '../stores/index';
import { HistoryLifecycleCoordinator } from '../features/history/HistoryLifecycleCoordinator';
import { MutationAreaRevealer } from '../features/history/MutationAreaRevealer';
import { HistoryNavigationCoordinator } from '../features/history/HistoryNavigationCoordinator';
import { createSettingsMutationPayload } from '../features/history/settingsMutationReplay';
import { HistoryReplayCoordinator } from '../features/history/HistoryReplayCoordinator';
import { getPhaseReplayContext } from '../features/history/phaseReplay';
import { MapLayerController } from '../features/map/MapLayerController';
import { MapSnapshotBuilder } from '../features/map/MapSnapshotBuilder';
import { MapStateCoordinator } from '../features/map/MapStateCoordinator';
import { MapDataLoader } from '../features/map/MapDataLoader';
import { MapLoadSourceResolver } from '../features/map/MapLoadSourceResolver';
import { StoredMapLoader } from '../features/map/StoredMapLoader';
import { NewMapCreator } from '../features/map/NewMapCreator';
import { StorageMapDownloader } from '../features/map/StorageMapDownloader';
import { SettingsApplier } from '../features/map/SettingsApplier';
import { MapLoadCoordinator } from '../features/map/MapLoadCoordinator';
import { MapPersistenceCoordinator } from '../features/map/MapPersistenceCoordinator';
import { UploadedMapLoader } from '../features/map/UploadedMapLoader';
import { MapViewCoordinator } from '../features/map/MapViewCoordinator';
import { ImportedGeoJsonLayerController } from '../features/map/ImportedGeoJsonLayerController';

const APP_VERSION = '0.10.0';

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
    loadMapFromStorage: (mapName: string) => Promise<boolean>;
    undo: () => Promise<boolean>;
    redo: () => Promise<boolean>;
    setUserLocation: (position: GeolocationPosition) => void;
    setDefaultView: () => void;
    getMapGeneration: () => number;
    initialiseDefaultImportedLayers: (
        layers: ImportedGeoJsonLayer[],
        options?: { expectedGeneration?: number; allowInitialSeed?: boolean }
    ) => Promise<void>;
    downloadStorageMap: () => Promise<void>;
    runViewCheckpointMigration: () => Promise<void>;
}

interface HistoryMutation {
    kind: string;
    layerId: string;
    payload?: unknown;
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

export function setupMapManager(
    fileManager: FileManager,
    getDefaultImportedLayers: () => ImportedGeoJsonLayer[] = () => []
): MapManager {
    _fileManager = fileManager;
    const historyStore = useHistoryStore(pinia);
    const mapStore = useMapStore(pinia);
    const settingsStore = useSettingsStore(pinia);
    const uiStore = useUiStore(pinia);
    const importedLayerStore = useImportedLayerStore(pinia);
    const undoJournal = new UndoJournal();
    let lastSavedSnapshot: SerializedMap | null = null;
    let suppressHistory = false;
    let pendingHistoryMutation: HistoryMutation | null = null;
    let mapGeneration = 0;
    let newMapPendingDefaultLayers = false;

    const getMap = (): L.Map => {
        const m = mapStore.map;
        if (!m) {
            throw new Error('Leaflet map not initialised');
        }
        return m;
    };

    const mutationAreaRevealer = new MutationAreaRevealer({ getMap });
    const mapLayerController = new MapLayerController({
        getMap,
        getLayers: () => mapStore.layers
    });
    const importedLayerController = new ImportedGeoJsonLayerController({
        getMap,
        isReadOnly: () => settingsStore.readOnly,
        getActiveLayerId: () => mapStore.activeLayerId,
        onFeaturePropertyChange: (layerId, featureIndex, key, value) => {
            importedLayerStore.updateFeatureProperty(layerId, featureIndex, key, value);
            mapStore.markLayerUpdated();
        }
    });
    const mapStateCoordinator = new MapStateCoordinator({
        mapLayerController,
        importedLayerController,
        clearImportedLayers: () => importedLayerStore.clear(),
        setActiveLayerIds: (layerIds) => {
            settingsStore.activeLayers = layerIds;
        },
        setVisibleLayerIds: (layerIds) => {
            mapStore.visibleLayerIds = layerIds;
        },
        clearGroups: () => {
            const groupStore = useGroupStore(pinia);
            groupStore.setGroups([]);
        },
        setAllGroupsHidden: (hidden) => {
            useGroupStore(pinia).setAllHidden(hidden);
        },
        resetGroupVisibility
    });
    const mapDataLoader = new MapDataLoader({
        getMap,
        setDefaultView: () => setDefaultView(),
        mapLayerController,
        setTitle: (title) => {
            settingsStore.title = title;
        },
        applySettings: (loadedSettings) => {
            settingsStore.applyFromSettings(loadedSettings);
        },
        setCentre: (loadedCentre) => {
            settingsStore.centre = loadedCentre;
        },
        setZoom: (loadedZoom) => {
            settingsStore.zoom = loadedZoom;
        },
        getCentre: () => settingsStore.centre,
        getZoom: () => settingsStore.zoom,
        setVersion: (version) => {
            settingsStore.version = version;
        },
        getActiveLayerIds: () => settingsStore.activeLayers,
        setVisibleLayerIds: (layerIds) => {
            mapStore.visibleLayerIds = layerIds;
        },
        setGroups: (groups) => {
            useGroupStore(pinia).setGroups(groups);
        },
        setAllGroupsHidden: (hidden) => {
            useGroupStore(pinia).setAllHidden(hidden);
        },
        resetGroupVisibility,
        recomputeGroupVisibility: recomputeFeatureVisibility,
        pruneDanglingGroupMembers,
        appVersion: APP_VERSION,
        setImportedLayers: (layers) => importedLayerStore.setLayers(layers)
    });
    watch(
        () =>
            importedLayerStore.layers.map((layer) => [
                layer.id,
                layer.name,
                layer.nameProperty,
                layer.visible,
                layer.featureCollection
            ]),
        () => importedLayerController.render(importedLayerStore.layers)
    );
    const mapLoadSourceResolver = new MapLoadSourceResolver(fileManager, () => settingsStore.title);
    const storedMapLoader = new StoredMapLoader({
        loadMapFromStorage: (mapName) => fileManager.loadMapFromStorage(mapName),
        hasMapInStorage: (mapName) => fileManager.hasMapInStorage(mapName),
        clearAndReset: () => {
            mapStateCoordinator.clearAllLayers();
            mapStateCoordinator.resetSettings();
        },
        loadMapData: (mapData) => loadMapData(mapData, null, null),
        buildSnapshot: () => buildCurrentSnapshot(),
        setLastSavedSnapshot: (snapshot) => {
            lastSavedSnapshot = snapshot;
        },
        activateHistory: (mapTitle) => activateHistory(mapTitle, { reset: false }),
        getCurrentTitle: () => settingsStore.title,
        persistMap: async () => {
            await persistMap({ throwOnFailure: true, recordHistory: false });
        },
        showErrors: (errors, options) => uiStore.showErrors(errors, options)
    });
    const newMapCreator = new NewMapCreator({
        appVersion: APP_VERSION,
        loadMapListFromStorage: () => fileManager.loadMapListFromStorage(),
        clearAndReset: () => mapStateCoordinator.clearAllLayers(),
        resetImportedLayers: () =>
            importedLayerStore.setLayers(cloneImportedLayers(getDefaultImportedLayers())),
        getAllLayerIds: () => mapStateCoordinator.getAllLayerIds(),
        getCurrentZoom: () => settingsStore.zoom,
        getCurrentCentre: () => settingsStore.centre ?? new L.LatLng(0, 0),
        getDefaultCentre: () => new L.LatLng(0, 0),
        applySettings: (newSettings) => {
            settingsStore.applyFromSettings({
                title: newSettings.title,
                readOnly: newSettings.readOnly,
                hideToolbar: newSettings.hideToolbar,
                activeLayers: newSettings.activeLayers,
                centre: newSettings.centre,
                zoom: newSettings.zoom,
                version: newSettings.version
            });
        },
        addLayers: (layerIds) => mapStateCoordinator.addLayers(layerIds),
        setVisibleLayerIds: (layerIds) => {
            mapStore.visibleLayerIds = layerIds;
        },
        buildSnapshot: () => buildCurrentSnapshot(),
        setLastSavedSnapshot: (snapshot) => {
            lastSavedSnapshot = snapshot;
        },
        activateHistory: (title) => activateHistory(title, { reset: true }),
        persistMap: async () => {
            await persistMap({ throwOnFailure: true, recordHistory: false });
        }
    });
    const storageMapDownloader = new StorageMapDownloader({
        loadLastMapSelected: () => fileManager.loadLastMapSelected(),
        getCurrentTitle: () => settingsStore.title,
        loadRawMapFromStorage: (mapName) => fileManager.loadRawMapFromStorage(mapName),
        showErrors: (errors) => uiStore.showErrors(errors)
    });

    const mapSnapshotBuilder = new MapSnapshotBuilder({
        fileManager,
        getSettings: () => settingsStore.toSettings(),
        getLayers: () => mapStore.toLayers(),
        getGroups: () => useGroupStore(pinia).groups,
        getImportedLayers: () => importedLayerStore.layers
    });
    const buildCurrentSnapshot = (): SerializedMap => mapSnapshotBuilder.build();

    const historyLifecycleCoordinator = new HistoryLifecycleCoordinator({
        historyStore,
        undoJournal,
        buildSnapshot: () => buildCurrentSnapshot(),
        setLastSavedSnapshot: (snapshot) => {
            lastSavedSnapshot = snapshot;
        },
        loadMapListFromStorage: () => fileManager.loadMapListFromStorage()
    });

    const syncHistoryStatus = () => historyLifecycleCoordinator.syncStatus();
    const activateHistory = (mapTitle: string, options?: { reset?: boolean }) =>
        historyLifecycleCoordinator.activate(mapTitle, options);

    const settingsApplier = new SettingsApplier({
        getCurrentTitle: () => settingsStore.title,
        getCurrentSettings: () => settingsStore.toSettings(),
        buildSnapshot: () => buildCurrentSnapshot(),
        getActiveHistoryTitle: () => historyLifecycleCoordinator.getActiveHistoryTitle(),
        setLastSavedSnapshot: (snapshot) => {
            lastSavedSnapshot = snapshot;
        },
        activateHistory: (title) => activateHistory(title, { reset: false }),
        setPendingHistoryMutation: (mutation) => {
            pendingHistoryMutation = mutation;
        },
        createMutationPayload: (before, after) => createSettingsMutationPayload(before, after),
        applySettings: (settings) => {
            settingsStore.applyFromSettings({
                title: settings.title,
                readOnly: settings.readOnly,
                hideToolbar: settings.hideToolbar,
                activeLayers: settings.activeLayers,
                centre: settings.centre,
                zoom: settings.zoom,
                version: settings.version
            });
        },
        removeAllLayers: () => removeAllLayersFromMap(),
        addLayers: (layerIds) => addLayersToMap(layerIds),
        setVisibleLayerIds: (layerIds) => {
            mapStore.visibleLayerIds = layerIds;
        },
        saveMapOrThrow: () => saveMapOrThrow(),
        renameHistory: (fromTitle, toTitle) => undoJournal.renameHistory(fromTitle, toTitle)
    });

    const runViewCheckpointMigration = () =>
        historyLifecycleCoordinator.migrateViewOnlyCheckpoints();

    // Stamp a fresh map with the current schema so load-time migrations do not re-apply to it.
    if (settingsStore.version === '') {
        settingsStore.version = APP_VERSION;
    }
    lastSavedSnapshot = buildCurrentSnapshot();
    historyStore.clearStatus();
    void activateHistory(settingsStore.title);

    const historyReplayTransactionEffects = {
        setHistorySuppressed: (suppressed: boolean) => {
            suppressHistory = suppressed;
        },
        setBusy: (busy: boolean) => {
            historyStore.setBusy(busy);
        }
    };
    let saveHistoryReplay: () => Promise<void> = async () => undefined;
    const historyReplayCoordinator = new HistoryReplayCoordinator({
        transactionEffects: historyReplayTransactionEffects,
        getLayers: () => mapStore.layers,
        clearAllLayers: () => clearAllLayers(),
        resetSettings: () => resetSettings(),
        loadMapData: (snapshot) => loadMapData(snapshot, null, null),
        saveMap: () => saveHistoryReplay(),
        buildSnapshot: () => buildCurrentSnapshot(),
        setLastSavedSnapshot: (snapshot) => {
            lastSavedSnapshot = snapshot;
        },
        getCurrentView: () => ({ centre: getMap().getCenter(), zoom: getMap().getZoom() }),
        applySettings: (settings) => {
            settingsStore.applyFromSettings(settings);
        },
        removeAllLayers: () => removeAllLayersFromMap(),
        addLayers: (layerIds) => addLayersToMap(layerIds),
        setVisibleLayerIds: (layerIds) => {
            mapStore.visibleLayerIds = layerIds;
        },
        recomputeGroupPresentation: recomputeFeatureVisibility,
        appVersion: APP_VERSION
    });
    const historyNavigationCoordinator = new HistoryNavigationCoordinator({
        undoJournal,
        getActiveHistoryTitle: () => historyLifecycleCoordinator.getActiveHistoryTitle(),
        applyReplay: async (replay) => {
            const groupStore = useGroupStore(pinia);
            const preferredPhase =
                groupStore.phaseGroupId && groupStore.phaseVersionId
                    ? {
                          groupId: groupStore.phaseGroupId,
                          versionId: groupStore.phaseVersionId,
                          phaseId: groupStore.phaseEditingId ?? groupStore.focusedPhaseId
                      }
                    : null;
            const phaseReplayContext = getPhaseReplayContext(replay, preferredPhase);
            const applied = await historyReplayCoordinator.apply(replay);
            if (applied && phaseReplayContext) {
                showReplayedGroupPhases(
                    phaseReplayContext.groupId,
                    phaseReplayContext.versionId,
                    phaseReplayContext.phaseId
                );
            }
            return applied;
        },
        revealMutationArea: (payload) => mutationAreaRevealer.reveal(payload),
        syncHistoryStatus
    });

    // ── saveMap ───────────────────────────────────────────────────────────────
    const persistenceCoordinator = new MapPersistenceCoordinator({
        saveMap: async () => {
            const groupStore = useGroupStore(pinia);
            await fileManager.saveMap(
                settingsStore.toSettings(),
                mapStore.toLayers(),
                groupStore.groups,
                importedLayerStore.layers
            );
        },
        buildSnapshot: () => buildCurrentSnapshot(),
        getLastSavedSnapshot: () => lastSavedSnapshot,
        setLastSavedSnapshot: (snapshot) => {
            lastSavedSnapshot = snapshot;
        },
        getMutation: () => mapStore.lastLayerMutation ?? pendingHistoryMutation ?? undefined,
        clearMutation: () => {
            mapStore.clearLastLayerMutation();
            pendingHistoryMutation = null;
        },
        pruneDanglingGroupMembers,
        isHistorySuppressed: () => suppressHistory,
        getActiveHistoryTitle: () => historyLifecycleCoordinator.getActiveHistoryTitle(),
        recordCheckpoint: async (mapTitle, before, after, mutation) => {
            await undoJournal.recordCheckpoint(mapTitle, before, after, 'checkpoint', mutation);
        },
        syncHistoryStatus,
        showErrors: (errors) => uiStore.showErrors(errors)
    });
    saveHistoryReplay = async () => {
        await persistenceCoordinator.persist({
            recordHistory: false,
            preserveMutation: true,
            pruneDanglingGroupMembers: false
        });
    };

    let persistenceBarrier: Promise<void> | null = null;
    let defaultSeedingBlocked = false;
    let userActionRevision = 0;

    const blockDefaultSeeding = (): void => {
        defaultSeedingBlocked = true;
        userActionRevision += 1;
    };

    const persistImmediately = (options?: {
        throwOnFailure?: boolean;
        recordHistory?: boolean;
        preserveMutation?: boolean;
    }) => persistenceCoordinator.persist(options);

    const persistMap = (options?: {
        throwOnFailure?: boolean;
        recordHistory?: boolean;
        preserveMutation?: boolean;
    }) => {
        if (persistenceBarrier) {
            return persistenceBarrier.then(() => persistenceCoordinator.persist(options));
        }
        return persistImmediately(options);
    };

    const saveMap = async (): Promise<void> => {
        blockDefaultSeeding();
        await persistMap();
    };

    const saveMapOrThrow = async (): Promise<void> => {
        blockDefaultSeeding();
        await persistMap({ throwOnFailure: true });
    };

    const saveViewMap = async (): Promise<void> => {
        await persistMap();
    };

    const mapViewCoordinator = new MapViewCoordinator({
        getMap,
        saveMap: saveViewMap
    });

    // Watch settingsStore.zoom/centre changes (set by useMapEngine on zoom/move events)
    // to trigger a debounced save. Replaces the PubSub mapZoomChanged subscription.
    watch([() => settingsStore.zoom, () => settingsStore.centre], () => {
        mapViewCoordinator.scheduleSave();
    });

    // ── Layer helpers ─────────────────────────────────────────────────────────
    const addLayersToMap = (activeLayers: string[]) => mapStateCoordinator.addLayers(activeLayers);

    const removeAllLayersFromMap = () => mapStateCoordinator.removeAllLayers();

    const clearAllLayers = () => mapStateCoordinator.clearAllLayers();

    const buildAllActiveLayerIds = (): string[] => mapStateCoordinator.getAllLayerIds();

    // ── loadMapData ───────────────────────────────────────────────────────────
    const loadMapData = (
        geoJSON: SerializedMap | null,
        zoom: string | null,
        centre: number[] | null
    ): boolean => {
        return mapDataLoader.load(geoJSON, zoom, centre);
    };

    const mapLoadCoordinator = new MapLoadCoordinator({
        sourceResolver: mapLoadSourceResolver,
        resetMap: () => {
            removeAllLayersFromMap();
            resetSettings();
        },
        loadMapData: (geoJSON, zoom, centre) => loadMapData(geoJSON, zoom, centre),
        buildSnapshot: () => buildCurrentSnapshot(),
        setLastSavedSnapshot: (snapshot) => {
            lastSavedSnapshot = snapshot;
        },
        activateHistory: (title) => activateHistory(title, { reset: false }),
        getActiveHistoryTitle: () => historyLifecycleCoordinator.getActiveHistoryTitle(),
        getCurrentTitle: () => settingsStore.title,
        setHideToolbar: (hideToolbar) => {
            settingsStore.hideToolbar = hideToolbar;
        },
        hasMapInStorage: (mapName) => fileManager.hasMapInStorage(mapName),
        showErrors: (errors, options) => uiStore.showErrors(errors, options)
    });

    const loadMap = async (
        remoteMapFile: string | null,
        hash: string,
        hideToolbar: boolean,
        zoom: string | null,
        centre: number[] | null
    ): Promise<boolean> => {
        await persistenceCoordinator.flush();
        return await mapLoadCoordinator.load(remoteMapFile, hash, hideToolbar, zoom, centre);
    };

    // ── resetSettings ─────────────────────────────────────────────────────────
    const resetSettings = () => {
        settingsStore.readOnly = false;
        mapStateCoordinator.resetSettings();
    };

    // ── applySettings ─────────────────────────────────────────────────────────
    const applySettings = async (newSettings: Settings) => {
        await settingsApplier.apply(newSettings);
    };

    // ── createNewMap ──────────────────────────────────────────────────────────
    /**
     * Returns false if the title is already taken (caller shows an error).
     * Returns true on success.
     */
    const createNewMap = async (title: string): Promise<boolean> => {
        await persistenceCoordinator.flush();
        const previousGeneration = mapGeneration;
        const creationGeneration = ++mapGeneration;
        const creationActionRevision = userActionRevision;
        let created: boolean;
        try {
            created = await newMapCreator.create(title);
        } catch (error) {
            if (mapGeneration === creationGeneration) {
                mapGeneration = previousGeneration;
            }
            throw error;
        }
        if (created && mapGeneration === creationGeneration) {
            defaultSeedingBlocked = userActionRevision !== creationActionRevision;
            const availableDefaultLayers = getDefaultImportedLayers();
            newMapPendingDefaultLayers = importedLayerStore.layers.length === 0;
            if (
                newMapPendingDefaultLayers &&
                !defaultSeedingBlocked &&
                availableDefaultLayers.length > 0
            ) {
                await initialiseDefaultImportedLayers(availableDefaultLayers);
            }
        } else {
            if (!created && mapGeneration === creationGeneration) {
                mapGeneration = previousGeneration;
                const availableDefaultLayers = getDefaultImportedLayers();
                if (availableDefaultLayers.length > 0) {
                    await initialiseDefaultImportedLayers(availableDefaultLayers, {
                        expectedGeneration: previousGeneration,
                        allowInitialSeed: true
                    });
                }
            }
        }
        return created;
    };

    // ── loadMapFromStorage ────────────────────────────────────────────────────
    const loadMapFromStorage = async (mapName: string): Promise<boolean> => {
        await persistenceCoordinator.flush();
        mapGeneration += 1;
        newMapPendingDefaultLayers = false;
        defaultSeedingBlocked = true;
        return await storedMapLoader.load(mapName);
    };

    // ── Geolocation helpers ───────────────────────────────────────────────────
    const setUserLocation = (position: GeolocationPosition) => {
        mapViewCoordinator.setUserLocation(position);
    };

    const setDefaultView = () => {
        mapViewCoordinator.setDefaultView();
    };

    // ── downloadStorageMap ────────────────────────────────────────────────────
    const downloadStorageMap = async () => {
        await storageMapDownloader.download();
    };

    const undo = async (): Promise<boolean> => {
        blockDefaultSeeding();
        if (persistenceBarrier) {
            await persistenceBarrier;
        }
        await persistenceCoordinator.flush();
        return await historyNavigationCoordinator.undo();
    };

    const redo = async (): Promise<boolean> => {
        blockDefaultSeeding();
        if (persistenceBarrier) {
            await persistenceBarrier;
        }
        await persistenceCoordinator.flush();
        return await historyNavigationCoordinator.redo();
    };

    const initialiseDefaultImportedLayers = async (
        layers: ImportedGeoJsonLayer[],
        options?: { expectedGeneration?: number; allowInitialSeed?: boolean }
    ): Promise<void> => {
        const seedGeneration = mapGeneration;
        const canSeed = (): boolean => {
            if (
                defaultSeedingBlocked ||
                mapGeneration !== seedGeneration ||
                importedLayerStore.layers.length > 0
            ) {
                return false;
            }
            if (newMapPendingDefaultLayers) {
                return true;
            }
            return (
                options?.allowInitialSeed === true &&
                (options.expectedGeneration === undefined ||
                    options.expectedGeneration === mapGeneration)
            );
        };

        if (!canSeed()) {
            return;
        }

        await nextTick();
        await mapViewCoordinator.flushPendingSave();
        if (!canSeed()) {
            return;
        }

        let releasePersistenceBarrier: () => void = () => undefined;
        const seedBarrier = new Promise<void>((resolve) => {
            releasePersistenceBarrier = resolve;
        });
        persistenceBarrier = seedBarrier;

        try {
            importedLayerStore.setLayers(layers);
            newMapPendingDefaultLayers = false;
            await persistImmediately({ recordHistory: false, preserveMutation: true });
            await syncHistoryStatus();
        } finally {
            if (persistenceBarrier === seedBarrier) {
                persistenceBarrier = null;
            }
            releasePersistenceBarrier();
        }
    };

    // ── Wire event bridges (replaces PubSub subscriptions) ───────────────────

    // fileLoaded: FileManager calls this callback when a file is loaded via OS picker.
    const uploadedMapLoader = new UploadedMapLoader({
        closePanel: () => uiStore.closePanel(),
        clearAndReset: () => {
            mapGeneration += 1;
            newMapPendingDefaultLayers = false;
            defaultSeedingBlocked = true;
            clearAllLayers();
            resetSettings();
        },
        loadMapData: (data) => loadMapData(data, null, null),
        saveMap,
        showErrors: (errors) => uiStore.showErrors(errors)
    });
    fileManager.setOnFileLoaded((data: unknown) => {
        void persistenceCoordinator.flush().then(() => uploadedMapLoader.load(data));
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
        undo,
        redo,
        setUserLocation,
        setDefaultView,
        getMapGeneration: () => mapGeneration,
        initialiseDefaultImportedLayers,
        downloadStorageMap,
        runViewCheckpointMigration
    };

    return _instance;
}
