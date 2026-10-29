import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useImportedLayerStore } from '../../src/stores/importedLayerStore';
import { useImportedLayerItems } from '../../src/composables/layers/useImportedLayerItems';
import type { ImportedGeoJsonLayer } from '../../src/models/ImportedGeoJsonLayer';

function layer(id = 'wards'): ImportedGeoJsonLayer {
    return {
        id,
        name: 'Wards',
        nameProperty: 'name',
        featureCollection: {
            type: 'FeatureCollection',
            features: ['Alpha', 'Beta', 'Alpha', '', '  ', undefined].map((name) => ({
                type: 'Feature',
                properties: name === undefined ? null : { name },
                geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
            }))
        }
    };
}

describe('Imported layer items', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('lists only named items and searches trimmed, case-insensitive names without merging duplicates', () => {
        const store = useImportedLayerStore();
        store.setLayers([layer()]);
        const items = useImportedLayerItems(() => store.layers[0]);
        expect(items.namedItems.value).toEqual([
            { index: 0, name: 'Alpha' },
            { index: 1, name: 'Beta' },
            { index: 2, name: 'Alpha' }
        ]);
        items.query.value = ' ALp ';
        expect(items.filteredItems.value.map((item) => item.index)).toEqual([0, 2]);
        expect(store.itemVisibility).toEqual({});
        items.query.value = 'missing';
        expect(items.filteredItems.value).toEqual([]);
        store.setNameProperty('wards', null);
        expect(items.namedItems.value).toEqual([]);
    });

    it('cycles visible, hidden, solo and show-all within one layer, including unnamed items', () => {
        const store = useImportedLayerStore();
        store.setLayers([layer(), layer('other')]);
        const items = useImportedLayerItems(() => store.layers[0]);
        items.cycleVisibility(0);
        expect(items.isVisible(0)).toBe(false);
        expect(items.isVisible(2)).toBe(true);
        items.cycleVisibility(0);
        expect(items.soloIndex.value).toBe(0);
        expect(items.isVisible(0)).toBe(true);
        expect(items.isVisible(1)).toBe(false);
        expect(items.isVisible(5)).toBe(false);
        expect(store.isFeatureVisible('other', 1)).toBe(true);
        items.cycleVisibility(2);
        expect(items.soloIndex.value).toBeNull();
        expect(
            store.layers[0].featureCollection.features.every((_, index) => items.isVisible(index))
        ).toBe(true);
    });

    it('applies master actions to every item, not just matching names, and restores all from solo', () => {
        const store = useImportedLayerStore();
        store.setLayers([layer()]);
        const items = useImportedLayerItems(() => store.layers[0]);
        items.query.value = 'Beta';
        items.toggleAll();
        expect(items.allHidden.value).toBe(true);
        expect(items.isVisible(5)).toBe(false);
        items.cycleVisibility(1);
        expect(items.soloIndex.value).toBe(1);
        items.toggleAll();
        expect(items.soloIndex.value).toBeNull();
        expect(items.isVisible(5)).toBe(true);
        items.toggleAll();
        items.toggleAll();
        expect(items.allHidden.value).toBe(false);
    });

    it('retains indices through name edits and parent visibility changes, but resets on source replacement', () => {
        const store = useImportedLayerStore();
        store.setLayers([layer()]);
        const items = useImportedLayerItems(() => store.layers[0]);
        items.cycleVisibility(0);
        store.updateFeatureProperty('wards', 0, 'name', 'Renamed');
        store.renameLayer('wards', 'Renamed layer');
        store.toggleVisibility('wards');
        store.toggleVisibility('wards');
        expect(items.namedItems.value[0].name).toBe('Renamed');
        expect(items.isVisible(0)).toBe(false);
        store.layers[0].featureCollection = layer().featureCollection;
        expect(items.isVisible(0)).toBe(true);
    });

    it('resets ephemeral state on map loading, deletion and clear without adding state to layer data', () => {
        const store = useImportedLayerStore();
        store.setLayers([layer()]);
        store.cycleFeatureVisibility('wards', 0);
        expect(Object.keys(store.layers[0])).not.toContain('itemVisibility');
        store.setLayers([layer()]);
        expect(store.itemVisibility).toEqual({});
        store.cycleFeatureVisibility('wards', 0);
        store.deleteLayer('wards');
        expect(store.itemVisibility).toEqual({});
        store.addLayer(layer());
        expect(store.isFeatureVisible('wards', 0)).toBe(true);
        store.cycleFeatureVisibility('wards', 0);
        store.clear();
        expect(store.itemVisibility).toEqual({});
    });

    it('rejects invalid feature targets explicitly', () => {
        const store = useImportedLayerStore();
        store.setLayers([layer()]);
        expect(() => store.cycleFeatureVisibility('missing', 0)).toThrow(RangeError);
        expect(() => store.cycleFeatureVisibility('wards', 99)).toThrow(RangeError);
        expect(() => store.setAllFeaturesHidden('missing', true)).toThrow(RangeError);
    });
});
