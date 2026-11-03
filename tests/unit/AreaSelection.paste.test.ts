/**
 * Tests for useAreaSelection — executePaste().
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import { pinia } from '../../src/stores/index';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useMapStore } from '../../src/stores/mapStore';
import { executePaste } from '../../src/composables/useAreaSelection';
import { makePointLayer } from './AreaSelection.helpers';

// ---------------------------------------------------------------------------
// executePaste
// ---------------------------------------------------------------------------
describe('executePaste', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(pinia);
        useMapStore(pinia).setLayers([]);
        useSelectionStore(pinia).deactivate();
        useSelectionStore(pinia).copyToClipboard([]);
    });

    it('does nothing when clipboard is empty', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);
        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        executePaste();

        expect(layer.loadFromGeoJSON).not.toHaveBeenCalled();
        expect(spy).not.toHaveBeenCalled();
    });

    it('calls loadFromGeoJSON on the target layer with the clipboard features', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'original-id' }
        };

        const selectionStore = useSelectionStore();
        selectionStore.copyToClipboard([{ layerId: 'ModalFilters', feature }]);

        executePaste();

        expect(layer.loadFromGeoJSON).toHaveBeenCalledOnce();
        const call = (layer.loadFromGeoJSON as ReturnType<typeof vi.fn>).mock.calls[0][0] as any;
        expect(call.type).toBe('FeatureCollection');
        expect(call.features).toHaveLength(1);
    });

    it('assigns a new historyId to each pasted feature', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'original-id' }
        };

        const selectionStore = useSelectionStore();
        selectionStore.copyToClipboard([{ layerId: 'ModalFilters', feature }]);

        executePaste();

        const call = (layer.loadFromGeoJSON as ReturnType<typeof vi.fn>).mock.calls[0][0] as any;
        const pastedHistoryId = call.features[0].properties?.historyId;
        expect(pastedHistoryId).toBeDefined();
        expect(pastedHistoryId).not.toBe('original-id');
    });

    it('calls markLayerUpdated once after pasting', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);
        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'h-1' }
        };

        useSelectionStore().copyToClipboard([{ layerId: 'ModalFilters', feature }]);

        executePaste();

        expect(spy).toHaveBeenCalledOnce();
    });

    it('skips clipboard entries whose layer is not in the store', () => {
        const mapStore = useMapStore();
        mapStore.setLayers([]);
        const spy = vi.spyOn(mapStore, 'markLayerUpdated');

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: {}
        };

        useSelectionStore().copyToClipboard([{ layerId: 'ModalFilters', feature }]);

        // Should not throw, and markLayerUpdated is still called
        expect(() => executePaste()).not.toThrow();
        expect(spy).toHaveBeenCalledOnce();
    });

    it('groups multiple clipboard entries for the same layer into one loadFromGeoJSON call', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const mkFeature = (id: string): GeoJSON.Feature => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: id }
        });

        useSelectionStore().copyToClipboard([
            { layerId: 'ModalFilters', feature: mkFeature('a') },
            { layerId: 'ModalFilters', feature: mkFeature('b') }
        ]);

        executePaste();

        expect(layer.loadFromGeoJSON).toHaveBeenCalledOnce();
        const call = (layer.loadFromGeoJSON as ReturnType<typeof vi.fn>).mock.calls[0][0] as any;
        expect(call.features).toHaveLength(2);
    });

    it('does not mutate the original clipboard feature', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'original-id' }
        };

        useSelectionStore().copyToClipboard([{ layerId: 'ModalFilters', feature }]);
        executePaste();

        // The original clipboard entry must be unchanged
        expect(useSelectionStore().clipboard[0].feature.properties?.historyId).toBe('original-id');
    });

    it('makes a hidden target layer visible when pasting into it', () => {
        const layer = makePointLayer('ModalFilters');
        const mapStore = useMapStore();
        mapStore.setLayers([layer]);
        mapStore.visibleLayerIds = new Set();

        const feature: GeoJSON.Feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId: 'original-id' }
        };

        useSelectionStore().copyToClipboard([{ layerId: 'ModalFilters', feature }]);
        executePaste();

        expect(mapStore.visibleLayerIds.has('ModalFilters')).toBe(true);
    });
});
