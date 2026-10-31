/**
 * Shared layer and loader factories for the MapDataLoader unit tests.
 */
import { vi } from 'vitest';
import * as L from 'leaflet';
import { MapDataLoader } from '../../src/features/map/MapDataLoader';
import { MapLayerController } from '../../src/features/map/MapLayerController';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';

export function makeLayer(id: string): IMapLayer {
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

export function makeLoader(settings: {
    centre: L.LatLng | null;
    zoom: number;
    activeLayers: string[];
}) {
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
        appVersion: '0.11.0'
    });

    return { loader, settings, appliedSettings, visibleLayerIds, groups };
}
