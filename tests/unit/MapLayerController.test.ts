import { describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { MapLayerController } from '../../src/features/map/MapLayerController';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

function makeLayer(id: string): IMapLayer & { clearCount: number; loaded: unknown[] } {
    const state = { clearCount: 0, loaded: [] as unknown[] };
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
        loadFromGeoJSON: (geoJson) => state.loaded.push(geoJson),
        getLayer: () => geoJsonLayer,
        toGeoJSON: () => ({}),
        clearLayer: () => {
            state.clearCount++;
        },
        get clearCount() {
            return state.clearCount;
        },
        get loaded() {
            return state.loaded;
        }
    };
}

describe('MapLayerController', () => {
    it('adds only active layers and marks them visible', () => {
        const map = new L.Map();
        const layers = [makeLayer('ModalFilters'), makeLayer('MobilityLanes')];
        const addLayer = vi.spyOn(map, 'addLayer');
        const controller = new MapLayerController({ getMap: () => map, getLayers: () => layers });

        controller.addLayers(['MobilityLanes']);

        expect(layers[0].visible).toBe(false);
        expect(layers[1].visible).toBe(true);
        expect(addLayer).toHaveBeenCalledOnce();
    });

    it('loads legacy layer keys and synchronizes map membership', () => {
        const map = new L.Map();
        const layers = [makeLayer('ModalFilters'), makeLayer('MobilityLanes')];
        const addLayer = vi.spyOn(map, 'addLayer');
        const removeLayer = vi.spyOn(map, 'removeLayer');
        const controller = new MapLayerController({ getMap: () => map, getLayers: () => layers });
        const legacyModals = { type: 'FeatureCollection', features: [] };
        const legacyCycleLanes = { type: 'FeatureCollection', features: [] };

        controller.loadLayers({ Modals: legacyModals, CycleLanes: legacyCycleLanes }, [
            'ModalFilters'
        ]);

        expect(layers[0].loaded).toEqual([legacyModals]);
        expect(layers[1].loaded).toEqual([legacyCycleLanes]);
        expect(addLayer).toHaveBeenCalledOnce();
        expect(removeLayer).toHaveBeenCalledOnce();
        expect(layers[1].visible).toBe(false);
    });

    it('clears layer data and removes every layer from the map', () => {
        const map = new L.Map();
        const layers = [makeLayer('a'), makeLayer('b')];
        const removeLayer = vi.spyOn(map, 'removeLayer');
        const controller = new MapLayerController({ getMap: () => map, getLayers: () => layers });

        controller.clearAllLayers();

        expect(layers.map((layer) => layer.clearCount)).toEqual([1, 1]);
        expect(removeLayer).toHaveBeenCalledTimes(2);
        expect(layers.every((layer) => !layer.visible)).toBe(true);
    });

    it('removes every layer and marks it hidden', () => {
        const map = new L.Map();
        const layers = [makeLayer('a'), makeLayer('b')];
        layers.forEach((layer) => (layer.visible = true));
        const removeLayer = vi.spyOn(map, 'removeLayer');
        const controller = new MapLayerController({ getMap: () => map, getLayers: () => layers });

        controller.removeAllLayers();

        expect(removeLayer).toHaveBeenCalledTimes(2);
        expect(layers.every((layer) => !layer.visible)).toBe(true);
    });
});
