import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as L from 'leaflet';
import { useImportedLayerStore } from '../../src/stores/importedLayerStore';
import { useImportedLayerItems } from '../../src/composables/layers/useImportedLayerItems';
import { useMapStore } from '../../src/stores/mapStore';
import { layer } from './ImportedLayerItems.helpers';

describe('Imported layer items', () => {
    let map: L.Map | undefined;

    beforeEach(() => {
        setActivePinia(createPinia());
    });
    afterEach(() => {
        map?.remove();
        map = undefined;
    });

    function setupMap() {
        map = L.map(document.createElement('div')).setView([0, 0], 14);
        useMapStore().setMap(map);
        return map;
    }

    it('lists only named items and searches trimmed, case-insensitive names without merging duplicates', () => {
        const store = useImportedLayerStore();
        store.setLayers([layer()]);
        const items = useImportedLayerItems(() => store.layers[0]);
        expect(items.namedItems.value).toEqual([
            { index: 0, name: 'Alpha', canCentre: true },
            { index: 2, name: 'Alpha', canCentre: true },
            { index: 1, name: 'Beta', canCentre: true }
        ]);
        items.query.value = ' ALp ';
        expect(items.filteredItems.value.map((item) => item.index)).toEqual([0, 2]);
        expect(store.itemVisibility).toEqual(new Map());
        items.query.value = 'missing';
        expect(items.filteredItems.value).toEqual([]);
        store.setNameProperty('wards', null);
        expect(items.namedItems.value).toEqual([]);
    });

    it('sorts names case-insensitively without changing feature order or duplicate identities', () => {
        const source = layer();
        const names = ['  zebra  ', 'beta', 'Alpha', 'ALPHA', '  delta  ', ''];
        source.featureCollection.features.forEach((feature, index) => {
            feature.properties = { name: names[index] };
        });
        const store = useImportedLayerStore();
        store.setLayers([source]);
        const features = [...store.layers[0].featureCollection.features];
        const items = useImportedLayerItems(() => store.layers[0]);

        expect(items.namedItems.value.map(({ index, name }) => ({ index, name }))).toEqual([
            { index: 2, name: 'Alpha' },
            { index: 3, name: 'ALPHA' },
            { index: 1, name: 'beta' },
            { index: 4, name: 'delta' },
            { index: 0, name: 'zebra' }
        ]);
        items.query.value = ' TA ';
        expect(items.filteredItems.value.map((item) => item.name)).toEqual(['beta', 'delta']);
        expect(store.layers[0].featureCollection.features).toEqual(features);
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
        expect(items.namedItems.value.map((item) => [item.index, item.name])).toEqual([
            [2, 'Alpha'],
            [1, 'Beta'],
            [0, 'Renamed']
        ]);
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
        expect(store.itemVisibility).toEqual(new Map());
        store.cycleFeatureVisibility('wards', 0);
        store.deleteLayer('wards');
        expect(store.itemVisibility).toEqual(new Map());
        store.addLayer(layer());
        expect(store.isFeatureVisible('wards', 0)).toBe(true);
        store.cycleFeatureVisibility('wards', 0);
        store.clear();
        expect(store.itemVisibility).toEqual(new Map());
    });

    it('rejects invalid feature targets explicitly', () => {
        const store = useImportedLayerStore();
        store.setLayers([layer()]);
        expect(() => store.cycleFeatureVisibility('missing', 0)).toThrow(RangeError);
        expect(() => store.cycleFeatureVisibility('wards', 99)).toThrow(RangeError);
        expect(() => store.setAllFeaturesHidden('missing', true)).toThrow(RangeError);
    });
});
