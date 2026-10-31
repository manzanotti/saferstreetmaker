import { watch } from 'vue';
import { recomputeFeatureVisibility } from '../../composables/useGroups';
import { UploadedMapLoader } from './UploadedMapLoader';
import type { MapManagerContext } from './mapManagerContext';
import type { MapManagerLayers } from './mapManagerLayers';
import type { MapManagerPersistence } from './mapManagerPersistence';

export function connectMapManagerEvents(
    context: MapManagerContext,
    layers: MapManagerLayers,
    persistence: MapManagerPersistence
): void {
    const { fileManager, mapStore, uiStore, state } = context;
    const uploadedMapLoader = new UploadedMapLoader({
        closePanel: () => uiStore.closePanel(),
        clearAndReset: () => {
            state.mapGeneration += 1;
            persistence.seeder.setPending(false);
            persistence.seeder.setBlocked(true);
            layers.mapStateCoordinator.clearAllLayers();
            layers.resetSettings();
        },
        loadMapData: (data) => layers.loadMapData(data, null, null),
        saveMap: persistence.saveMap,
        showErrors: (errors) => uiStore.showErrors(errors)
    });
    fileManager.setOnFileLoaded((data: unknown) => {
        void persistence.coordinator.flush().then(() => uploadedMapLoader.load(data));
    });

    watch(
        () => mapStore.layerUpdateCount,
        () => {
            recomputeFeatureVisibility();
            if (!state.suppressAutomaticSaves) {
                void persistence.saveMap();
            }
        }
    );
}
