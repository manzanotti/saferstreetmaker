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
import { watch } from 'vue';
import { FileManager } from '../services/FileManager';
import { UndoJournal, type HistoryReplayEntry } from '../services/UndoJournal';
import { SAVE_ERROR_ALREADY_SHOWN } from './saveErrorMarker';
import type { SerializedMap } from '../services/MapSerializer';
import { Settings } from '../models/Settings';
import { useHistoryStore } from '../stores/historyStore';
import { useMapStore, type LayerMutationEvent } from '../stores/mapStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useGroupStore } from '../stores/groupStore';
import { pruneDanglingGroupMembers } from './useGroups';
import { pinia } from '../stores/index';

const APP_VERSION = '0.9.0';

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

export function setupMapManager(fileManager: FileManager): MapManager {
    _fileManager = fileManager;
    const historyStore = useHistoryStore(pinia);
    const mapStore = useMapStore(pinia);
    const settingsStore = useSettingsStore(pinia);
    const uiStore = useUiStore(pinia);
    const undoJournal = new UndoJournal();
    let activeHistoryMapTitle: string | null = null;
    let lastSavedSnapshot: SerializedMap | null = null;
    let suppressHistory = false;
    let pendingHistoryMutation: HistoryMutation | null = null;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const getErrorMessage = (error: unknown): string => {
        return String((error as { message?: unknown } | null | undefined)?.message ?? error);
    };

    const getErrorStack = (error: unknown): string | null => {
        const stack = (error as { stack?: unknown } | null | undefined)?.stack;
        return stack == null ? null : String(stack);
    };

    const getMap = (): L.Map => {
        const m = mapStore.map;
        if (!m) {
            throw new Error('Leaflet map not initialised');
        }
        return m;
    };

    const buildCurrentSnapshot = (): SerializedMap => {
        const groupStore = useGroupStore(pinia);
        return fileManager.buildSerializedMap(
            settingsStore.toSettings(),
            mapStore.toLayers(),
            groupStore.groups
        );
    };

    const normaliseSnapshot = (snapshot: SerializedMap | null): unknown => {
        if (!snapshot) {
            return null;
        }

        // Map view state (centre + zoom) is persisted to storage but must NOT
        // count as a feature change for undo/redo. Excluding it here means
        // panning or zooming the map never records a history checkpoint — only
        // actual feature/settings/group edits do.
        const settingsWithoutView = snapshot.settings
            ? {
                  title: snapshot.settings.title,
                  readOnly: snapshot.settings.readOnly,
                  hideToolbar: snapshot.settings.hideToolbar,
                  activeLayers: snapshot.settings.activeLayers,
                  version: snapshot.settings.version
              }
            : snapshot.settings;

        return {
            title: snapshot.title,
            settings: settingsWithoutView,
            layers: snapshot.layers,
            groups: snapshot.groups
        };
    };

    const snapshotsEqual = (left: SerializedMap | null, right: SerializedMap | null): boolean => {
        return JSON.stringify(normaliseSnapshot(left)) === JSON.stringify(normaliseSnapshot(right));
    };

    const syncHistoryStatus = async () => {
        if (!activeHistoryMapTitle) {
            historyStore.clearStatus();
            return;
        }

        historyStore.setStatus(await undoJournal.getStatus(activeHistoryMapTitle));
    };

    /**
     * One-time cleanup of legacy pan/zoom-only checkpoints from every stored
     * map's history. Older releases recorded a checkpoint whenever the map view
     * (centre/zoom) changed; those entries are no-ops now that view state is
     * excluded from history, so remove them from existing undo stacks. Guarded
     * by a metadata flag inside UndoJournal so it runs at most once.
     */
    const runViewCheckpointMigration = async () => {
        try {
            const titles = new Set(await fileManager.loadMapListFromStorage());
            if (activeHistoryMapTitle) {
                titles.add(activeHistoryMapTitle);
            }
            await undoJournal.migrateRemoveViewOnlyCheckpoints([...titles], (before, after) =>
                snapshotsEqual(before as SerializedMap, after as SerializedMap)
            );
            await syncHistoryStatus();
        } catch {
            // Best-effort cleanup — never block map loading on a migration error.
        }
    };

    const activateHistory = async (mapTitle: string, options?: { reset?: boolean }) => {
        activeHistoryMapTitle = mapTitle;
        if (options?.reset) {
            await undoJournal.clearHistory(mapTitle);
            lastSavedSnapshot = buildCurrentSnapshot();
            historyStore.clearStatus();
        }
        void syncHistoryStatus();
    };

    activeHistoryMapTitle = settingsStore.title;
    lastSavedSnapshot = buildCurrentSnapshot();
    historyStore.clearStatus();
    void syncHistoryStatus();

    const applySnapshot = async (snapshot: SerializedMap): Promise<boolean> => {
        suppressHistory = true;
        historyStore.setBusy(true);

        try {
            clearAllLayers();
            resetSettings();

            const ok = loadMapData(snapshot, null, null);
            if (!ok) {
                return false;
            }

            const groupStore = useGroupStore(pinia);
            await fileManager.saveMap(
                settingsStore.toSettings(),
                mapStore.toLayers(),
                groupStore.groups
            );
            lastSavedSnapshot = buildCurrentSnapshot();
            return true;
        } finally {
            suppressHistory = false;
            historyStore.setBusy(false);
        }
    };

    const getSnapshotLayerData = (snapshot: SerializedMap, layerId: string) => {
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
    };

    const getCurrentLayerFeatureCollection = (layerId: string) => {
        const layer = mapStore.layers.find((item) => item.id === layerId);
        if (!layer) {
            return null;
        }

        const featureCollection = layer.toGeoJSON() as {
            type?: string;
            features?: unknown[];
        };
        return {
            layer,
            featureCollection: {
                type: 'FeatureCollection',
                features: [...(featureCollection.features ?? [])]
            }
        };
    };

    const serialiseFeature = (feature: unknown): string => {
        return JSON.stringify(feature);
    };

    const getFeatureHistoryId = (feature: unknown): string | null => {
        return (
            ((feature as { properties?: { historyId?: unknown } } | null | undefined)?.properties
                ?.historyId as string | undefined) ?? null
        );
    };

    const buildPointFeatureFromMutation = (mutation: LayerMutationEvent) => {
        const payload = mutation.payload as
            | {
                  lat?: number | null;
                  lng?: number | null;
                  historyId?: string | null;
              }
            | undefined;

        if (payload?.lat == null || payload?.lng == null) {
            return null;
        }

        return {
            type: 'Feature',
            properties: {
                historyId: payload.historyId ?? ''
            },
            geometry: {
                type: 'Point',
                coordinates: [payload.lng, payload.lat]
            }
        };
    };

    const cloneValue = <T>(value: T): T => {
        return JSON.parse(JSON.stringify(value)) as T;
    };

    const isCompactPolylineEditPayload = (
        payload: unknown
    ): payload is {
        historyId: string;
        beforeCoordinates: number[][];
        afterCoordinates: number[][];
    } => {
        return (
            payload != null &&
            typeof payload === 'object' &&
            !Array.isArray(payload) &&
            typeof (payload as { historyId?: unknown }).historyId === 'string' &&
            Array.isArray((payload as { beforeCoordinates?: unknown }).beforeCoordinates) &&
            Array.isArray((payload as { afterCoordinates?: unknown }).afterCoordinates)
        );
    };

    const isPointBatchDeletePayload = (
        payload: unknown
    ): payload is {
        points: unknown[];
    } => {
        return (
            payload != null &&
            typeof payload === 'object' &&
            !Array.isArray(payload) &&
            Array.isArray((payload as { points?: unknown }).points)
        );
    };

    const isPolylinePointChangePayload = (
        payload: unknown
    ): payload is {
        historyId: string;
        pointChanges: Array<{
            type: 'update' | 'insert' | 'delete';
            index: number;
            before?: number[];
            after?: number[];
        }>;
    } => {
        return (
            payload != null &&
            typeof payload === 'object' &&
            !Array.isArray(payload) &&
            typeof (payload as { historyId?: unknown }).historyId === 'string' &&
            Array.isArray((payload as { pointChanges?: unknown }).pointChanges)
        );
    };

    const isCompactPolygonEditPayload = (
        payload: unknown
    ): payload is {
        historyId: string;
        beforeCoordinates: number[][][];
        afterCoordinates: number[][][];
        beforeLabel: string;
        afterLabel: string;
        beforeColor: string;
        afterColor: string;
    } => {
        return (
            payload != null &&
            typeof payload === 'object' &&
            !Array.isArray(payload) &&
            typeof (payload as { historyId?: unknown }).historyId === 'string' &&
            Array.isArray((payload as { beforeCoordinates?: unknown }).beforeCoordinates) &&
            Array.isArray((payload as { afterCoordinates?: unknown }).afterCoordinates) &&
            typeof (payload as { beforeLabel?: unknown }).beforeLabel === 'string' &&
            typeof (payload as { afterLabel?: unknown }).afterLabel === 'string' &&
            typeof (payload as { beforeColor?: unknown }).beforeColor === 'string' &&
            typeof (payload as { afterColor?: unknown }).afterColor === 'string'
        );
    };

    const isPolygonPointChangePayload = (
        payload: unknown
    ): payload is {
        historyId: string;
        pointChanges: Array<{
            type: 'update' | 'insert' | 'delete';
            ringIndex: number;
            pointIndex: number;
            before?: number[];
            after?: number[];
        }>;
        beforeLabel: string;
        afterLabel: string;
        beforeColor: string;
        afterColor: string;
    } => {
        return (
            payload != null &&
            typeof payload === 'object' &&
            !Array.isArray(payload) &&
            typeof (payload as { historyId?: unknown }).historyId === 'string' &&
            Array.isArray((payload as { pointChanges?: unknown }).pointChanges) &&
            typeof (payload as { beforeLabel?: unknown }).beforeLabel === 'string' &&
            typeof (payload as { afterLabel?: unknown }).afterLabel === 'string' &&
            typeof (payload as { beforeColor?: unknown }).beforeColor === 'string' &&
            typeof (payload as { afterColor?: unknown }).afterColor === 'string'
        );
    };

    const applyLayerMutationReplay = async (
        snapshot: SerializedMap,
        mutation: LayerMutationEvent
    ): Promise<boolean> => {
        const layer = mapStore.layers.find((item) => item.id === mutation.layerId);
        if (!layer) {
            return await applySnapshot(snapshot);
        }

        suppressHistory = true;
        historyStore.setBusy(true);

        try {
            const layerState = getSnapshotLayerData(snapshot, mutation.layerId);
            layer.getLayer().clearLayers();

            if (layerState) {
                layer.loadFromGeoJSON(layerState as L.GeoJSON);
            }

            await fileManager.saveMap(settingsStore.toSettings(), mapStore.toLayers());
            lastSavedSnapshot = buildCurrentSnapshot();
            return true;
        } finally {
            suppressHistory = false;
            historyStore.setBusy(false);
        }
    };

    const applyFeatureMutationReplay = async (
        replay: HistoryReplayEntry,
        mutation: LayerMutationEvent
    ): Promise<boolean> => {
        const current = getCurrentLayerFeatureCollection(mutation.layerId);
        if (!current) {
            return await applySnapshot(replay.snapshot);
        }

        const { layer, featureCollection } = current;
        const payload = mutation.payload as
            | {
                  before?: unknown;
                  after?: unknown;
              }
            | undefined;

        const beforeFeature = payload?.before;
        const afterFeature = payload?.after;
        const beforeKey = beforeFeature ? serialiseFeature(beforeFeature) : null;
        const afterKey = afterFeature ? serialiseFeature(afterFeature) : null;
        const beforeHistoryId = getFeatureHistoryId(beforeFeature);
        const afterHistoryId = getFeatureHistoryId(afterFeature);

        const replaceFeature = (fromKey: string | null, nextFeature: unknown): boolean => {
            const index = featureCollection.features.findIndex((feature) => {
                const currentHistoryId = getFeatureHistoryId(feature);
                if (fromHistoryId !== null && currentHistoryId !== null) {
                    return currentHistoryId === fromHistoryId;
                }

                return serialiseFeature(feature) === fromKey;
            });
            if (index >= 0) {
                featureCollection.features[index] = nextFeature;
                return true;
            }

            return false;
        };

        const replaceFeatureCoordinates = (historyId: string, coordinates: number[][]): boolean => {
            const index = featureCollection.features.findIndex((feature) => {
                return getFeatureHistoryId(feature) === historyId;
            });

            if (index < 0) {
                return false;
            }

            const currentFeature = featureCollection.features[index] as {
                geometry?: { coordinates?: unknown };
            };
            const nextFeature = cloneValue(currentFeature);
            if (!nextFeature.geometry) {
                return false;
            }

            nextFeature.geometry.coordinates = cloneValue(coordinates);
            featureCollection.features[index] = nextFeature;
            return true;
        };

        const applyPolylinePointChanges = (
            historyId: string,
            pointChanges: Array<{
                type: 'update' | 'insert' | 'delete';
                index: number;
                before?: number[];
                after?: number[];
            }>,
            direction: 'undo' | 'redo'
        ): boolean => {
            const index = featureCollection.features.findIndex((feature) => {
                return getFeatureHistoryId(feature) === historyId;
            });

            if (index < 0) {
                return false;
            }

            const currentFeature = featureCollection.features[index] as {
                geometry?: { coordinates?: unknown };
            };
            const nextFeature = cloneValue(currentFeature);
            const nextCoordinates = nextFeature.geometry?.coordinates;
            if (!Array.isArray(nextCoordinates)) {
                return false;
            }

            const deleteChanges = pointChanges.filter((change) => {
                return (
                    (direction === 'undo' && change.type === 'insert') ||
                    (direction === 'redo' && change.type === 'delete')
                );
            });
            deleteChanges
                .sort((left, right) => right.index - left.index)
                .forEach((change) => {
                    nextCoordinates.splice(change.index, 1);
                });

            for (const change of pointChanges) {
                if (change.type !== 'update') {
                    continue;
                }

                const target = direction === 'undo' ? change.before : change.after;
                if (!Array.isArray(target) || !Array.isArray(nextCoordinates[change.index])) {
                    return false;
                }

                nextCoordinates[change.index] = cloneValue(target);
            }

            const insertChanges = pointChanges.filter((change) => {
                return (
                    (direction === 'undo' && change.type === 'delete') ||
                    (direction === 'redo' && change.type === 'insert')
                );
            });
            insertChanges
                .sort((left, right) => left.index - right.index)
                .forEach((change) => {
                    const target = direction === 'undo' ? change.before : change.after;
                    if (!Array.isArray(target)) {
                        return;
                    }

                    nextCoordinates.splice(change.index, 0, cloneValue(target));
                });

            if (
                insertChanges.some((change) => {
                    const target = direction === 'undo' ? change.before : change.after;
                    return !Array.isArray(target);
                })
            ) {
                return false;
            }

            featureCollection.features[index] = nextFeature;
            return true;
        };

        const replacePolygonFeatureState = (
            historyId: string,
            coordinates: number[][][],
            label: string,
            color: string
        ): boolean => {
            const index = featureCollection.features.findIndex((feature) => {
                return getFeatureHistoryId(feature) === historyId;
            });

            if (index < 0) {
                return false;
            }

            const currentFeature = featureCollection.features[index] as {
                geometry?: { coordinates?: unknown };
                properties?: { label?: unknown; color?: unknown; historyId?: unknown };
            };
            const nextFeature = cloneValue(currentFeature);
            if (!nextFeature.geometry) {
                return false;
            }

            nextFeature.geometry.coordinates = cloneValue(coordinates);
            nextFeature.properties = nextFeature.properties ?? {};
            nextFeature.properties.label = label;
            nextFeature.properties.color = color;
            nextFeature.properties.historyId = historyId;
            featureCollection.features[index] = nextFeature;
            return true;
        };

        const hasFeature = (historyId: string | null, key: string | null) => {
            return featureCollection.features.some((feature) => {
                const currentHistoryId = getFeatureHistoryId(feature);
                if (historyId !== null && currentHistoryId !== null) {
                    return currentHistoryId === historyId;
                }

                return serialiseFeature(feature) === key;
            });
        };

        const fromHistoryId = replay.direction === 'undo' ? afterHistoryId : beforeHistoryId;

        const restoreLayerFromSnapshot = async () => {
            return await applyLayerMutationReplay(replay.snapshot, mutation);
        };

        if (
            mutation.kind === 'point-add' ||
            mutation.kind === 'point-delete' ||
            mutation.kind === 'point-batch-delete'
        ) {
            if (mutation.kind === 'point-batch-delete') {
                if (!isPointBatchDeletePayload(mutation.payload)) {
                    return await restoreLayerFromSnapshot();
                }

                const batchFeatures = mutation.payload.points;
                if (replay.direction === 'undo') {
                    for (const pointFeature of batchFeatures) {
                        if (!pointFeature) {
                            continue;
                        }
                        const pointHistoryId = getFeatureHistoryId(pointFeature);
                        const pointKey = pointFeature ? serialiseFeature(pointFeature) : null;
                        if (!hasFeature(pointHistoryId, pointKey)) {
                            featureCollection.features.push(pointFeature);
                        }
                    }
                } else {
                    // Precompute Sets of batch historyIds and serialised keys so
                    // the filter below is O(n+m) instead of O(n*m).
                    const batchHistoryIdSet = new Set<string>();
                    const batchKeySet = new Set<string | null>();
                    for (const batchFeature of batchFeatures) {
                        if (!batchFeature) {
                            continue;
                        }
                        const batchHistoryId = getFeatureHistoryId(batchFeature);
                        if (batchHistoryId !== null) {
                            batchHistoryIdSet.add(batchHistoryId);
                        } else {
                            batchKeySet.add(serialiseFeature(batchFeature));
                        }
                    }
                    featureCollection.features = featureCollection.features.filter((feature) => {
                        const currentHistoryId = getFeatureHistoryId(feature);
                        if (currentHistoryId !== null && batchHistoryIdSet.has(currentHistoryId)) {
                            return false;
                        }
                        return !batchKeySet.has(serialiseFeature(feature));
                    });
                }
            } else {
                const pointFeature = buildPointFeatureFromMutation(mutation);
                const pointHistoryId = getFeatureHistoryId(pointFeature);
                const pointKey = pointFeature ? serialiseFeature(pointFeature) : null;

                if (mutation.kind === 'point-add') {
                    if (replay.direction === 'undo') {
                        featureCollection.features = featureCollection.features.filter(
                            (feature) => {
                                const currentHistoryId = getFeatureHistoryId(feature);
                                if (pointHistoryId !== null && currentHistoryId !== null) {
                                    return currentHistoryId !== pointHistoryId;
                                }

                                return serialiseFeature(feature) !== pointKey;
                            }
                        );
                    } else if (pointFeature && !hasFeature(pointHistoryId, pointKey)) {
                        featureCollection.features.push(pointFeature);
                    }
                } else if (mutation.kind === 'point-delete') {
                    if (replay.direction === 'undo') {
                        if (pointFeature && !hasFeature(pointHistoryId, pointKey)) {
                            featureCollection.features.push(pointFeature);
                        }
                    } else {
                        featureCollection.features = featureCollection.features.filter(
                            (feature) => {
                                const currentHistoryId = getFeatureHistoryId(feature);
                                if (pointHistoryId !== null && currentHistoryId !== null) {
                                    return currentHistoryId !== pointHistoryId;
                                }

                                return serialiseFeature(feature) !== pointKey;
                            }
                        );
                    }
                }
            }
        } else if (mutation.kind === 'polyline-add' || mutation.kind === 'polygon-add') {
            if (replay.direction === 'undo') {
                featureCollection.features = featureCollection.features.filter((feature) => {
                    const currentHistoryId = getFeatureHistoryId(feature);
                    if (afterHistoryId !== null && currentHistoryId !== null) {
                        return currentHistoryId !== afterHistoryId;
                    }

                    return serialiseFeature(feature) !== afterKey;
                });
            } else if (afterFeature) {
                if (!hasFeature(afterHistoryId, afterKey)) {
                    featureCollection.features.push(afterFeature);
                }
            } else {
                return await restoreLayerFromSnapshot();
            }
        } else if (
            mutation.kind === 'polyline-delete' ||
            mutation.kind === 'polygon-delete' ||
            mutation.kind === 'polygon-batch-delete'
        ) {
            if (replay.direction === 'undo') {
                if (beforeFeature && !hasFeature(beforeHistoryId, beforeKey)) {
                    featureCollection.features.push(beforeFeature);
                }
            } else {
                featureCollection.features = featureCollection.features.filter((feature) => {
                    const currentHistoryId = getFeatureHistoryId(feature);
                    if (beforeHistoryId !== null && currentHistoryId !== null) {
                        return currentHistoryId !== beforeHistoryId;
                    }

                    return serialiseFeature(feature) !== beforeKey;
                });
            }
        } else if (
            mutation.kind === 'polyline-edit' ||
            mutation.kind === 'polyline-vertices-delete'
        ) {
            if (isPolylinePointChangePayload(mutation.payload)) {
                if (
                    !applyPolylinePointChanges(
                        mutation.payload.historyId,
                        mutation.payload.pointChanges,
                        replay.direction
                    )
                ) {
                    return await restoreLayerFromSnapshot();
                }
            } else if (isCompactPolylineEditPayload(mutation.payload)) {
                const nextCoordinates =
                    replay.direction === 'undo'
                        ? mutation.payload.beforeCoordinates
                        : mutation.payload.afterCoordinates;

                if (!replaceFeatureCoordinates(mutation.payload.historyId, nextCoordinates)) {
                    return await restoreLayerFromSnapshot();
                }
            } else if (replay.direction === 'undo' && beforeFeature) {
                if (!replaceFeature(afterKey, beforeFeature)) {
                    return await restoreLayerFromSnapshot();
                }
            } else if (replay.direction === 'redo' && afterFeature) {
                if (!replaceFeature(beforeKey, afterFeature)) {
                    return await restoreLayerFromSnapshot();
                }
            } else {
                return await restoreLayerFromSnapshot();
            }
        } else if (mutation.kind === 'polygon-edit') {
            if (isPolygonPointChangePayload(mutation.payload)) {
                const polygonPayload = mutation.payload;
                const nextLabel =
                    replay.direction === 'undo'
                        ? polygonPayload.beforeLabel
                        : polygonPayload.afterLabel;
                const nextColor =
                    replay.direction === 'undo'
                        ? polygonPayload.beforeColor
                        : polygonPayload.afterColor;

                const index = featureCollection.features.findIndex((feature) => {
                    return getFeatureHistoryId(feature) === polygonPayload.historyId;
                });
                if (index < 0) {
                    return await restoreLayerFromSnapshot();
                }

                const currentFeature = featureCollection.features[index] as {
                    geometry?: { coordinates?: number[][][] };
                    properties?: Record<string, unknown>;
                };
                const nextFeature = cloneValue(currentFeature);
                const nextCoordinates = nextFeature.geometry?.coordinates;
                if (!Array.isArray(nextCoordinates)) {
                    return await restoreLayerFromSnapshot();
                }

                const deleteChanges = polygonPayload.pointChanges.filter((change) => {
                    return (
                        (replay.direction === 'undo' && change.type === 'insert') ||
                        (replay.direction === 'redo' && change.type === 'delete')
                    );
                });
                deleteChanges
                    .sort((left, right) => {
                        if (left.ringIndex !== right.ringIndex) {
                            return right.ringIndex - left.ringIndex;
                        }

                        return right.pointIndex - left.pointIndex;
                    })
                    .forEach((change) => {
                        const ring = nextCoordinates[change.ringIndex];
                        if (Array.isArray(ring)) {
                            ring.splice(change.pointIndex, 1);
                        }
                    });

                if (
                    deleteChanges.some((change) => {
                        return !Array.isArray(nextCoordinates[change.ringIndex]);
                    })
                ) {
                    return await restoreLayerFromSnapshot();
                }

                for (const change of polygonPayload.pointChanges) {
                    if (change.type !== 'update') {
                        continue;
                    }

                    const ring = nextCoordinates[change.ringIndex];
                    const target = replay.direction === 'undo' ? change.before : change.after;
                    if (
                        !Array.isArray(ring) ||
                        !Array.isArray(ring[change.pointIndex]) ||
                        !Array.isArray(target)
                    ) {
                        return await restoreLayerFromSnapshot();
                    }

                    ring[change.pointIndex] = cloneValue(target);
                }

                const insertChanges = polygonPayload.pointChanges.filter((change) => {
                    return (
                        (replay.direction === 'undo' && change.type === 'delete') ||
                        (replay.direction === 'redo' && change.type === 'insert')
                    );
                });
                insertChanges
                    .sort((left, right) => {
                        if (left.ringIndex !== right.ringIndex) {
                            return left.ringIndex - right.ringIndex;
                        }

                        return left.pointIndex - right.pointIndex;
                    })
                    .forEach((change) => {
                        const ring = nextCoordinates[change.ringIndex];
                        const target = replay.direction === 'undo' ? change.before : change.after;
                        if (Array.isArray(ring) && Array.isArray(target)) {
                            ring.splice(change.pointIndex, 0, cloneValue(target));
                        }
                    });

                if (
                    insertChanges.some((change) => {
                        const ring = nextCoordinates[change.ringIndex];
                        const target = replay.direction === 'undo' ? change.before : change.after;
                        return !Array.isArray(ring) || !Array.isArray(target);
                    })
                ) {
                    return await restoreLayerFromSnapshot();
                }

                nextFeature.properties = nextFeature.properties ?? {};
                nextFeature.properties.label = nextLabel;
                nextFeature.properties.color = nextColor;
                nextFeature.properties.historyId = polygonPayload.historyId;
                featureCollection.features[index] = nextFeature;
            } else if (isCompactPolygonEditPayload(mutation.payload)) {
                const nextCoordinates =
                    replay.direction === 'undo'
                        ? mutation.payload.beforeCoordinates
                        : mutation.payload.afterCoordinates;
                const nextLabel =
                    replay.direction === 'undo'
                        ? mutation.payload.beforeLabel
                        : mutation.payload.afterLabel;
                const nextColor =
                    replay.direction === 'undo'
                        ? mutation.payload.beforeColor
                        : mutation.payload.afterColor;

                if (
                    !replacePolygonFeatureState(
                        mutation.payload.historyId,
                        nextCoordinates,
                        nextLabel,
                        nextColor
                    )
                ) {
                    return await restoreLayerFromSnapshot();
                }
            } else if (replay.direction === 'undo' && beforeFeature) {
                if (!replaceFeature(afterKey, beforeFeature)) {
                    return await restoreLayerFromSnapshot();
                }
            } else if (replay.direction === 'redo' && afterFeature) {
                if (!replaceFeature(beforeKey, afterFeature)) {
                    return await restoreLayerFromSnapshot();
                }
            } else {
                return await restoreLayerFromSnapshot();
            }
        }

        suppressHistory = true;
        historyStore.setBusy(true);

        try {
            layer.getLayer().clearLayers();
            layer.loadFromGeoJSON(featureCollection as unknown as L.GeoJSON);
            const groupStore = useGroupStore(pinia);
            await fileManager.saveMap(
                settingsStore.toSettings(),
                mapStore.toLayers(),
                groupStore.groups
            );
            lastSavedSnapshot = buildCurrentSnapshot();
            return true;
        } finally {
            suppressHistory = false;
            historyStore.setBusy(false);
        }
    };

    const applySettingsMutationReplay = async (
        replay: HistoryReplayEntry,
        mutation: {
            payload?: unknown;
        }
    ): Promise<boolean> => {
        const payload = mutation.payload as
            | {
                  before?: {
                      title: string;
                      readOnly: boolean;
                      hideToolbar: boolean;
                      activeLayers: string[];
                      centre: { lat: number; lng: number } | null;
                      zoom: number;
                      version: string;
                  };
                  after?: {
                      title: string;
                      readOnly: boolean;
                      hideToolbar: boolean;
                      activeLayers: string[];
                      centre: { lat: number; lng: number } | null;
                      zoom: number;
                      version: string;
                  };
              }
            | undefined;

        const targetSettings = replay.direction === 'undo' ? payload?.before : payload?.after;
        if (!targetSettings) {
            return await applySnapshot(replay.snapshot);
        }

        suppressHistory = true;
        historyStore.setBusy(true);

        try {
            settingsStore.applyFromSettings({
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

            removeAllLayersFromMap();
            addLayersToMap(targetSettings.activeLayers);
            mapStore.visibleLayerIds = new Set(targetSettings.activeLayers);

            const groupStore = useGroupStore(pinia);
            await fileManager.saveMap(
                settingsStore.toSettings(),
                mapStore.toLayers(),
                groupStore.groups
            );
            lastSavedSnapshot = buildCurrentSnapshot();
            return true;
        } finally {
            suppressHistory = false;
            historyStore.setBusy(false);
        }
    };

    const applyHistoryReplay = async (replay: HistoryReplayEntry | null): Promise<boolean> => {
        if (!replay) {
            return false;
        }

        const mutationKind = replay.entry.mutationKind;
        const mutationLayerId = replay.entry.mutationLayerId;
        const mutationPayload = replay.entry.mutationPayload;

        const normaliseFeatureMutationPayload = (kind: string, payload: unknown): unknown => {
            if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
                return payload;
            }

            if ('before' in payload || 'after' in payload) {
                return payload;
            }

            if (kind === 'polyline-add' || kind === 'polygon-add') {
                return { after: payload };
            }

            if (kind === 'polyline-delete' || kind === 'polygon-delete') {
                return { before: payload };
            }

            // For polyline-edit / polygon-edit the payload already has the
            // historyId-keyed shape (pointChanges / beforeCoordinates / etc.) which
            // applyFeatureMutationReplay handles before it inspects before/after keys.
            // The unchanged payload is therefore correct here.
            return payload;
        };

        if (
            mutationKind &&
            mutationLayerId &&
            (mutationKind === 'point-add' ||
                mutationKind === 'point-delete' ||
                mutationKind === 'point-batch-delete')
        ) {
            return await applyFeatureMutationReplay(replay, {
                kind: mutationKind,
                layerId: mutationLayerId,
                payload: mutationPayload
            });
        }

        if (
            mutationKind &&
            mutationLayerId &&
            (mutationKind === 'polyline-add' ||
                mutationKind === 'polyline-delete' ||
                mutationKind === 'polyline-edit' ||
                mutationKind === 'polyline-vertices-delete' ||
                mutationKind === 'polygon-add' ||
                mutationKind === 'polygon-delete' ||
                mutationKind === 'polygon-batch-delete' ||
                mutationKind === 'polygon-edit')
        ) {
            return await applyFeatureMutationReplay(replay, {
                kind: mutationKind,
                layerId: mutationLayerId,
                payload: normaliseFeatureMutationPayload(mutationKind, mutationPayload)
            });
        }

        if (mutationKind === 'settings-apply') {
            return await applySettingsMutationReplay(replay, {
                payload: replay.entry.mutationPayload
            });
        }

        return await applySnapshot(replay.snapshot);
    };

    const showSaveError = (error: unknown): void => {
        const errors = ['There was a problem saving the map:', getErrorMessage(error)];
        const errorStack = getErrorStack(error);
        if (errorStack) {
            errors.push(errorStack);
        }
        uiStore.showErrors(errors);
    };

    const markSaveErrorAsShown = (error: unknown): Error => {
        const err = error instanceof Error ? error : new Error(getErrorMessage(error));
        (err as Error & { [SAVE_ERROR_ALREADY_SHOWN]?: boolean })[SAVE_ERROR_ALREADY_SHOWN] = true;
        return err;
    };

    // ── View save debounce ────────────────────────────────────────────────────
    let saveViewTimer: ReturnType<typeof setTimeout> | undefined;

    const saveViewDebounced = () => {
        if (saveViewTimer !== undefined) {
            clearTimeout(saveViewTimer);
        }
        saveViewTimer = setTimeout(() => {
            saveViewTimer = undefined;
            void saveMap();
        }, 500);
    };

    // Watch settingsStore.zoom/centre changes (set by useMapEngine on zoom/move events)
    // to trigger a debounced save. Replaces the PubSub mapZoomChanged subscription.
    watch([() => settingsStore.zoom, () => settingsStore.centre], () => {
        saveViewDebounced();
    });

    // ── saveMap ───────────────────────────────────────────────────────────────
    const persistMap = async (options?: { throwOnFailure?: boolean; recordHistory?: boolean }) => {
        // Drop any group members whose feature was deleted through a non-group
        // path (area-select, popup delete, etc.) before snapshotting, so the
        // cleanup is folded into the same checkpoint as the deletion.
        pruneDanglingGroupMembers();

        const beforeSnapshot = lastSavedSnapshot;
        const afterSnapshot = buildCurrentSnapshot();
        const mutation = mapStore.lastLayerMutation ?? pendingHistoryMutation ?? undefined;

        try {
            const groupStore = useGroupStore(pinia);
            await fileManager.saveMap(
                settingsStore.toSettings(),
                mapStore.toLayers(),
                groupStore.groups
            );

            if (
                options?.recordHistory !== false &&
                !suppressHistory &&
                activeHistoryMapTitle &&
                beforeSnapshot &&
                !snapshotsEqual(beforeSnapshot, afterSnapshot)
            ) {
                await undoJournal.recordCheckpoint(
                    activeHistoryMapTitle,
                    beforeSnapshot,
                    afterSnapshot,
                    'checkpoint',
                    mutation
                );
                await syncHistoryStatus();
            }

            lastSavedSnapshot = afterSnapshot;
            mapStore.clearLastLayerMutation();
            pendingHistoryMutation = null;
            return true;
        } catch (e: any) {
            showSaveError(e);
            if (options?.throwOnFailure) {
                throw markSaveErrorAsShown(e);
            }

            return false;
        }
    };

    const saveMap = async () => {
        await persistMap();
    };

    const saveMapOrThrow = async () => {
        await persistMap({ throwOnFailure: true });
    };

    // ── Layer helpers ─────────────────────────────────────────────────────────
    const addLayersToMap = (activeLayers: string[]) => {
        const map = getMap();
        mapStore.layers.forEach((layer) => {
            if (activeLayers.includes(layer.id)) {
                layer.visible = true;
                map.addLayer(layer.getLayer());
            }
        });
    };

    const removeAllLayersFromMap = () => {
        const map = getMap();
        mapStore.layers.forEach((layer) => map.removeLayer(layer.getLayer()));
    };

    const clearAllLayers = () => {
        const map = getMap();
        const groupStore = useGroupStore(pinia);
        mapStore.layers.forEach((layer) => {
            layer.clearLayer();
            map.removeLayer(layer.getLayer());
        });
        groupStore.setGroups([]);
        groupStore.setAllHidden(false);
    };

    const buildAllActiveLayerIds = (): string[] => {
        return mapStore.layers.map((l) => l.id);
    };

    // ── loadMapData ───────────────────────────────────────────────────────────
    const loadMapData = (
        geoJSON: SerializedMap | null,
        zoom: string | null,
        centre: number[] | null
    ): boolean => {
        if (geoJSON === null) {
            return false;
        }

        const map = getMap();

        // Apply settings from JSON
        if (geoJSON.title !== undefined) {
            settingsStore.title = geoJSON.title;
        }

        if (geoJSON.settings !== undefined) {
            const rawCentre = geoJSON.settings.centre;
            const settingsCentre = rawCentre ? new L.LatLng(rawCentre.lat, rawCentre.lng) : null;

            const s: Settings = Object.assign(new Settings(), geoJSON.settings);
            settingsStore.applyFromSettings({
                title: s.title,
                readOnly: s.readOnly,
                hideToolbar: s.hideToolbar,
                activeLayers: s.activeLayers,
                centre: settingsCentre,
                zoom: s.zoom,
                version: s.version
            });
        }

        // Load layer data
        if (geoJSON.layers !== undefined) {
            const layersJSON = geoJSON.layers;
            mapStore.layers.forEach((layer) => {
                let layerName = layer.id;

                // Handle legacy key renames
                if (layerName === 'ModalFilters' && layersJSON['Modals'] !== undefined) {
                    layerName = 'Modals';
                } else if (
                    layerName === 'MobilityLanes' &&
                    layersJSON['CycleLanes'] !== undefined
                ) {
                    layerName = 'CycleLanes';
                }

                const layerJSON = layersJSON[layerName];
                if (layerJSON) {
                    layer.loadFromGeoJSON(layerJSON as L.GeoJSON);
                }

                if (settingsStore.activeLayers.includes(layer.id)) {
                    layer.visible = true;
                    map.addLayer(layer.getLayer());
                } else {
                    map.removeLayer(layer.getLayer());
                }
            });
        }

        // Apply stored centre/zoom from legacy JSON documents (only when settings is absent)
        if (
            geoJSON.settings === undefined &&
            geoJSON.centre !== undefined &&
            geoJSON.zoom !== undefined
        ) {
            settingsStore.centre = new L.LatLng(geoJSON.centre.lat, geoJSON.centre.lng);
            settingsStore.zoom = geoJSON.zoom;
        }

        settingsStore.version = APP_VERSION;

        // URL param overrides
        if (zoom) {
            const z = Number(zoom);
            if (!Number.isNaN(z)) {
                settingsStore.zoom = z;
            }
        }
        if (centre && centre.length === 2) {
            settingsStore.centre = new L.LatLng(centre[0], centre[1]);
        }

        // Set view
        if (settingsStore.centre) {
            map.setView([settingsStore.centre.lat, settingsStore.centre.lng], settingsStore.zoom);
        } else {
            setDefaultView();
        }

        // Sync visibleLayerIds store from the layers that were just added
        const newVisible = new Set(settingsStore.activeLayers);
        mapStore.visibleLayerIds = newVisible;

        // Load groups from payload
        const groupStore = useGroupStore(pinia);
        groupStore.setGroups(geoJSON.groups ?? []);
        // Drop any members referencing features that are not present in the
        // loaded data (e.g. from an older/edited payload).
        pruneDanglingGroupMembers();

        return true;
    };

    // ── loadMap ───────────────────────────────────────────────────────────────
    let mapInitialised = false;

    const loadMap = async (
        remoteMapFile: string | null,
        hash: string,
        hideToolbar: boolean,
        zoom: string | null,
        centre: number[] | null
    ): Promise<boolean> => {
        if (mapInitialised) {
            removeAllLayersFromMap();
            resetSettings();
        } else {
            // First load: add layers but don't call addLayersToMap yet (loadMapData does it)
            mapInitialised = true;
        }

        let geoJSON: SerializedMap | null = null;
        let errorIntro = '';
        let loadingFromStorage = false;
        let storageMapName = '';
        const errors: string[] = [];
        let mapLoaded = false;

        try {
            if (remoteMapFile) {
                errorIntro = 'There was a problem loading the map from the remote file location:';
                geoJSON = await fileManager.loadMapFromRemoteFile(remoteMapFile);
            } else if (hash !== '') {
                errorIntro = 'There was a problem loading the map from the hash:';
                geoJSON = fileManager.loadMapFromHash(hash.slice(1));
            } else {
                loadingFromStorage = true;
                errorIntro = 'There was a problem loading the map from browser storage:';
                const lastMapSelected = await fileManager.loadLastMapSelected();
                storageMapName = lastMapSelected || settingsStore.title;
                geoJSON = await fileManager.loadMapFromStorage(storageMapName);
            }

            errorIntro = 'There was a problem processing the map file:';
            mapLoaded = loadMapData(geoJSON, zoom, centre);
            if (mapLoaded) {
                lastSavedSnapshot = buildCurrentSnapshot();
                await activateHistory(settingsStore.title, { reset: false });
            }
        } catch (e: any) {
            errors.push(errorIntro);

            errors.push(getErrorMessage(e));
            const errorStack = getErrorStack(e);
            if (errorStack) {
                errors.push(errorStack);
            }
            let canDownloadStorageMap = false;
            if (loadingFromStorage && storageMapName !== '') {
                try {
                    canDownloadStorageMap = await fileManager.hasMapInStorage(storageMapName);
                } catch {
                    canDownloadStorageMap = false;
                }
            }

            uiStore.showErrors(errors, { showDownloadStorageLink: canDownloadStorageMap });
        }

        if (activeHistoryMapTitle === null) {
            lastSavedSnapshot = buildCurrentSnapshot();
            await activateHistory(settingsStore.title, { reset: false });
        }

        settingsStore.hideToolbar = hideToolbar;

        return mapLoaded;
    };

    // ── resetSettings ─────────────────────────────────────────────────────────
    const resetSettings = () => {
        settingsStore.readOnly = false;
        const allLayerIds = buildAllActiveLayerIds();
        settingsStore.activeLayers = allLayerIds;
        mapStore.visibleLayerIds = new Set(allLayerIds);
    };

    // ── applySettings ─────────────────────────────────────────────────────────
    const applySettings = async (newSettings: Settings) => {
        const previousTitle = settingsStore.title;
        const previousSettings = settingsStore.toSettings();
        const beforeSnapshot = buildCurrentSnapshot();
        if (activeHistoryMapTitle === null) {
            lastSavedSnapshot = beforeSnapshot;
            await activateHistory(settingsStore.title, { reset: false });
        } else {
            lastSavedSnapshot = beforeSnapshot;
        }

        pendingHistoryMutation = {
            kind: 'settings-apply',
            layerId: 'settings',
            payload: {
                before: {
                    title: previousSettings.title,
                    readOnly: previousSettings.readOnly,
                    hideToolbar: previousSettings.hideToolbar,
                    activeLayers: [...previousSettings.activeLayers],
                    centre: previousSettings.centre
                        ? {
                              lat: previousSettings.centre.lat,
                              lng: previousSettings.centre.lng
                          }
                        : null,
                    zoom: previousSettings.zoom,
                    version: previousSettings.version
                },
                after: {
                    title: newSettings.title,
                    readOnly: newSettings.readOnly,
                    hideToolbar: newSettings.hideToolbar,
                    activeLayers: [...newSettings.activeLayers],
                    centre: newSettings.centre
                        ? { lat: newSettings.centre.lat, lng: newSettings.centre.lng }
                        : null,
                    zoom: newSettings.zoom,
                    version: newSettings.version
                }
            }
        };

        settingsStore.applyFromSettings({
            title: newSettings.title,
            readOnly: newSettings.readOnly,
            hideToolbar: newSettings.hideToolbar,
            activeLayers: newSettings.activeLayers,
            centre: newSettings.centre,
            zoom: newSettings.zoom,
            version: newSettings.version
        });

        // Re-sync which layers are on the map
        removeAllLayersFromMap();
        addLayersToMap(newSettings.activeLayers);

        // Update visible ids to match newly active layers
        mapStore.visibleLayerIds = new Set(newSettings.activeLayers);

        await saveMapOrThrow();

        if (previousTitle !== settingsStore.title) {
            await undoJournal.renameHistory(previousTitle, settingsStore.title);
        }

        await activateHistory(settingsStore.title, { reset: false });
    };

    // ── createNewMap ──────────────────────────────────────────────────────────
    /**
     * Returns false if the title is already taken (caller shows an error).
     * Returns true on success.
     */
    const createNewMap = async (title: string): Promise<boolean> => {
        const existing = await fileManager.loadMapListFromStorage();
        if (existing.includes(title)) {
            return false;
        }

        clearAllLayers();

        const allLayerIds = buildAllActiveLayerIds();
        const newSettings = new Settings();
        newSettings.title = title;
        newSettings.readOnly = false;
        newSettings.activeLayers = allLayerIds;
        newSettings.zoom = settingsStore.zoom;
        newSettings.centre = settingsStore.centre ?? new L.LatLng(0, 0);

        settingsStore.applyFromSettings({
            title: newSettings.title,
            readOnly: newSettings.readOnly,
            hideToolbar: newSettings.hideToolbar,
            activeLayers: newSettings.activeLayers,
            centre: newSettings.centre,
            zoom: newSettings.zoom,
            version: newSettings.version
        });

        addLayersToMap(allLayerIds);
        mapStore.visibleLayerIds = new Set(allLayerIds);

        lastSavedSnapshot = buildCurrentSnapshot();
        await activateHistory(newSettings.title, { reset: true });
        await persistMap({ throwOnFailure: true, recordHistory: false });
        return true;
    };

    // ── loadMapFromStorage ────────────────────────────────────────────────────
    const loadMapFromStorage = async (mapName: string): Promise<boolean> => {
        clearAllLayers();
        resetSettings();

        const errors: string[] = [];
        try {
            const mapData = await fileManager.loadMapFromStorage(mapName);
            const ok = loadMapData(mapData, null, null);
            if (!ok) {
                const canDownloadStorageMap = await fileManager
                    .hasMapInStorage(mapName)
                    .catch(() => false);
                errors.push('There was a problem loading the map:');
                if (mapData === null) {
                    errors.push(
                        `Stored map "${mapName}" was not found. It may have been deleted in another tab.`
                    );
                } else {
                    errors.push(
                        `Stored map "${mapName}" could not be processed. It may be corrupted.`
                    );
                }

                uiStore.showErrors(errors, {
                    showDownloadStorageLink: canDownloadStorageMap
                });
                return false;
            }

            lastSavedSnapshot = buildCurrentSnapshot();
            await activateHistory(settingsStore.title, { reset: false });

            try {
                await persistMap({ throwOnFailure: true, recordHistory: false });
            } catch {
                return false;
            }

            return true;
        } catch (e: any) {
            errors.push('There was a problem loading the map:');
            errors.push(getErrorMessage(e));
            const errorStack = getErrorStack(e);
            if (errorStack) {
                errors.push(errorStack);
            }
            uiStore.showErrors(errors);
            return false;
        }
    };

    // ── Geolocation helpers ───────────────────────────────────────────────────
    const setUserLocation = (position: GeolocationPosition) => {
        getMap().setView([position.coords.latitude, position.coords.longitude], 17);
    };

    const setDefaultView = () => {
        getMap().setView([52.5, -1.9], 12);
    };

    // ── downloadStorageMap ────────────────────────────────────────────────────
    const downloadStorageMap = async () => {
        let storedMapRecord: unknown;

        try {
            const lastMapSelected = await fileManager.loadLastMapSelected();
            const mapName = lastMapSelected || settingsStore.title;
            storedMapRecord = await fileManager.loadRawMapFromStorage(mapName);
            if (storedMapRecord === null) {
                throw new Error(`Stored map "${mapName}" was not found.`);
            }
        } catch (e: any) {
            const errors = [
                'There was a problem loading the map from browser storage:',
                getErrorMessage(e)
            ];
            const errorStack = getErrorStack(e);
            if (errorStack) {
                errors.push(errorStack);
            }
            uiStore.showErrors(errors);
            return;
        }

        try {
            const mapString = JSON.stringify(storedMapRecord);
            const blob = new Blob([mapString], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            const url = URL.createObjectURL(blob);
            a.href = url;
            a.download = 'invalidMapData.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
        } catch (e: any) {
            const errors = ['There was a problem preparing the map download:', getErrorMessage(e)];
            const errorStack = getErrorStack(e);
            if (errorStack) {
                errors.push(errorStack);
            }
            uiStore.showErrors(errors);
        }
    };

    // ── Undo / redo area reveal ──────────────────────────────────────────────
    /**
     * Collect every geographic coordinate referenced by a history mutation
     * payload, regardless of its shape (point lat/lng, GeoJSON feature
     * geometry, edit coordinate lists, point-change pairs, batched features).
     * Returns the LatLngs so the affected area can be framed after undo/redo.
     */
    const collectLatLngsFromPayload = (payload: unknown): L.LatLng[] => {
        const latLngs: L.LatLng[] = [];

        const addLngLat = (lng: unknown, lat: unknown) => {
            if (
                typeof lng === 'number' &&
                typeof lat === 'number' &&
                Number.isFinite(lng) &&
                Number.isFinite(lat)
            ) {
                latLngs.push(new L.LatLng(lat, lng));
            }
        };

        // Walk arbitrarily-nested coordinate arrays whose leaves are [lng, lat].
        const walkCoordinates = (coords: unknown) => {
            if (!Array.isArray(coords)) {
                return;
            }
            if (
                coords.length === 2 &&
                typeof coords[0] === 'number' &&
                typeof coords[1] === 'number'
            ) {
                addLngLat(coords[0], coords[1]);
                return;
            }
            for (const child of coords) {
                walkCoordinates(child);
            }
        };

        const walk = (node: unknown) => {
            if (node == null || typeof node !== 'object') {
                return;
            }
            if (Array.isArray(node)) {
                for (const child of node) {
                    walk(child);
                }
                return;
            }

            const obj = node as Record<string, unknown>;

            // Bare { lat, lng } (point-add / point-delete).
            if (typeof obj.lat === 'number' && typeof obj.lng === 'number') {
                addLngLat(obj.lng, obj.lat);
            }

            // GeoJSON geometry coordinates (features / geometries).
            const geometry = obj.geometry as Record<string, unknown> | undefined;
            if (geometry && 'coordinates' in geometry) {
                walkCoordinates(geometry.coordinates);
            }
            if ('coordinates' in obj) {
                walkCoordinates(obj.coordinates);
            }

            // Edit payloads: coordinate-pair lists.
            if (Array.isArray(obj.beforeCoordinates)) {
                walkCoordinates(obj.beforeCoordinates);
            }
            if (Array.isArray(obj.afterCoordinates)) {
                walkCoordinates(obj.afterCoordinates);
            }
            if (Array.isArray(obj.pointChanges)) {
                for (const change of obj.pointChanges) {
                    if (change && typeof change === 'object') {
                        const c = change as Record<string, unknown>;
                        walkCoordinates(c.before);
                        walkCoordinates(c.after);
                    }
                }
            }

            // point-batch-delete: { points: [feature, ...] }.
            if (Array.isArray(obj.points)) {
                for (const point of obj.points) {
                    walk(point);
                }
            }

            // Nested before/after (whole features or objects).
            if (obj.before && typeof obj.before === 'object') {
                walk(obj.before);
            }
            if (obj.after && typeof obj.after === 'object') {
                walk(obj.after);
            }
        };

        walk(payload);
        return latLngs;
    };

    /**
     * Ensure the given bounds are within the current viewport; if not, move the
     * map so the affected area becomes visible. Preserves the current zoom when
     * the area fits at that zoom (pans only); otherwise zooms out to fit.
     */
    const ensureBoundsVisible = (bounds: L.LatLngBounds) => {
        const map = getMap();
        const viewport = map.getBounds();
        if (viewport.contains(bounds)) {
            return;
        }

        const viewLatSpan = viewport.getNorth() - viewport.getSouth();
        const viewLngSpan = viewport.getEast() - viewport.getWest();
        const boundsLatSpan = bounds.getNorth() - bounds.getSouth();
        const boundsLngSpan = bounds.getEast() - bounds.getWest();

        if (boundsLatSpan <= viewLatSpan && boundsLngSpan <= viewLngSpan) {
            // Fits at the current zoom — just pan to centre it.
            map.panTo(bounds.getCenter());
        } else {
            // Larger than the viewport — zoom out to fit the whole change.
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    };

    /**
     * After an undo/redo, move the map to reveal the affected area if it lies
     * outside the current viewport. No-op when the mutation carries no
     * geographic coordinates (e.g. settings-only changes or snapshot fallback).
     */
    const revealMutationArea = (replay: HistoryReplayEntry) => {
        const latLngs = collectLatLngsFromPayload(replay.entry.mutationPayload);
        if (latLngs.length === 0) {
            return;
        }
        ensureBoundsVisible(L.latLngBounds(latLngs));
    };

    const undo = async (): Promise<boolean> => {
        if (!activeHistoryMapTitle) {
            return false;
        }

        const replay = await undoJournal.undoEntry(activeHistoryMapTitle);
        if (!replay) {
            await syncHistoryStatus();
            return false;
        }

        const ok = await applyHistoryReplay(replay);
        if (ok) {
            revealMutationArea(replay);
        }
        await syncHistoryStatus();
        return ok;
    };

    const redo = async (): Promise<boolean> => {
        if (!activeHistoryMapTitle) {
            return false;
        }

        const replay = await undoJournal.redoEntry(activeHistoryMapTitle);
        if (!replay) {
            await syncHistoryStatus();
            return false;
        }

        const ok = await applyHistoryReplay(replay);
        if (ok) {
            revealMutationArea(replay);
        }
        await syncHistoryStatus();
        return ok;
    };

    // ── Wire event bridges (replaces PubSub subscriptions) ───────────────────

    // fileLoaded: FileManager calls this callback when a file is loaded via OS picker.
    fileManager.setOnFileLoaded((data: unknown) => {
        uiStore.closePanel();
        clearAllLayers();
        resetSettings();

        const errors: string[] = [];
        try {
            const ok = loadMapData(data as SerializedMap | null, null, null);
            if (ok) {
                void saveMap();
            }
        } catch (e: any) {
            errors.push('There was a problem loading the map from uploaded file:');
            errors.push(getErrorMessage(e));
            const errorStack = getErrorStack(e);
            if (errorStack) {
                errors.push(errorStack);
            }
            uiStore.showErrors(errors);
        }
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
        downloadStorageMap,
        runViewCheckpointMigration
    };

    return _instance;
}
