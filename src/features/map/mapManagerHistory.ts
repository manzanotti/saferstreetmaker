import { pinia } from '../../stores/index';
import { useGroupStore } from '../../stores/groupStore';
import { recomputeFeatureVisibility, showReplayedGroupPhases } from '../../composables/useGroups';
import { HistoryLifecycleCoordinator } from '../history/HistoryLifecycleCoordinator';
import { MutationAreaRevealer } from '../history/MutationAreaRevealer';
import { HistoryNavigationCoordinator } from '../history/HistoryNavigationCoordinator';
import { HistoryReplayCoordinator } from '../history/HistoryReplayCoordinator';
import { getPhaseReplayContext } from '../history/phaseReplay';
import { MapSnapshotBuilder } from './MapSnapshotBuilder';
import { APP_VERSION, type MapManagerContext } from './mapManagerContext';
import type { MapManagerLayers } from './mapManagerLayers';

export function createMapManagerHistory(
    context: MapManagerContext,
    layers: MapManagerLayers,
    saveHistoryReplay: () => Promise<void>
) {
    const {
        fileManager,
        historyStore,
        mapStore,
        settingsStore,
        importedLayerStore,
        undoJournal,
        state,
        getMap
    } = context;
    const mapSnapshotBuilder = new MapSnapshotBuilder({
        fileManager,
        getSettings: () => settingsStore.toSettings(),
        getLayers: () => mapStore.toLayers(),
        getGroups: () => useGroupStore(pinia).groups,
        getImportedLayers: () => importedLayerStore.layers
    });
    const buildCurrentSnapshot = () => mapSnapshotBuilder.build();
    const lifecycle = new HistoryLifecycleCoordinator({
        historyStore,
        undoJournal,
        buildSnapshot: buildCurrentSnapshot,
        setLastSavedSnapshot: (snapshot) => {
            state.lastSavedSnapshot = snapshot;
        },
        loadMapListFromStorage: () => fileManager.loadMapListFromStorage()
    });
    const syncHistoryStatus = () => lifecycle.syncStatus();
    const activateHistory = (title: string, options?: { reset?: boolean }) =>
        lifecycle.activate(title, options);

    if (settingsStore.version === '') {
        settingsStore.version = APP_VERSION;
    }
    state.lastSavedSnapshot = buildCurrentSnapshot();
    historyStore.clearStatus();
    void activateHistory(settingsStore.title);

    const replay = new HistoryReplayCoordinator({
        transactionEffects: {
            setHistorySuppressed: (suppressed) => {
                state.suppressHistory = suppressed;
            },
            setBusy: (busy) => historyStore.setBusy(busy)
        },
        getLayers: () => mapStore.layers,
        clearAllLayers: () => layers.mapStateCoordinator.clearAllLayers(),
        resetSettings: layers.resetSettings,
        loadMapData: (snapshot) => layers.loadMapData(snapshot, null, null),
        saveMap: saveHistoryReplay,
        buildSnapshot: buildCurrentSnapshot,
        setLastSavedSnapshot: (snapshot) => {
            state.lastSavedSnapshot = snapshot;
        },
        getCurrentView: () => ({ centre: getMap().getCenter(), zoom: getMap().getZoom() }),
        applySettings: (settings) => settingsStore.applyFromSettings(settings),
        removeAllLayers: () => layers.mapStateCoordinator.removeAllLayers(),
        addLayers: (layerIds) => layers.mapStateCoordinator.addLayers(layerIds),
        setVisibleLayerIds: (layerIds) => {
            mapStore.visibleLayerIds = layerIds;
        },
        recomputeGroupPresentation: recomputeFeatureVisibility,
        appVersion: APP_VERSION
    });
    const mutationAreaRevealer = new MutationAreaRevealer({ getMap });
    const navigation = new HistoryNavigationCoordinator({
        undoJournal,
        getActiveHistoryTitle: () => lifecycle.getActiveHistoryTitle(),
        applyReplay: async (entry) => {
            const groupStore = useGroupStore(pinia);
            const preferredPhase =
                groupStore.phaseGroupId && groupStore.phaseVersionId
                    ? {
                          groupId: groupStore.phaseGroupId,
                          versionId: groupStore.phaseVersionId,
                          phaseId: groupStore.phaseEditingId ?? groupStore.focusedPhaseId
                      }
                    : null;
            const phaseReplayContext = getPhaseReplayContext(entry, preferredPhase);
            const applied = await replay.apply(entry);
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

    return {
        buildCurrentSnapshot,
        lifecycle,
        navigation,
        syncHistoryStatus,
        activateHistory,
        runViewCheckpointMigration: () => lifecycle.migrateViewOnlyCheckpoints()
    };
}

export type MapManagerHistory = ReturnType<typeof createMapManagerHistory>;
