/**
 * Tests for loadMapData in useMapManager — groups loaded from a SerializedMap.
 */
import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { useGroupStore } from '../../../src/stores/groupStore';
import { setupMapManager } from '../../../src/composables/useMapManager';
import { FileManager } from '../../../src/services/FileManager';
import type { SerializedMap } from '../../../src/services/MapSerializer';

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Groups persistence
// ---------------------------------------------------------------------------

describe('useMapManager – groups loaded from SerializedMap', () => {
    let fm: FileManager;
    let mapManager: ReturnType<typeof setupMapManager>;

    beforeAll(() => {
        setActivePinia(pinia);
        fm = new FileManager();
        vi.spyOn(fm, 'saveMap').mockImplementation(() => {});

        const mapStore = useMapStore(pinia);
        mapStore.setMap(new L.Map() as unknown as L.Map);
        mapManager = setupMapManager(fm);
    });

    beforeEach(() => {
        setActivePinia(pinia);
        vi.useFakeTimers();
        vi.spyOn(fm, 'saveMap').mockImplementation(() => {});
        useGroupStore(pinia).setGroups([]);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('populates groupStore from groups in the serialized map', async () => {
        // Register a stub ModalFilters layer that reports an existing 'h1'
        // feature so the group member is not pruned as dangling on load.
        const h1Marker = { feature: { properties: { historyId: 'h1' } } };
        const stubLayer = {
            id: 'ModalFilters',
            title: 'ModalFilters',
            kind: 'point',
            visible: true,
            loadFromGeoJSON: vi.fn(),
            clearLayer: vi.fn(),
            getLayer: () => ({
                eachLayer: (fn: (m: any) => void) => fn(h1Marker),
                addLayer: vi.fn(),
                removeLayer: vi.fn(),
                clearLayers: vi.fn()
            }),
            toGeoJSON: () => ({ type: 'FeatureCollection', features: [] })
        } as any;
        useMapStore(pinia).setLayers([stubLayer]);

        const serialized: SerializedMap = {
            settings: {
                title: 'Test',
                readOnly: false,
                hideToolbar: false,
                activeLayers: [],
                centre: null,
                zoom: 12,
                version: '0.9.0'
            },
            layers: {},
            groups: [
                {
                    id: 'g1',
                    name: 'Zone A',
                    members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
                }
            ]
        };

        vi.spyOn(fm, 'loadMapFromStorage').mockReturnValue(serialized);
        vi.spyOn(fm, 'loadLastMapSelected').mockReturnValue('Test');

        await mapManager.loadMap(null, '', false, null, null);

        const groupStore = useGroupStore(pinia);
        expect(groupStore.groups).toHaveLength(1);
        expect(groupStore.groups[0].name).toBe('Zone A');
        expect(groupStore.groups[0].members[0].historyId).toBe('h1');
    });

    it('hides inactive version members after loading a serialized map', async () => {
        const defaultMarker = {
            feature: { properties: { historyId: 'default-feature' } },
            options: { opacity: 0.7, fillOpacity: 0.4 },
            setStyle: vi.fn(function (style: Record<string, number>) {
                Object.assign(this.options, style);
            })
        };
        const alternativeMarker = {
            feature: { properties: { historyId: 'alternative-feature' } },
            options: { opacity: 0.7, fillOpacity: 0.4 },
            setStyle: vi.fn(function (style: Record<string, number>) {
                Object.assign(this.options, style);
            })
        };
        const stubLayer = {
            id: 'ModalFilters',
            title: 'ModalFilters',
            kind: 'point',
            visible: true,
            loadFromGeoJSON: vi.fn(),
            clearLayer: vi.fn(),
            getLayer: () => ({
                eachLayer: (fn: (marker: unknown) => void) => {
                    fn(defaultMarker);
                    fn(alternativeMarker);
                },
                addLayer: vi.fn(),
                removeLayer: vi.fn(),
                clearLayers: vi.fn()
            }),
            toGeoJSON: () => ({ type: 'FeatureCollection', features: [] })
        } as any;
        useMapStore(pinia).setLayers([stubLayer]);

        const serialized: SerializedMap = {
            settings: {
                title: 'Versioned Map',
                readOnly: false,
                hideToolbar: false,
                activeLayers: [],
                centre: null,
                zoom: 12,
                version: '0.9.0'
            },
            layers: {},
            groups: [
                {
                    id: 'g1',
                    name: 'Zone A',
                    defaultVersionId: 'v-default',
                    versions: [
                        {
                            id: 'v-default',
                            name: 'Default',
                            members: [{ layerId: 'ModalFilters', historyId: 'default-feature' }]
                        },
                        {
                            id: 'v-alternative',
                            name: 'Alternative',
                            members: [{ layerId: 'ModalFilters', historyId: 'alternative-feature' }]
                        }
                    ]
                }
            ]
        };

        vi.spyOn(fm, 'loadMapFromStorage').mockReturnValue(serialized);
        vi.spyOn(fm, 'loadLastMapSelected').mockReturnValue('Versioned Map');

        await mapManager.loadMap(null, '', false, null, null);

        expect(defaultMarker.options.opacity).toBe(0.7);
        expect(alternativeMarker.options.opacity).toBe(0);
        expect(alternativeMarker.options.fillOpacity).toBe(0);
    });

    it('prunes group members whose feature is absent from the loaded map', async () => {
        useMapStore(pinia).setLayers([]);

        const serialized: SerializedMap = {
            settings: {
                title: 'Dangling',
                readOnly: false,
                hideToolbar: false,
                activeLayers: [],
                centre: null,
                zoom: 12,
                version: '0.9.0'
            },
            layers: {},
            groups: [
                {
                    id: 'g1',
                    name: 'Zone A',
                    members: [{ layerId: 'ModalFilters', historyId: 'ghost' }]
                }
            ]
        };

        vi.spyOn(fm, 'loadMapFromStorage').mockReturnValue(serialized);
        vi.spyOn(fm, 'loadLastMapSelected').mockReturnValue('Dangling');

        await mapManager.loadMap(null, '', false, null, null);

        const groupStore = useGroupStore(pinia);
        expect(groupStore.groups).toHaveLength(1);
        expect(groupStore.groups[0].members).toHaveLength(0);
    });

    it('clears groups when loading a map without groups', async () => {
        // Pre-populate groups.
        useGroupStore(pinia).addGroup({ id: 'g1', name: 'Old', members: [] });

        const serialized: SerializedMap = {
            settings: {
                title: 'Clean Map',
                readOnly: false,
                hideToolbar: false,
                activeLayers: [],
                centre: null,
                zoom: 12,
                version: '0.9.0'
            },
            layers: {}
        };

        vi.spyOn(fm, 'loadMapFromStorage').mockReturnValue(serialized);
        vi.spyOn(fm, 'loadLastMapSelected').mockReturnValue('Clean Map');

        await mapManager.loadMap(null, '', false, null, null);

        expect(useGroupStore(pinia).groups).toHaveLength(0);
    });
});
