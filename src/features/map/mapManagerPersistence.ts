import { watch } from 'vue';
import { pinia } from '../../stores/index';
import { useGroupStore } from '../../stores/groupStore';
import { pruneDanglingGroupMembers } from '../../composables/useGroups';
import { DefaultImportedLayerSeeder } from './DefaultImportedLayerSeeder';
import { MapPersistenceCoordinator, type PersistOptions } from './MapPersistenceCoordinator';
import { MapViewCoordinator } from './MapViewCoordinator';
import type { MapManagerContext } from './mapManagerContext';
import type { MapManagerHistory } from './mapManagerHistory';

export function createMapManagerPersistence(
    context: MapManagerContext,
    history: MapManagerHistory
) {
    const {
        fileManager,
        mapStore,
        settingsStore,
        uiStore,
        importedLayerStore,
        undoJournal,
        state,
        getMap
    } = context;
    const coordinator = new MapPersistenceCoordinator({
        saveMap: async (snapshot) => {
            await fileManager.saveMap(
                settingsStore.toSettings(),
                mapStore.toLayers(),
                useGroupStore(pinia).groups,
                importedLayerStore.layers,
                snapshot
            );
        },
        buildSnapshot: history.buildCurrentSnapshot,
        getLastSavedSnapshot: () => state.lastSavedSnapshot,
        setLastSavedSnapshot: (snapshot) => {
            state.lastSavedSnapshot = snapshot;
        },
        getMutation: () => mapStore.lastLayerMutation ?? state.pendingHistoryMutation ?? undefined,
        clearMutation: () => {
            mapStore.clearLastLayerMutation();
            state.pendingHistoryMutation = null;
        },
        pruneDanglingGroupMembers,
        isHistorySuppressed: () => state.suppressHistory,
        getActiveHistoryTitle: () => history.lifecycle.getActiveHistoryTitle(),
        recordCheckpoint: async (title, before, after, mutation) => {
            await undoJournal.recordCheckpoint(title, before, after, 'checkpoint', mutation);
        },
        syncHistoryStatus: history.syncHistoryStatus,
        showErrors: (errors) => uiStore.showErrors(errors)
    });

    const persistImmediately = (options?: PersistOptions) => coordinator.persist(options);
    const persistMap = (options?: PersistOptions) => {
        const barrier = seeder.waitForPersistenceBarrier();
        return barrier
            ? barrier.then(() => coordinator.persist(options))
            : persistImmediately(options);
    };
    const saveMap = async () => {
        seeder.block();
        await persistMap();
    };
    const saveMapOrThrow = async () => {
        seeder.block();
        await persistMap({ throwOnFailure: true });
    };
    const view = new MapViewCoordinator({
        getMap,
        saveMap: async () => {
            if (!state.suppressAutomaticSaves) {
                await persistMap();
            }
        }
    });
    const seeder = new DefaultImportedLayerSeeder({
        getMapGeneration: () => state.mapGeneration,
        getImportedLayerCount: () => importedLayerStore.layers.length,
        setImportedLayers: (layers) => importedLayerStore.setLayers(layers),
        flushPendingViewSave: () => view.flushPendingSave(),
        persist: async () => {
            await persistImmediately({ recordHistory: false, preserveMutation: true });
        },
        syncHistoryStatus: history.syncHistoryStatus
    });

    watch([() => settingsStore.zoom, () => settingsStore.centre], () => {
        if (!state.suppressAutomaticSaves) {
            view.scheduleSave();
        }
    });

    const navigateHistory = async (direction: 'undo' | 'redo'): Promise<boolean> => {
        if (state.suppressAutomaticSaves) {
            return false;
        }
        seeder.block();
        const barrier = seeder.waitForPersistenceBarrier();
        if (barrier) {
            await barrier;
        }
        await coordinator.flush();
        return await history.navigation[direction]();
    };

    return {
        coordinator,
        seeder,
        view,
        persistMap,
        saveMap,
        saveMapOrThrow,
        saveHistoryReplay: async () => {
            await coordinator.persist({
                recordHistory: false,
                preserveMutation: true,
                pruneDanglingGroupMembers: false
            });
        },
        undo: () => navigateHistory('undo'),
        redo: () => navigateHistory('redo')
    };
}

export type MapManagerPersistence = ReturnType<typeof createMapManagerPersistence>;
