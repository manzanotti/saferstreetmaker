/**
 * Tests for useAreaSelection — selectFeature() additive toggling.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../src/stores/index';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useMapStore } from '../../src/stores/mapStore';
import { useGroupStore } from '../../src/stores/groupStore';
import { selectFeature } from '../../src/composables/useAreaSelection';

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

    it('extends a partially selected polyline vertex-by-vertex', () => {
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const polyline = { getLatLngs: () => [v1, v2] } as unknown as L.Layer;

        const selectionStore = useSelectionStore(pinia);
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: null, latLng: v1, marker: polyline }
        ]);

        selectFeature(polyline, 'MobilityLanes', true);

        expect(selectionStore.selected).toHaveLength(2);
        expect(selectionStore.selected[0].latLng).toBe(v1);
        expect(selectionStore.selected[1].latLng).toBe(v2);
    });

    it('removes a fully selected feature on an additive click', () => {
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const polyline = { getLatLngs: () => [v1, v2] } as unknown as L.Layer;

        const selectionStore = useSelectionStore(pinia);
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: null, latLng: v1, marker: polyline },
            { layerId: 'MobilityLanes', historyId: null, latLng: v2, marker: polyline }
        ]);
        selectionStore.activate();

        selectFeature(polyline, 'MobilityLanes', true, false, true);

        expect(selectionStore.selected).toHaveLength(0);
    });

    it('uses a plain additive click to toggle membership during an active phase draft', () => {
        const vertex = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const polyline = {
            getLatLngs: () => [vertex],
            properties: { historyId: 'line-1' }
        } as unknown as L.Layer;
        const selectionStore = useSelectionStore(pinia);
        const groupStore = useGroupStore(pinia);
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: 'line-1', latLng: vertex, marker: polyline }
        ]);
        groupStore.phaseDraftActive = true;
        groupStore.phaseGroupId = 'group-1';

        selectFeature(polyline, 'MobilityLanes', true);

        expect(selectionStore.selected).toHaveLength(0);
        expect(selectionStore.isPhaseEditing).toBe(true);
        expect(selectionStore.isGroupSelection).toBe(true);
        expect(selectionStore.selectedGroupId).toBe('group-1');
    });

    it('removes an already-selected feature on an additive click', () => {
        const vertex = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const otherVertex = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const polyline = { getLatLngs: () => [vertex] } as unknown as L.Layer;
        const otherPolyline = { getLatLngs: () => [otherVertex] } as unknown as L.Layer;

        const selectionStore = useSelectionStore(pinia);
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: null, latLng: vertex, marker: polyline },
            {
                layerId: 'MobilityLanes',
                historyId: null,
                latLng: otherVertex,
                marker: otherPolyline
            }
        ]);
        selectionStore.activate();

        selectFeature(polyline, 'MobilityLanes', true, false, true);

        expect(selectionStore.selected).toHaveLength(1);
        expect(selectionStore.selected[0].marker).toBe(otherPolyline);
    });

    it('does not remove stale inactive feature preselection on a modifier click', () => {
        const vertex = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const polyline = { getLatLngs: () => [vertex] } as unknown as L.Layer;
        const selectionStore = useSelectionStore(pinia);
        selectionStore.setSelected([
            { layerId: 'MobilityLanes', historyId: null, latLng: vertex, marker: polyline }
        ]);

        selectFeature(polyline, 'MobilityLanes', true, false, true);

        expect(selectionStore.isActive).toBe(true);
        expect(selectionStore.selected).toHaveLength(1);
    });
});
