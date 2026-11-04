import { watch } from 'vue';
import type { SerializedMap } from '../../services/MapSerializer';
import { pinia } from '../../stores/index';
import { useGroupStore } from '../../stores/groupStore';
import {
    pruneDanglingGroupMembers,
    recomputeFeatureVisibility,
    resetGroupVisibility
} from '../../composables/useGroups';
import { MapLayerController } from './MapLayerController';
import { MapStateCoordinator } from './MapStateCoordinator';
import { MapDataLoader } from './MapDataLoader';
import { ImportedGeoJsonLayerController } from './ImportedGeoJsonLayerController';
import { APP_VERSION, type MapManagerContext } from './mapManagerContext';

export function createMapManagerLayers(context: MapManagerContext, setDefaultView: () => void) {
    const { getMap, mapStore, settingsStore, importedLayerStore } = context;
    const mapLayerController = new MapLayerController({
        getMap,
        getLayers: () => mapStore.layers
    });
    const importedLayerController = new ImportedGeoJsonLayerController({
        getMap,
        isSuppressed: () => useGroupStore(pinia).soloGroupId !== null,
        isFeatureVisible: (layerId, featureIndex) =>
            importedLayerStore.isFeatureVisible(layerId, featureIndex),
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
        clearGroups: () => useGroupStore(pinia).setGroups([]),
        setAllGroupsHidden: (hidden) => useGroupStore(pinia).setAllHidden(hidden),
        resetGroupVisibility
    });
    const mapDataLoader = new MapDataLoader({
        getMap,
        setDefaultView,
        mapLayerController,
        setTitle: (title) => {
            settingsStore.title = title;
        },
        applySettings: (settings) => settingsStore.applyFromSettings(settings),
        setCentre: (centre) => {
            settingsStore.centre = centre;
        },
        setZoom: (zoom) => {
            settingsStore.zoom = zoom;
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
        setGroups: (groups) => useGroupStore(pinia).setGroups(groups),
        setAllGroupsHidden: (hidden) => useGroupStore(pinia).setAllHidden(hidden),
        resetGroupVisibility,
        recomputeGroupVisibility: recomputeFeatureVisibility,
        pruneDanglingGroupMembers,
        appVersion: APP_VERSION,
        setImportedLayers: (layers) => importedLayerStore.setLayers(layers)
    });

    watch(
        () => [
            useGroupStore(pinia).soloGroupId,
            ...Array.from(importedLayerStore.itemVisibility, ([id, state]) => [
                id,
                state.soloIndex,
                state.hiddenIndices
            ]),
            ...importedLayerStore.layers.map((layer) => [
                layer.id,
                layer.name,
                layer.nameProperty,
                layer.visible,
                layer.featureCollection
            ])
        ],
        () => importedLayerController.render(importedLayerStore.layers)
    );

    return {
        mapStateCoordinator,
        loadMapData: (data: SerializedMap | null, zoom: string | null, centre: number[] | null) =>
            mapDataLoader.load(data, zoom, centre),
        resetSettings: () => {
            settingsStore.readOnly = false;
            mapStateCoordinator.resetSettings();
        }
    };
}

export type MapManagerLayers = ReturnType<typeof createMapManagerLayers>;
