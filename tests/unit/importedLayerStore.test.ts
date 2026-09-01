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
});
