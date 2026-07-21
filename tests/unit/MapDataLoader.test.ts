import { describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { MapDataLoader } from '../../src/features/map/MapDataLoader';
import { MapLayerController } from '../../src/features/map/MapLayerController';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';
import type { SerializedMap } from '../../src/services/MapSerializer';

function makeLayer(id: string): IMapLayer {
    const geoJsonLayer = new L.GeoJSON();
    return {
        id,
        title: id,
        selected: false,
        visible: false,
        groupName: '',
        kind: 'point',
        iconHtml: '',
        getToolbarButton: () => ({
            id,
            tooltip: '',
            selected: false,
            groupName: '',
            action: () => {}
        }),
        getLegendEntry: () => document.createElement('li'),
        loadFromGeoJSON: vi.fn(),
        getLayer: () => geoJsonLayer,
        toGeoJSON: () => ({}),
        clearLayer: vi.fn()
    };
}

function makeLoader(settings: { centre: L.LatLng | null; zoom: number; activeLayers: string[] }) {
    const map = new L.Map();
    const layers = [makeLayer('ModalFilters'), makeLayer('MobilityLanes')];
    const mapLayerController = new MapLayerController({
        getMap: () => map,
        getLayers: () => layers
    });
    const appliedSettings: unknown[] = [];
    const visibleLayerIds: Set<string>[] = [];
    const groups: unknown[] = [];
    const loader = new MapDataLoader({
        getMap: () => map,
        setDefaultView: vi.fn(),
        mapLayerController,
        setTitle: vi.fn(),
        applySettings: (value) => {
            appliedSettings.push(value);
            settings.centre = value.centre;
            settings.zoom = value.zoom;
            settings.activeLayers = value.activeLayers;
        },
        setCentre: (value) => {
            settings.centre = value;
        },
        setZoom: (value) => {
            settings.zoom = value;
        },
        getCentre: () => settings.centre,
        getZoom: () => settings.zoom,
        setVersion: vi.fn(),
        getActiveLayerIds: () => settings.activeLayers,
        setVisibleLayerIds: (value) => visibleLayerIds.push(value),
        setGroups: (value) => groups.push(value),
        setAllGroupsHidden: vi.fn(),
        resetGroupVisibility: vi.fn(),
        pruneDanglingGroupMembers: vi.fn(),
        appVersion: '0.9.0'
    });

    return { loader, settings, appliedSettings, visibleLayerIds, groups };
}

describe('MapDataLoader', () => {
    it('applies serialized settings and synchronizes active layer IDs', () => {
        const state = makeLoader({ centre: null, zoom: 0, activeLayers: [] });
        const data: SerializedMap = {
            settings: {
                title: 'Loaded map',
                readOnly: true,
                hideToolbar: false,
                activeLayers: ['MobilityLanes'],
                centre: { lat: 52.5, lng: -1.9 },
                zoom: 12,
                version: '0.8.0'
            },
            layers: {}
        };

        expect(state.loader.load(data, null, null)).toBe(true);
        expect(state.appliedSettings[0]).toMatchObject({
            title: 'Loaded map',
            readOnly: true,
            activeLayers: ['MobilityLanes']
        });
        expect(state.visibleLayerIds[0]).toEqual(new Set(['MobilityLanes']));
    });

    it('preserves legacy view state when only zoom is overridden by the URL', () => {
        const state = makeLoader({
            centre: null,
            zoom: 0,
            activeLayers: ['ModalFilters']
        });
        const map = new L.Map();
        const setView = vi.spyOn(map, 'setView');
        const legacyData: SerializedMap = {
            centre: { lat: 51.5, lng: -0.1 },
            zoom: 11,
            layers: {}
        };
        const loader = new MapDataLoader({
            getMap: () => map,
            setDefaultView: vi.fn(),
            mapLayerController: new MapLayerController({
                getMap: () => map,
                getLayers: () => []
            }),
            setTitle: vi.fn(),
            applySettings: vi.fn(),
            setCentre: (value) => {
                state.settings.centre = value;
            },
            setZoom: (value) => {
                state.settings.zoom = value;
            },
            getCentre: () => state.settings.centre,
            getZoom: () => state.settings.zoom,
            setVersion: vi.fn(),
            getActiveLayerIds: () => state.settings.activeLayers,
            setVisibleLayerIds: vi.fn(),
            setGroups: vi.fn(),
            setAllGroupsHidden: vi.fn(),
            resetGroupVisibility: vi.fn(),
            pruneDanglingGroupMembers: vi.fn(),
            appVersion: '0.9.0'
        });

        loader.load(legacyData, '13', null);

        expect(state.settings.centre).toMatchObject({ lat: 51.5, lng: -0.1 });
        expect(state.settings.zoom).toBe(13);
        expect(setView).toHaveBeenCalledWith([51.5, -0.1], 13);
    });
});
