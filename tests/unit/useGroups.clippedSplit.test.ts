/**
 * Tests for useGroups — clipped polyline splitting.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../src/stores/index';
import { useGroupStore } from '../../src/stores/groupStore';
import { useMapStore } from '../../src/stores/mapStore';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useFeatureDeletionStore } from '../../src/stores/featureDeletionStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { finalizeCreateGroup, executeSplitsAndProceed } from '../../src/composables/useGroups';
import { makePolylineLayer, makePolylineMarker } from './useGroups.helpers';

// ── Tests ─────────────────────────────────────────────────────────────────

describe('useGroups', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        vi.clearAllMocks();
        useGroupStore(pinia).setGroups([]);
        useGroupStore(pinia).setAllHidden(false);
        useGroupStore(pinia).clearPendingState();
        useGroupStore(pinia).closeNameDialog();
        useGroupStore(pinia).closeSplitDialog();
        useFeatureDeletionStore(pinia).close();
        useSelectionStore(pinia).deactivate();
        useMapStore(pinia).setLayers([]);
        useSettingsStore(pinia).readOnly = false;
    });

    // ── clipped split (extend new line to selection edge) ─────────────────────

    describe('clipped polyline split', () => {
        it('clips the new line to the selection rectangle, adding boundary points', () => {
            const layer = makePolylineLayer('MobilityLanes');
            // Horizontal line at lat 5 crossing a rectangle spanning lng 0..10.
            const v0 = { lat: 5, lng: -5 } as unknown as L.LatLng; // outside (west)
            const v1 = { lat: 5, lng: 5 } as unknown as L.LatLng; // inside
            const v2 = { lat: 5, lng: 15 } as unknown as L.LatLng; // outside (east)
            const polyline = makePolylineMarker('poly-1', [v0, v1, v2]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const bounds = {
                getWest: () => 0,
                getEast: () => 10,
                getSouth: () => 0,
                getNorth: () => 10
            } as unknown as L.LatLngBounds;

            const groupStore = useGroupStore(pinia);
            groupStore.setPendingGroupMembers([]);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1],
                    allLatLngs: [v0, v1, v2],
                    clipBounds: bounds
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('Clipped');

            // The new line reaches the rectangle edges at lng 0 and lng 10.
            const fc = (layer.loadFromGeoJSON as any).mock.calls[0][0];
            const coords = fc.features[0].geometry.coordinates;
            expect(coords).toEqual([
                [0, 5],
                [5, 5],
                [10, 5]
            ]);
            // A single contiguous inside run ⇒ one new group member.
            expect(groupStore.groups[0].members).toHaveLength(1);
        });

        it('produces a separate line for each inside run when the path exits and re-enters', () => {
            const layer = makePolylineLayer('MobilityLanes');
            // Path: inside, outside, inside ⇒ two runs.
            const v0 = { lat: 5, lng: 5 } as unknown as L.LatLng; // inside
            const v1 = { lat: 5, lng: 15 } as unknown as L.LatLng; // outside
            const v2 = { lat: 5, lng: 25 } as unknown as L.LatLng; // outside
            const v3 = { lat: 5, lng: 5 } as unknown as L.LatLng; // inside (distinct ref)
            const polyline = makePolylineMarker('poly-1', [v0, v1, v2, v3]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const bounds = {
                getWest: () => 0,
                getEast: () => 10,
                getSouth: () => 0,
                getNorth: () => 10
            } as unknown as L.LatLngBounds;

            const groupStore = useGroupStore(pinia);
            groupStore.setPendingGroupMembers([]);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v0, v3],
                    allLatLngs: [v0, v1, v2, v3],
                    clipBounds: bounds
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('Two Runs');

            // Two inside runs ⇒ two group members, plus one recreated remaining
            // (middle, outside) line ⇒ three loadFromGeoJSON calls total.
            expect(layer.loadFromGeoJSON).toHaveBeenCalledTimes(3);
            expect(groupStore.groups[0].members).toHaveLength(2);
        });

        it('extends the remaining line to the selection edge (end selection)', () => {
            const layer = makePolylineLayer('MobilityLanes');
            // Horizontal line at lat 5; select the eastern end.
            const v0 = { lat: 5, lng: -5 } as unknown as L.LatLng; // outside (west)
            const v1 = { lat: 5, lng: 5 } as unknown as L.LatLng; // inside
            const v2 = { lat: 5, lng: 15 } as unknown as L.LatLng; // inside (beyond east edge? no, inside rect)
            const polyline = makePolylineMarker('poly-1', [v0, v1, v2]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const bounds = {
                getWest: () => 0,
                getEast: () => 20,
                getSouth: () => 0,
                getNorth: () => 10
            } as unknown as L.LatLngBounds;

            const groupStore = useGroupStore(pinia);
            groupStore.setPendingGroupMembers([]);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1, v2],
                    allLatLngs: [v0, v1, v2],
                    clipBounds: bounds
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('End Split');

            // The original is removed and recreated as two fresh lines: the
            // grouped inside line (call 0) and the remaining outside line
            // (call 1). The remaining line keeps v0 and is extended to the
            // western rectangle edge at lng 0 — no gap at the split.
            expect(polyline.setLatLngs).not.toHaveBeenCalled();
            expect(layer.getLayer().getLayers()).toHaveLength(0);
            expect(layer.loadFromGeoJSON).toHaveBeenCalledTimes(2);
            const remainingCoords = (layer.loadFromGeoJSON as any).mock.calls[1][0].features[0]
                .geometry.coordinates;
            expect(remainingCoords).toEqual([
                [-5, 5],
                [0, 5]
            ]);
        });

        it('splits the remaining geometry into two lines when the selection is in the middle', () => {
            const layer = makePolylineLayer('MobilityLanes');
            // Horizontal line; select only the middle vertex.
            const v0 = { lat: 5, lng: -5 } as unknown as L.LatLng; // outside (west)
            const v1 = { lat: 5, lng: 5 } as unknown as L.LatLng; // inside
            const v2 = { lat: 5, lng: 15 } as unknown as L.LatLng; // outside (east)
            const polyline = makePolylineMarker('poly-1', [v0, v1, v2]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const bounds = {
                getWest: () => 0,
                getEast: () => 10,
                getSouth: () => 0,
                getNorth: () => 10
            } as unknown as L.LatLngBounds;

            const groupStore = useGroupStore(pinia);
            groupStore.setPendingGroupMembers([]);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1],
                    allLatLngs: [v0, v1, v2],
                    clipBounds: bounds
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('Middle Split');

            // The original is removed and the geometry recreated as three fresh
            // lines: [0] the grouped inside line, [1] the west remaining line,
            // [2] the east remaining line — each reaching the selection edge.
            expect(polyline.setLatLngs).not.toHaveBeenCalled();
            expect(layer.getLayer().getLayers()).toHaveLength(0);
            expect(layer.loadFromGeoJSON).toHaveBeenCalledTimes(3);

            const westCoords = (layer.loadFromGeoJSON as any).mock.calls[1][0].features[0].geometry
                .coordinates;
            expect(westCoords).toEqual([
                [-5, 5],
                [0, 5]
            ]);
            const eastCoords = (layer.loadFromGeoJSON as any).mock.calls[2][0].features[0].geometry
                .coordinates;
            expect(eastCoords).toEqual([
                [10, 5],
                [15, 5]
            ]);
            // Only the inside line joins the group.
            expect(groupStore.groups[0].members).toHaveLength(1);
        });
    });
});
