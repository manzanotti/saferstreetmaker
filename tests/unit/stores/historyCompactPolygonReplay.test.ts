import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../../src/stores/index';
import { useGroupStore } from '../../../src/stores/groupStore';
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

function makePolygonFeature(
    coordinates: number[][][],
    options?: { historyId?: string; label?: string; color?: string }
) {
    return {
        type: 'Feature',
        properties: {
            historyId: options?.historyId ?? 'polygon-1',
            label: options?.label ?? 'LTN 1',
            color: options?.color ?? '#cc00cc'
        },
        geometry: {
            type: 'Polygon',
            coordinates: cloneValue(coordinates)
        }
    };
}

function makeSerializedMap(
    coordinates: number[][][],
    options?: { historyId?: string; label?: string; color?: string }
): SerializedMap {
    return {
        settings: {
            title: 'Hello Cleveland',
            readOnly: false,
            hideToolbar: false,
            activeLayers: ['LtnCells'],
            centre: { lat: 52.5, lng: -1.9 },
            zoom: 12,
            version: '0.9.0'
        },
        layers: {
            LtnCells: {
                type: 'FeatureCollection',
                features: [makePolygonFeature(coordinates, options)]
            }
        }
    };
}

function createFakeLtnLayer(initialCoordinates: number[][][]): IMapLayer & {
    getState: () => { type: 'FeatureCollection'; features: unknown[] };
} {
    let featureCollection = {
        type: 'FeatureCollection' as const,
        features: [makePolygonFeature(initialCoordinates)]
    };

    const geoJsonLayer = {
        clearLayers() {
            featureCollection = { type: 'FeatureCollection', features: [] };
        }
    } as unknown as L.GeoJSON;

    return {
        id: 'LtnCells',
        title: 'LTN Cells',
        selected: false,
        visible: true,
        groupName: '',
        iconHtml: '',
        getToolbarButton: () => ({
            id: 'ltn',
            tooltip: '',
            selected: false,
            groupName: '',
            action: () => {},
            text: 'LTN'
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

describe('useMapManager compact polygon replay', () => {
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
        settingsStore.activeLayers = ['LtnCells'];
        settingsStore.centre = new L.LatLng(52.5, -1.9) as unknown as L.LatLng;
        settingsStore.zoom = 12;
        settingsStore.version = '0.9.0';

        useGroupStore(pinia).setGroups([]);

        await journal.clearHistory('Hello Cleveland');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('undoes and redoes a compact polygon-edit history entry by historyId', async () => {
        const beforeCoordinates = [
            [
                [-1.9, 52.5],
                [-1.8, 52.5],
                [-1.8, 52.6],
                [-1.9, 52.5]
            ]
        ];
        const afterCoordinates = [
            [
                [-1.9, 52.5],
                [-1.7, 52.5],
                [-1.7, 52.7],
                [-1.9, 52.5]
            ]
        ];

        const layer = createFakeLtnLayer(afterCoordinates);
        const mapStore = useMapStore(pinia);
        mapStore.setLayers([layer]);
        const groups = [
            {
                id: 'group-1',
                name: 'LTN group',
                members: [{ layerId: 'LtnCells', historyId: 'polygon-1' }]
            }
        ];
        useGroupStore(pinia).setGroups(groups);

        await journal.recordCheckpoint(
            'Hello Cleveland',
            makeSerializedMap(beforeCoordinates, { label: 'LTN 1', color: '#cc00cc' }),
            makeSerializedMap(afterCoordinates, { label: 'LTN 2', color: '#00aa00' }),
            'checkpoint',
            {
                kind: 'polygon-edit',
                layerId: 'LtnCells',
                payload: {
                    historyId: 'polygon-1',
                    pointChanges: [
                        {
                            type: 'update',
                            ringIndex: 0,
                            pointIndex: 1,
                            before: beforeCoordinates[0][1],
                            after: afterCoordinates[0][1]
                        },
                        {
                            type: 'update',
                            ringIndex: 0,
                            pointIndex: 2,
                            before: beforeCoordinates[0][2],
                            after: afterCoordinates[0][2]
                        }
                    ],
                    beforeLabel: 'LTN 1',
                    afterLabel: 'LTN 2',
                    beforeColor: '#cc00cc',
                    afterColor: '#00aa00'
                }
            }
        );

        await expect(mapManager.undo()).resolves.toBe(true);
        expect(vi.mocked(fileManager.saveMap).mock.calls.at(-1)?.[2]).toEqual(groups);
        expect(layer.getState().features[0]).toMatchObject({
            geometry: {
                coordinates: beforeCoordinates
            },
            properties: {
                historyId: 'polygon-1',
                label: 'LTN 1',
                color: '#cc00cc'
            }
        });

        await expect(mapManager.redo()).resolves.toBe(true);
        expect(layer.getState().features[0]).toMatchObject({
            geometry: {
                coordinates: afterCoordinates
            },
            properties: {
                historyId: 'polygon-1',
                label: 'LTN 2',
                color: '#00aa00'
            }
        });
    });

    it('undoes and redoes a polygon vertex insertion by historyId', async () => {
        const beforeCoordinates = [
            [
                [-1.9, 52.5],
                [-1.8, 52.5],
                [-1.8, 52.6],
                [-1.9, 52.5]
            ]
        ];
        const afterCoordinates = [
            [
                [-1.9, 52.5],
                [-1.8, 52.5],
                [-1.8, 52.6],
                [-1.9, 52.6],
                [-1.9, 52.5]
            ]
        ];

        const layer = createFakeLtnLayer(afterCoordinates);
        const mapStore = useMapStore(pinia);
        mapStore.setLayers([layer]);

        await journal.recordCheckpoint(
            'Hello Cleveland',
            makeSerializedMap(beforeCoordinates, { label: 'LTN 1', color: '#cc00cc' }),
            makeSerializedMap(afterCoordinates, { label: 'LTN 2', color: '#00aa00' }),
            'checkpoint',
            {
                kind: 'polygon-edit',
                layerId: 'LtnCells',
                payload: {
                    historyId: 'polygon-1',
                    pointChanges: [
                        {
                            type: 'insert',
                            ringIndex: 0,
                            pointIndex: 3,
                            after: afterCoordinates[0][3]
                        }
                    ],
                    beforeLabel: 'LTN 1',
                    afterLabel: 'LTN 2',
                    beforeColor: '#cc00cc',
                    afterColor: '#00aa00'
                }
            }
        );

        await expect(mapManager.undo()).resolves.toBe(true);
        expect(layer.getState().features[0]).toMatchObject({
            geometry: {
                coordinates: beforeCoordinates
            },
            properties: {
                label: 'LTN 1',
                color: '#cc00cc'
            }
        });

        await expect(mapManager.redo()).resolves.toBe(true);
        expect(layer.getState().features[0]).toMatchObject({
            geometry: {
                coordinates: afterCoordinates
            },
            properties: {
                label: 'LTN 2',
                color: '#00aa00'
            }
        });
    });
});
