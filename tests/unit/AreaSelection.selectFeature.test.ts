/**
 * Tests for useAreaSelection — selectFeature() replacement and activation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../src/stores/index';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useMapStore } from '../../src/stores/mapStore';
import { useGroupStore } from '../../src/stores/groupStore';
import { selectFeature, setupAreaSelection } from '../../src/composables/useAreaSelection';

// ---------------------------------------------------------------------------
// selectFeature
// ---------------------------------------------------------------------------
describe('selectFeature', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(pinia);
        useMapStore(pinia).setLayers([]);
        useSelectionStore(pinia).deactivate();
        useGroupStore(pinia).closePhasesDialog();
    });

    it('sets the selection to the feature vertices (non-additive)', () => {
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const polyline = {
            getLatLngs: () => [v1, v2]
        } as unknown as L.Layer;

        selectFeature(polyline, 'MobilityLanes', false);

        const selectionStore = useSelectionStore(pinia);
        expect(selectionStore.selected).toHaveLength(2);
        expect(selectionStore.selected[0].marker).toBe(polyline);
    });

    it('activates selection mode when it was not already active', () => {
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const polyline = { getLatLngs: () => [v1] } as unknown as L.Layer;

        const selectionStore = useSelectionStore(pinia);
        expect(selectionStore.isActive).toBe(false);

        selectFeature(polyline, 'MobilityLanes', false);

        expect(selectionStore.isActive).toBe(true);
    });

    it('does not re-activate if selection mode is already active', () => {
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const polyline = { getLatLngs: () => [v1] } as unknown as L.Layer;

        const selectionStore = useSelectionStore(pinia);
        selectionStore.activate();

        selectFeature(polyline, 'MobilityLanes', false);

        expect(selectionStore.isActive).toBe(true);
    });

    it('merges entries when additive is true (does not clear prior selection)', () => {
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const polyline1 = { getLatLngs: () => [v1] } as unknown as L.Layer;
        const polyline2 = { getLatLngs: () => [v2] } as unknown as L.Layer;

        const selectionStore = useSelectionStore(pinia);
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: null, latLng: v1, marker: polyline1 }
        ]);

        selectFeature(polyline2, 'MobilityLanes', true);

        expect(selectionStore.selected).toHaveLength(2);
        expect(selectionStore.selected[0].marker).toBe(polyline1);
        expect(selectionStore.selected[1].marker).toBe(polyline2);
    });

    it('replaces the selection when additive is false', () => {
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const polyline1 = { getLatLngs: () => [v1] } as unknown as L.Layer;
        const polyline2 = { getLatLngs: () => [v2] } as unknown as L.Layer;

        const selectionStore = useSelectionStore(pinia);
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: null, latLng: v1, marker: polyline1 }
        ]);

        selectFeature(polyline2, 'MobilityLanes', false);

        expect(selectionStore.selected).toHaveLength(1);
        expect(selectionStore.selected[0].marker).toBe(polyline2);
    });

    it('clears stale point highlights before replacing the selection', () => {
        const mapContainer = document.createElement('div');
        const previousElement = document.createElement('div');
        previousElement.classList.add('area-selected');

        setupAreaSelection({
            dragging: {
                disable: vi.fn(),
                enable: vi.fn()
            },
            getContainer: () => mapContainer,
            closePopup: vi.fn().mockReturnThis(),
            on: vi.fn().mockReturnThis(),
            off: vi.fn().mockReturnThis()
        } as unknown as L.Map);

        const previousMarker = {
            getLatLng: () => ({ lat: 0, lng: 0 }),
            getElement: () => previousElement
        } as unknown as L.Layer;
        const nextVertex = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const polyline = {
            getLatLngs: () => [nextVertex]
        } as unknown as L.Layer;

        const selectionStore = useSelectionStore(pinia);
        selectionStore.setSelected([
            {
                layerId: 'ModalFilters',
                historyId: null,
                latLng: { lat: 0, lng: 0 } as L.LatLng,
                marker: previousMarker
            }
        ]);

        selectFeature(polyline, 'MobilityLanes', false);

        expect(previousElement.classList.contains('area-selected')).toBe(false);
        expect(selectionStore.selected).toHaveLength(1);
        expect(selectionStore.selected[0].marker).toBe(polyline);
    });

    it('does nothing when the feature has no vertices', () => {
        const empty = { getLatLngs: () => [] } as unknown as L.Layer;
        const selectionStore = useSelectionStore(pinia);

        selectFeature(empty, 'MobilityLanes', false);

        expect(selectionStore.selected).toHaveLength(0);
        expect(selectionStore.isActive).toBe(false);
    });
});
