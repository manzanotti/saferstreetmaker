/**
 * Tests for useGroups — beginAddToGroup() / addSelectionToGroup().
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
    executeSplitsAndProceed,
    beginAddToGroup,
    addSelectionToGroup
} from '../../src/composables/useGroups';
import {
    makePointLayer,
    makePolylineLayer,
    makePointMarker,
    makePolylineMarker,
    makeSelected
} from './useGroups.helpers';

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

    // ── finalizeCreateGroup ───────────────────────────────────────────────────

    describe('beginAddToGroup() / addSelectionToGroup()', () => {
        it('beginAddToGroup targets the group and activates area selection', () => {
            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'G', members: [] });
            const selStore = useSelectionStore(pinia);

            beginAddToGroup('g1');

            expect(groupStore.addToGroupId).toBe('g1');
            expect(selStore.isActive).toBe(true);
        });

        it('adds fully-selected features to an existing group and closes selection', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('hist-1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'G', members: [] });

            const selStore = useSelectionStore(pinia);
            selStore.setSelected([makeSelected('ModalFilters', 'hist-1', marker)]);
            selStore.activate();

            const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');
            addSelectionToGroup('g1');

            expect(groupStore.groups[0].members).toEqual([
                { layerId: 'ModalFilters', historyId: 'hist-1' }
            ]);
            expect(groupStore.addToGroupId).toBeNull();
            expect(selStore.isActive).toBe(false);
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('does not duplicate a member already in the target group', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('hist-1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'G',
                members: [{ layerId: 'ModalFilters', historyId: 'hist-1' }]
            });

            const selStore = useSelectionStore(pinia);
            selStore.setSelected([makeSelected('ModalFilters', 'hist-1', marker)]);
            selStore.activate();

            addSelectionToGroup('g1');

            expect(groupStore.groups[0].members).toHaveLength(1);
        });

        it('routes a partially-selected polyline through the split dialog into the group', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2, v3]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'G', members: [] });

            const selStore = useSelectionStore(pinia);
            selStore.setSelected([
                makeSelected('MobilityLanes', 'poly-1', polyline as any, v1),
                makeSelected('MobilityLanes', 'poly-1', polyline as any, v2)
            ]);
            selStore.activate();

            addSelectionToGroup('g1');

            // Partial selection defers to the split dialog; nothing added yet.
            expect(groupStore.splitDialogOpen).toBe(true);
            expect(groupStore.addToGroupId).toBe('g1');
            expect(groupStore.groups[0].members).toHaveLength(0);

            // Approving the split finalises the add WITHOUT opening the name dialog.
            executeSplitsAndProceed();

            expect(groupStore.nameDialogOpen).toBe(false);
            expect(groupStore.splitDialogOpen).toBe(false);
            expect(groupStore.groups[0].members).toHaveLength(1);
            expect(groupStore.addToGroupId).toBeNull();
            expect(selStore.isActive).toBe(false);
        });
    });
});
