import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia } from 'pinia';
import { pinia } from '../../src/stores';
import { useImportedLayerStore } from '../../src/stores/importedLayerStore';
import type { ImportedGeoJsonLayer } from '../../src/models/ImportedGeoJsonLayer';

function makeLayer(): ImportedGeoJsonLayer {
    return {
        id: 'wards',
        name: 'Wards',
        nameProperty: 'name',
        featureCollection: {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: null,
                    geometry: {
                        type: 'Point',
                        coordinates: [-1.9, 52.5]
                    }
                }
            ]
        }
    };
}

describe('importedLayerStore', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        useImportedLayerStore(pinia).clear();
    });

    it('creates feature properties when updating a feature with null properties', () => {
        const store = useImportedLayerStore();
        store.setLayers([makeLayer()]);

        store.updateFeatureProperty('wards', 0, 'name', 'Ward 1');

        expect(store.layers[0].featureCollection.features[0].properties).toEqual({
            name: 'Ward 1'
        });
    });

    it('clones layers on setLayers so callers cannot mutate stored state', () => {
        const store = useImportedLayerStore();
        const source = makeLayer();

        store.setLayers([source]);
        source.name = 'Mutated';
        source.featureCollection.features[0].properties = { name: 'Mutated' };

        expect(store.layers[0].name).toBe('Wards');
        expect(store.layers[0].featureCollection).not.toBe(source.featureCollection);
        expect(store.layers[0].featureCollection.features[0].properties).toBeNull();
    });

    it('defaults visibility to true when it is not specified', () => {
        const store = useImportedLayerStore();

        store.setLayers([makeLayer()]);

        expect(store.layers[0].visible).toBe(true);
    });

    it('clones layers on addLayer and appends them in order', () => {
        const store = useImportedLayerStore();
        const second = { ...makeLayer(), id: 'second', name: 'Second' };

        store.setLayers([makeLayer()]);
        store.addLayer(second);
        second.name = 'Mutated';

        expect(store.layers.map((layer) => layer.id)).toEqual(['wards', 'second']);
        expect(store.layers[1].name).toBe('Second');
    });

    it('deletes only the requested layer', () => {
        const store = useImportedLayerStore();
        store.setLayers([makeLayer(), { ...makeLayer(), id: 'second', name: 'Second' }]);

        store.deleteLayer('wards');

        expect(store.layers.map((layer) => layer.id)).toEqual(['second']);
    });

    it('ignores deletes, renames and property changes for unknown ids', () => {
        const store = useImportedLayerStore();
        store.setLayers([makeLayer()]);

        store.deleteLayer('missing');
        store.renameLayer('missing', 'Nope');
        store.setNameProperty('missing', 'nope');
        store.toggleVisibility('missing');
        store.updateFeatureProperty('missing', 0, 'name', 'Nope');

        expect(store.layers).toHaveLength(1);
        expect(store.layers[0].name).toBe('Wards');
        expect(store.layers[0].nameProperty).toBe('name');
    });

    it('toggles visibility between hidden and visible', () => {
        const store = useImportedLayerStore();
        store.setLayers([makeLayer()]);

        store.toggleVisibility('wards');
        expect(store.layers[0].visible).toBe(false);

        store.toggleVisibility('wards');
        expect(store.layers[0].visible).toBe(true);
    });

    it('renames a layer and updates its name property', () => {
        const store = useImportedLayerStore();
        store.setLayers([makeLayer()]);

        store.renameLayer('wards', 'Renamed');
        store.setNameProperty('wards', 'ward_name');

        expect(store.layers[0].name).toBe('Renamed');
        expect(store.layers[0].nameProperty).toBe('ward_name');

        store.setNameProperty('wards', null);
        expect(store.layers[0].nameProperty).toBeNull();
    });

    it('ignores feature property updates for an out-of-range feature index', () => {
        const store = useImportedLayerStore();
        store.setLayers([makeLayer()]);

        store.updateFeatureProperty('wards', 5, 'name', 'Ward 5');

        expect(store.layers[0].featureCollection.features).toHaveLength(1);
        expect(store.layers[0].featureCollection.features[0].properties).toBeNull();
    });

    it('clears every layer', () => {
        const store = useImportedLayerStore();
        store.setLayers([makeLayer(), { ...makeLayer(), id: 'second' }]);

        store.clear();

        expect(store.layers).toEqual([]);
    });
});
