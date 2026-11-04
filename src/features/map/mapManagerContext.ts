import type * as L from 'leaflet';
import type { FileManager } from '../../services/FileManager';
import type { SerializedMap } from '../../services/MapSerializer';
import { UndoJournal } from '../../services/UndoJournal';
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';
import { pinia } from '../../stores/index';
import { useHistoryStore } from '../../stores/historyStore';
import { useMapStore } from '../../stores/mapStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { useImportedLayerStore } from '../../stores/importedLayerStore';
import type { PersistenceMutation } from './MapPersistenceCoordinator';

export const APP_VERSION = '0.10.0';

interface MapManagerState {
    lastSavedSnapshot: SerializedMap | null;
    suppressHistory: boolean;
    pendingHistoryMutation: PersistenceMutation | null;
    mapGeneration: number;
    suppressAutomaticSaves: boolean;
}

export function createMapManagerContext(
    fileManager: FileManager,
    getDefaultImportedLayers: () => ImportedGeoJsonLayer[]
) {
    const historyStore = useHistoryStore(pinia);
    const mapStore = useMapStore(pinia);
    const settingsStore = useSettingsStore(pinia);
    const uiStore = useUiStore(pinia);
    const importedLayerStore = useImportedLayerStore(pinia);
    const state: MapManagerState = {
        lastSavedSnapshot: null,
        suppressHistory: false,
        pendingHistoryMutation: null,
        mapGeneration: 0,
        suppressAutomaticSaves: false
    };

    return {
        fileManager,
        getDefaultImportedLayers,
        mapStore,
        settingsStore,
        uiStore,
        historyStore,
        importedLayerStore,
        undoJournal: new UndoJournal(),
        state,
        getMap: (): L.Map => {
            const map = mapStore.map;
            if (!map) {
                throw new Error('Leaflet map not initialised');
            }
            return map;
        }
    };
}

export type MapManagerContext = ReturnType<typeof createMapManagerContext>;
