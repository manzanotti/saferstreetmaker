import { createApp, h, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LayerItemsPanel from '../../src/components/panels/layers/LayerItemsPanel.vue';
import { useImportedLayerStore } from '../../src/stores/importedLayerStore';
import { useMapStore } from '../../src/stores/mapStore';
import * as L from 'leaflet';

describe('LayerItemsPanel', () => {
    let app: App;
    let root: HTMLDivElement;

    beforeEach(() => {
        setActivePinia(createPinia());
        useImportedLayerStore().setLayers([
            {
                id: 'test',
                name: 'Test layer',
                nameProperty: 'name',
                featureCollection: {
                    type: 'FeatureCollection',
                    features: [{ type: 'Feature', properties: { name: 'Alpha' }, geometry: null }]
                }
            }
        ]);
        root = document.createElement('div');
        document.body.appendChild(root);
    });
    afterEach(() => {
        app?.unmount();
        root.remove();
    });

    function mount(readOnly = false) {
        const store = useImportedLayerStore();
        const onRename = vi.fn();
        app = createApp(() => h(LayerItemsPanel, { layer: store.layers[0], readOnly, onRename }));
        app.mount(root);
        return { store, onRename };
    }

    it('uses shared eye states and cycles actions while preserving feature data', async () => {
        const { store } = mount();
        const eye = root.querySelector(
            '#layer-items-list button[data-visibility]'
        ) as HTMLButtonElement;
        expect(eye.getAttribute('aria-label')).toBe('Hide item Alpha');
        eye.click();
        await nextTick();
        expect(eye.dataset.visibility).toBe('hidden');
        expect(eye.getAttribute('aria-label')).toBe('Show only item Alpha');
        eye.click();
        await nextTick();
        expect(eye.dataset.visibility).toBe('solo');
        expect(eye.getAttribute('aria-label')).toBe('Show all items');
        const description = document.getElementById(eye.getAttribute('aria-describedby')!);
        expect(description?.textContent).toBe('Showing only this item');
        eye.click();
        await nextTick();
        expect(eye.dataset.visibility).toBe('visible');
        expect(store.layers[0].featureCollection.features).toHaveLength(1);
    });

    it('searches and distinguishes empty-state reasons reactively', async () => {
        const { store } = mount();
        const input = root.querySelector('#layer-items-search') as HTMLInputElement;
        input.value = 'missing';
        input.dispatchEvent(new Event('input'));
        await nextTick();
        expect(root.textContent).toContain('No items match your search.');
        store.updateFeatureProperty('test', 0, 'name', '');
        await nextTick();
        expect(root.textContent).toContain('This layer has no named items.');
        store.setNameProperty('test', null);
        await nextTick();
        expect(root.textContent).toContain('No name property was selected');
    });

    it('keeps visibility and search available without renaming in Presentation mode', () => {
        mount(true);
        expect(root.querySelector('#layer-details-name')).toBeNull();
        expect(root.querySelector('#layer-items-search')).not.toBeNull();
        expect(root.querySelector('#layer-items-list button')).not.toBeNull();
    });

    it.each([false, true])(
        'centres names independently of visibility and disables locationless names (Presentation mode: %s)',
        async (readOnly) => {
            const { store } = mount(readOnly);
            const name = root.querySelector('#layer-items-list button') as HTMLButtonElement;
            expect(name.disabled).toBe(true);
            expect(name.title).toBe('This item has no location.');

            const map = L.map(document.createElement('div')).setView([0, 0], 12);
            useMapStore().setMap(map);
            const panTo = vi.spyOn(map, 'panTo');
            store.layers[0].featureCollection.features[0].geometry = {
                type: 'Point',
                coordinates: [4, 8]
            };
            await nextTick();
            try {
                expect(name.disabled).toBe(false);
                name.click();
                expect(panTo).toHaveBeenCalledExactlyOnceWith(L.latLng(8, 4));
                const eye = root.querySelector(
                    '#layer-items-list button[data-visibility]'
                ) as HTMLButtonElement;
                eye.click();
                await nextTick();
                expect(panTo).toHaveBeenCalledOnce();
                expect(name.getAttribute('aria-label')).toBe('Centre map on Alpha');
            } finally {
                map.remove();
            }
        }
    );
});
