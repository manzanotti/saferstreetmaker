import type { FileManager } from '../services/FileManager';
import type { Settings } from '../models/Settings';
import type { ImportedGeoJsonLayer } from '../models/ImportedGeoJsonLayer';
import { createMapManagerContext } from '../features/map/mapManagerContext';
import { createMapManagerLayers } from '../features/map/mapManagerLayers';
import { createMapManagerHistory } from '../features/map/mapManagerHistory';
import { createMapManagerPersistence } from '../features/map/mapManagerPersistence';
import { createMapManagerLoading } from '../features/map/mapManagerLoading';
import { connectMapManagerEvents } from '../features/map/mapManagerEvents';

export interface MapManager {
    loadMap: (
        remoteMapFile: string | null,
        hash: string,
        hideToolbar: boolean,
        zoom: string | null,
        centre: number[] | null,
        sharedView?: boolean
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

let instance: MapManager | null = null;
let currentFileManager: FileManager | null = null;

export function getMapManager(): MapManager {
    if (!instance) {
        throw new Error('MapManager not initialised');
    }
    return instance;
}

export function getFileManager(): FileManager {
    if (!currentFileManager) {
        throw new Error('FileManager not initialised');
    }
    return currentFileManager;
}

export function setupMapManager(
    fileManager: FileManager,
    getDefaultImportedLayers: () => ImportedGeoJsonLayer[] = () => []
): MapManager {
    currentFileManager = fileManager;
    const context = createMapManagerContext(fileManager, getDefaultImportedLayers);
    const layers = createMapManagerLayers(context, () => persistence.view.setDefaultView());
    const history = createMapManagerHistory(context, layers, () => persistence.saveHistoryReplay());
    const persistence = createMapManagerPersistence(context, history);
    const loading = createMapManagerLoading(context, layers, history, persistence);
    connectMapManagerEvents(context, layers, persistence);

    instance = {
        ...loading,
        saveMap: persistence.saveMap,
        undo: persistence.undo,
        redo: persistence.redo,
        setUserLocation: (position) => persistence.view.setUserLocation(position),
        setDefaultView: () => persistence.view.setDefaultView(),
        getMapGeneration: () => context.state.mapGeneration,
        runViewCheckpointMigration: history.runViewCheckpointMigration
    };
    return instance;
}
