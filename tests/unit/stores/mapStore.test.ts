import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMapStore } from '../../../src/stores/mapStore';
import type { IMapLayer } from '../../../src/composables/layers/IMapLayer';

// Minimal IMapLayer stub for testing
function makeLayer(id: string): IMapLayer {
    return {
        id,
        title: id,
        groupName: '',
        selected: false,
        visible: false,
        iconHtml: '',
        getToolbarButton: () => ({
            id,
            tooltip: '',
            selected: false,
            groupName: '',
            action: () => {},
        }),
        getLegendEntry: () => document.createElement('li'),
        loadFromGeoJSON: () => {},
        getLayer: () => ({}) as any,
        toGeoJSON: () => ({}),
        clearLayer: () => {},
    };
}

describe('mapStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('initialises with empty state', () => {
        const store = useMapStore();
        expect(store.map).toBeNull();
        expect(store.layers).toHaveLength(0);
        expect(store.activeLayerId).toBeNull();
        expect(store.visibleLayerIds.size).toBe(0);
        expect(store.layerUpdateCount).toBe(0);
    });

    describe('setLayers()', () => {
        it('stores layers and populates visibleLayerIds', () => {
            const store = useMapStore();
            const layers = [makeLayer('a'), makeLayer('b')];
            store.setLayers(layers);
            expect(store.layers).toHaveLength(2);
            expect(store.visibleLayerIds.has('a')).toBe(true);
            expect(store.visibleLayerIds.has('b')).toBe(true);
        });

        it('replaces previous layers', () => {
            const store = useMapStore();
            store.setLayers([makeLayer('x')]);
            store.setLayers([makeLayer('y'), makeLayer('z')]);
            expect(store.layers.map((l) => l.id)).toEqual(['y', 'z']);
            expect(store.visibleLayerIds.has('x')).toBe(false);
        });
    });

    describe('setActiveLayer()', () => {
        it('sets the active layer id', () => {
            const store = useMapStore();
            store.setActiveLayer('modal-filter');
            expect(store.activeLayerId).toBe('modal-filter');
        });

        it('accepts null to deselect', () => {
            const store = useMapStore();
            store.setActiveLayer('modal-filter');
            store.setActiveLayer(null);
            expect(store.activeLayerId).toBeNull();
        });
    });

    describe('toggleLayerVisibility()', () => {
        it('removes a visible layer from visibleLayerIds', () => {
            const store = useMapStore();
            store.setLayers([makeLayer('a'), makeLayer('b')]);
            store.toggleLayerVisibility('a');
            expect(store.visibleLayerIds.has('a')).toBe(false);
            expect(store.visibleLayerIds.has('b')).toBe(true);
        });

        it('adds a hidden layer back to visibleLayerIds', () => {
            const store = useMapStore();
            store.setLayers([makeLayer('a')]);
            store.toggleLayerVisibility('a'); // hide
            store.toggleLayerVisibility('a'); // show again
            expect(store.visibleLayerIds.has('a')).toBe(true);
        });

        it('reassigns the Set reference (triggers Vue reactivity)', () => {
            const store = useMapStore();
            store.setLayers([makeLayer('a')]);
            const before = store.visibleLayerIds;
            store.toggleLayerVisibility('a');
            expect(store.visibleLayerIds).not.toBe(before);
        });
    });

    describe('markLayerUpdated()', () => {
        it('increments layerUpdateCount on each call', () => {
            const store = useMapStore();
            expect(store.layerUpdateCount).toBe(0);
            store.markLayerUpdated();
            expect(store.layerUpdateCount).toBe(1);
            store.markLayerUpdated();
            expect(store.layerUpdateCount).toBe(2);
        });
    });

    describe('toLayers()', () => {
        it('returns a Map keyed by layer id', () => {
            const store = useMapStore();
            store.setLayers([makeLayer('alpha'), makeLayer('beta')]);
            const m = store.toLayers();
            expect(m.size).toBe(2);
            expect(m.get('alpha')?.id).toBe('alpha');
            expect(m.get('beta')?.id).toBe('beta');
        });

        it('returns an empty Map when no layers are registered', () => {
            const store = useMapStore();
            expect(store.toLayers().size).toBe(0);
        });
    });
});
