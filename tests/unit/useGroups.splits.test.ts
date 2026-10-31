/**
 * Tests for useGroups — executeSplitsAndProceed() / skipSplitsAndProceed().
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
import {
    finalizeCreateGroup,
    executeSplitsAndProceed,
    skipSplitsAndProceed
} from '../../src/composables/useGroups';
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

    // ── executeSplitsAndProceed (deferred split) ──────────────────────────────

    describe('executeSplitsAndProceed()', () => {
        it('approves the split and opens the name dialog WITHOUT mutating the map', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2, v3]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1, v2],
                    allLatLngs: [v1, v2, v3]
                }
            ]);

            executeSplitsAndProceed();

            // The split is deferred — the map must NOT have been mutated yet.
            expect(polyline.setLatLngs).not.toHaveBeenCalled();
            expect(layer.loadFromGeoJSON).not.toHaveBeenCalled();

            // Dialog transitions and pendingSplits is retained for finalize.
            expect(groupStore.splitDialogOpen).toBe(false);
            expect(groupStore.nameDialogOpen).toBe(true);
            expect(groupStore.pendingSplits).toHaveLength(1);
        });

        it('performs the split when the group is finalized (single checkpoint)', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
            const v4 = { lat: 4, lng: 4 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2, v3, v4]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');
            groupStore.setPendingGroupMembers([]);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1, v2],
                    allLatLngs: [v1, v2, v3, v4]
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('Split Group');

            // Original removed; both halves recreated as fresh lines (the
            // grouped inside line + the ungrouped remaining line).
            expect(polyline.setLatLngs).not.toHaveBeenCalled();
            expect(layer.getLayer().getLayers()).toHaveLength(0);
            expect(layer.loadFromGeoJSON).toHaveBeenCalledTimes(2);
            // Group holds only the new split (inside) line as its sole member.
            expect(groupStore.groups).toHaveLength(1);
            expect(groupStore.groups[0].members).toHaveLength(1);
            // Single checkpoint for the whole operation.
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('cancelling the name dialog after approving a split leaves the map untouched', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2, v3]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1, v2],
                    allLatLngs: [v1, v2, v3]
                }
            ]);

            executeSplitsAndProceed();
            // Simulate the name dialog Cancel button.
            groupStore.clearPendingState();
            groupStore.closeNameDialog();

            // No split performed, no group created, no checkpoint.
            expect(polyline.setLatLngs).not.toHaveBeenCalled();
            expect(layer.loadFromGeoJSON).not.toHaveBeenCalled();
            expect(layer.getLayer().getLayers()).toHaveLength(1);
            expect(groupStore.groups).toHaveLength(0);
            expect(markSpy).not.toHaveBeenCalled();
        });

        it('removes the original when only 1 vertex remains after the finalized split', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1],
                    allLatLngs: [v1, v2]
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('Tiny Split');

            // Original is removed (only 1 vertex left).
            expect(layer.getLayer().getLayers()).toHaveLength(0);
            // No new line created (only 1 selected vertex).
            expect(layer.loadFromGeoJSON).not.toHaveBeenCalled();
        });
    });

    // ── skipSplitsAndProceed ──────────────────────────────────────────────────

    describe('skipSplitsAndProceed()', () => {
        it('closes split dialog and opens name dialog without splitting', () => {
            const layer = makePolylineLayer('MobilityLanes');
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: {} as any,
                    selectedLatLngs: [],
                    allLatLngs: []
                }
            ]);

            skipSplitsAndProceed();

            expect(groupStore.splitDialogOpen).toBe(false);
            expect(groupStore.nameDialogOpen).toBe(true);
        });
    });
});
