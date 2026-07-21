import * as L from 'leaflet';
import type { IMapLayer } from '../../composables/layers/IMapLayer';
import type { LayerMutationEvent } from '../../models/LayerMutation';
import type { SerializedMap } from '../../services/MapSerializer';
import type { HistoryReplayEntry } from '../../services/UndoJournal';
import { dispatchHistoryReplay } from './historyReplayDispatch';
import { replayFeatureMutation } from './featureMutationReplay';
import { getSettingsMutationTarget } from './settingsMutationReplay';
import {
    runHistoryReplayTransaction,
    type HistoryReplayTransactionEffects
} from './historyReplayTransaction';

export interface HistoryReplayCoordinatorOptions {
    transactionEffects: HistoryReplayTransactionEffects;
    getLayers: () => IMapLayer[];
    clearAllLayers: () => void;
    resetSettings: () => void;
    loadMapData: (snapshot: SerializedMap) => boolean;
    saveMap: () => Promise<void>;
    buildSnapshot: () => SerializedMap;
    setLastSavedSnapshot: (snapshot: SerializedMap) => void;
    applySettings: (settings: {
        title: string;
        readOnly: boolean;
        hideToolbar: boolean;
        activeLayers: string[];
        centre: L.LatLng | null;
        zoom: number;
        version: string;
    }) => void;
    removeAllLayers: () => void;
    addLayers: (layerIds: string[]) => void;
    setVisibleLayerIds: (layerIds: Set<string>) => void;
}

export class HistoryReplayCoordinator {
    private readonly options: HistoryReplayCoordinatorOptions;

    constructor(options: HistoryReplayCoordinatorOptions) {
        this.options = options;
    }

    async apply(replay: HistoryReplayEntry | null): Promise<boolean> {
        if (!replay) {
            return false;
        }

        const action = dispatchHistoryReplay(replay);
        if (action.kind === 'feature') {
            return await this.applyFeatureMutationReplay(replay, action.mutation);
        }
        if (action.kind === 'settings') {
            return await this.applySettingsMutationReplay(replay, action.payload);
        }
        return await this.applySnapshot(replay.snapshot);
    }

    private async applySnapshot(snapshot: SerializedMap): Promise<boolean> {
        return await runHistoryReplayTransaction(this.options.transactionEffects, async () => {
            this.options.clearAllLayers();
            this.options.resetSettings();

            if (!this.options.loadMapData(snapshot)) {
                return false;
            }

            await this.options.saveMap();
            this.options.setLastSavedSnapshot(this.options.buildSnapshot());
            return true;
        });
    }

    private async applyFeatureMutationReplay(
        replay: HistoryReplayEntry,
        mutation: LayerMutationEvent
    ): Promise<boolean> {
        const current = this.getCurrentLayerFeatureCollection(mutation.layerId);
        if (!current) {
            return await this.applySnapshot(replay.snapshot);
        }

        const replayedFeatureCollection = replayFeatureMutation(
            current.featureCollection,
            mutation,
            replay.direction
        );
        if (!replayedFeatureCollection) {
            return await this.applyLayerMutationReplay(replay.snapshot, mutation);
        }

        return await runHistoryReplayTransaction(this.options.transactionEffects, async () => {
            current.layer.getLayer().clearLayers();
            current.layer.loadFromGeoJSON(replayedFeatureCollection as unknown as L.GeoJSON);
            await this.options.saveMap();
            this.options.setLastSavedSnapshot(this.options.buildSnapshot());
            return true;
        });
    }

    private async applyLayerMutationReplay(
        snapshot: SerializedMap,
        mutation: LayerMutationEvent
    ): Promise<boolean> {
        const layer = this.options.getLayers().find((item) => item.id === mutation.layerId);
        if (!layer) {
            return await this.applySnapshot(snapshot);
        }

        return await runHistoryReplayTransaction(this.options.transactionEffects, async () => {
            const layerState = this.getSnapshotLayerData(snapshot, mutation.layerId);
            layer.getLayer().clearLayers();
            if (layerState) {
                layer.loadFromGeoJSON(layerState as L.GeoJSON);
            }
            await this.options.saveMap();
            this.options.setLastSavedSnapshot(this.options.buildSnapshot());
            return true;
        });
    }

    private async applySettingsMutationReplay(
        replay: HistoryReplayEntry,
        payload: unknown
    ): Promise<boolean> {
        const targetSettings = getSettingsMutationTarget(payload, replay.direction);
        if (!targetSettings) {
            return await this.applySnapshot(replay.snapshot);
        }

        return await runHistoryReplayTransaction(this.options.transactionEffects, async () => {
            this.options.applySettings({
                title: targetSettings.title,
                readOnly: targetSettings.readOnly,
                hideToolbar: targetSettings.hideToolbar,
                activeLayers: [...targetSettings.activeLayers],
                centre: targetSettings.centre
                    ? new L.LatLng(targetSettings.centre.lat, targetSettings.centre.lng)
                    : null,
                zoom: targetSettings.zoom,
                version: targetSettings.version
            });
            this.options.removeAllLayers();
            this.options.addLayers(targetSettings.activeLayers);
            this.options.setVisibleLayerIds(new Set(targetSettings.activeLayers));
            await this.options.saveMap();
            this.options.setLastSavedSnapshot(this.options.buildSnapshot());
            return true;
        });
    }

    private getSnapshotLayerData(snapshot: SerializedMap, layerId: string) {
        const layers = snapshot.layers;
        if (!layers) {
            return undefined;
        }
        if (layers[layerId] !== undefined) {
            return layers[layerId];
        }
        if (layerId === 'ModalFilters' && layers['Modals'] !== undefined) {
            return layers['Modals'];
        }
        if (layerId === 'MobilityLanes' && layers['CycleLanes'] !== undefined) {
            return layers['CycleLanes'];
        }
        return undefined;
    }

    private getCurrentLayerFeatureCollection(layerId: string) {
        const layer = this.options.getLayers().find((item) => item.id === layerId);
        if (!layer) {
            return null;
        }
        const featureCollection = layer.toGeoJSON() as { features?: unknown[] };
        return {
            layer,
            featureCollection: {
                type: 'FeatureCollection',
                features: [...(featureCollection.features ?? [])]
            }
        };
    }
}
