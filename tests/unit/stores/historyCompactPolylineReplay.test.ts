import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { setupMapManager } from '../../../src/composables/useMapManager';
import type { IMapLayer } from '../../../src/composables/layers/IMapLayer';
import { FileManager } from '../../../src/services/FileManager';
import type { SerializedMap } from '../../../src/services/MapSerializer';
import { UndoJournal } from '../../../src/services/UndoJournal';

function cloneValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function makePolylineFeature(coordinates: number[][], historyId = 'polyline-1') {
    return {
        type: 'Feature',
        properties: { historyId },
        geometry: {
            type: 'LineString',
            coordinates: cloneValue(coordinates)
        }
    };
}

function makeSerializedMap(coordinates: number[][], historyId = 'polyline-1'): SerializedMap {
    return {
        settings: {
            title: 'Hello Cleveland',
            readOnly: false,
            hideToolbar: false,
            activeLayers: ['MobilityLanes'],
            centre: { lat: 52.5, lng: -1.9 },
            zoom: 12,
            version: '0.9.0'
        },
        layers: {
            MobilityLanes: {
                type: 'FeatureCollection',
                features: [makePolylineFeature(coordinates, historyId)]
            }
        }
    };
}

function createFakeMobilityLayer(initialCoordinates: number[][]): IMapLayer & {
    getState: () => { type: 'FeatureCollection'; features: unknown[] };
} {
    let featureCollection = {
        type: 'FeatureCollection' as const,
        features: [makePolylineFeature(initialCoordinates)]
    };

    const geoJsonLayer = {
        clearLayers() {
            featureCollection = { type: 'FeatureCollection', features: [] };
        }
    } as unknown as L.GeoJSON;

    return {
        id: 'MobilityLanes',
        title: 'Mobility Lanes',
        selected: false,
        visible: true,
        groupName: '',
        iconHtml: '',
        getToolbarButton: () => ({
            id: 'mobility-lane',
            tooltip: '',
            selected: false,
            groupName: '',
            action: () => {}
        }),
        getLegendEntry: () => document.createElement('li'),
        loadFromGeoJSON(geoJson: L.GeoJSON) {
            featureCollection = cloneValue(geoJson as unknown as typeof featureCollection);
        },
        getLayer() {
            return geoJsonLayer;
        },
        toGeoJSON() {
            return cloneValue(featureCollection);
        },
        clearLayer() {
            featureCollection = { type: 'FeatureCollection', features: [] };
        },
        getState() {
            return cloneValue(featureCollection);
        }
    };
}

describe('useMapManager compact polyline replay', () => {
    let fileManager: FileManager;
    let mapManager: ReturnType<typeof setupMapManager>;
    let journal: UndoJournal;

    beforeAll(() => {
        setActivePinia(pinia);
        fileManager = new FileManager();

        const mapStore = useMapStore(pinia);
        mapStore.setMap(new L.Map() as unknown as L.Map);

        mapManager = setupMapManager(fileManager);
        journal = new UndoJournal();
    });

    beforeEach(async () => {
        setActivePinia(pinia);
        vi.spyOn(fileManager, 'saveMap').mockResolvedValue();

        const settingsStore = useSettingsStore(pinia);
        settingsStore.title = 'Hello Cleveland';
        settingsStore.readOnly = false;
        settingsStore.hideToolbar = false;
        settingsStore.activeLayers = ['MobilityLanes'];
        settingsStore.centre = new L.LatLng(52.5, -1.9) as unknown as L.LatLng;
        settingsStore.zoom = 12;
        settingsStore.version = '0.9.0';

        await journal.clearHistory('Hello Cleveland');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('undoes and redoes a compact polyline-edit history entry by historyId', async () => {
        const beforeCoordinates = [
            [-1.9, 52.5],
            [-1.8, 52.6]
        ];
        const afterCoordinates = [
            [-1.9, 52.5],
            [-1.7, 52.7]
        ];

        const layer = createFakeMobilityLayer(afterCoordinates);
        const mapStore = useMapStore(pinia);
        mapStore.setLayers([layer]);

        await journal.recordCheckpoint(
            'Hello Cleveland',
            makeSerializedMap(beforeCoordinates),
            makeSerializedMap(afterCoordinates),
            'checkpoint',
            {
                kind: 'polyline-edit',
                layerId: 'MobilityLanes',
                payload: {
                    historyId: 'polyline-1',
                    pointChanges: [
                        {
                            type: 'update',
                            index: 1,
                            before: beforeCoordinates[1],
                            after: afterCoordinates[1]
                        }
                    ]
                }
            }
        );

        await expect(mapManager.undo()).resolves.toBe(true);
        expect(layer.getState().features[0]).toMatchObject({
            geometry: {
                coordinates: beforeCoordinates
            },
            properties: {
                historyId: 'polyline-1'
            }
        });

        await expect(mapManager.redo()).resolves.toBe(true);
        expect(layer.getState().features[0]).toMatchObject({
            geometry: {
                coordinates: afterCoordinates
            },
            properties: {
                historyId: 'polyline-1'
            }
        });
    });

    it('undoes and redoes a polyline vertex insertion by historyId', async () => {
        const beforeCoordinates = [
            [-1.9, 52.5],
            [-1.7, 52.7]
        ];
        const afterCoordinates = [
            [-1.9, 52.5],
            [-1.8, 52.6],
            [-1.7, 52.7]
        ];

        const layer = createFakeMobilityLayer(afterCoordinates);
        const mapStore = useMapStore(pinia);
        mapStore.setLayers([layer]);

        await journal.recordCheckpoint(
            'Hello Cleveland',
            makeSerializedMap(beforeCoordinates),
            makeSerializedMap(afterCoordinates),
            'checkpoint',
            {
                kind: 'polyline-edit',
                layerId: 'MobilityLanes',
                payload: {
                    historyId: 'polyline-1',
                    pointChanges: [
                        {
                            type: 'insert',
                            index: 1,
                            after: afterCoordinates[1]
                        }
                    ]
                }
            }
        );

        await expect(mapManager.undo()).resolves.toBe(true);
        expect(layer.getState().features[0]).toMatchObject({
            geometry: {
                coordinates: beforeCoordinates
            }
        });

        await expect(mapManager.redo()).resolves.toBe(true);
        expect(layer.getState().features[0]).toMatchObject({
            geometry: {
                coordinates: afterCoordinates
            }
        });
    });
});
