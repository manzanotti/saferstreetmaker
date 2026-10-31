import type { Settings } from '../../models/Settings';
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';
import type { MapManagerContext } from './mapManagerContext';
import type { MapManagerLayers } from './mapManagerLayers';
import type { MapManagerHistory } from './mapManagerHistory';
import type { MapManagerPersistence } from './mapManagerPersistence';
import { createMapManagerLoadingServices } from './mapManagerLoadingServices';

export function createMapManagerLoading(
    context: MapManagerContext,
    layers: MapManagerLayers,
    history: MapManagerHistory,
    persistence: MapManagerPersistence
) {
    const { state, importedLayerStore, getDefaultImportedLayers } = context;
    const { coordinator, seeder } = persistence;
    const services = createMapManagerLoadingServices(context, layers, history, persistence);

    const initialiseDefaultImportedLayers = async (
        layers: ImportedGeoJsonLayer[],
        options?: { expectedGeneration?: number; allowInitialSeed?: boolean }
    ): Promise<void> => seeder.initialise(layers, options);

    const loadMap = async (
        remoteMapFile: string | null,
        hash: string,
        hideToolbar: boolean,
        zoom: string | null,
        centre: number[] | null,
        sharedView = false
    ): Promise<boolean> => {
        await coordinator.flush();
        state.suppressAutomaticSaves = remoteMapFile === null && hash !== '' && sharedView;
        return await services.mapLoadCoordinator.load(
            remoteMapFile,
            hash,
            hideToolbar,
            zoom,
            centre
        );
    };

    const createNewMap = async (title: string): Promise<boolean> => {
        await coordinator.flush();
        const previousGeneration = state.mapGeneration;
        const creationGeneration = ++state.mapGeneration;
        const creationActionRevision = seeder.getUserActionRevision();
        let created: boolean;
        try {
            created = await services.newMapCreator.create(title);
        } catch (error) {
            if (state.mapGeneration === creationGeneration) {
                state.mapGeneration = previousGeneration;
            }
            throw error;
        }
        if (created && state.mapGeneration === creationGeneration) {
            state.suppressAutomaticSaves = false;
            seeder.setBlocked(seeder.getUserActionRevision() !== creationActionRevision);
            const availableDefaultLayers = getDefaultImportedLayers();
            seeder.setPending(importedLayerStore.layers.length === 0);
            if (
                importedLayerStore.layers.length === 0 &&
                seeder.getUserActionRevision() === creationActionRevision &&
                availableDefaultLayers.length > 0
            ) {
                await initialiseDefaultImportedLayers(availableDefaultLayers);
            }
        } else if (!created && state.mapGeneration === creationGeneration) {
            state.mapGeneration = previousGeneration;
            const availableDefaultLayers = getDefaultImportedLayers();
            if (availableDefaultLayers.length > 0) {
                await initialiseDefaultImportedLayers(availableDefaultLayers, {
                    expectedGeneration: previousGeneration,
                    allowInitialSeed: true
                });
            }
        }
        return created;
    };

    const loadMapFromStorage = async (mapName: string): Promise<boolean> => {
        await coordinator.flush();
        state.mapGeneration += 1;
        seeder.setPending(false);
        seeder.setBlocked(true);
        const loaded = await services.storedMapLoader.load(mapName);
        if (loaded) {
            state.suppressAutomaticSaves = false;
        }
        return loaded;
    };

    return {
        loadMap,
        createNewMap,
        loadMapFromStorage,
        initialiseDefaultImportedLayers,
        applySettings: async (settings: Settings) => services.settingsApplier.apply(settings),
        downloadStorageMap: async () => services.storageMapDownloader.download()
    };
}
