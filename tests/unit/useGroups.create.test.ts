/**
 * Tests for useGroups — creating, naming and versioning groups.
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
    createGroupFromSelection,
    finalizeCreateGroup,
    finalizeRenameGroup,
    createGroupVersion
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

    // ── createGroupFromSelection ──────────────────────────────────────────────

    describe('createGroupFromSelection()', () => {
        it('opens the name dialog when all features are fully selected', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('hist-1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const selStore = useSelectionStore(pinia);
            selStore.setSelected([makeSelected('ModalFilters', 'hist-1', marker)]);
            selStore.activate();

            createGroupFromSelection();

            const groupStore = useGroupStore(pinia);
            expect(groupStore.nameDialogOpen).toBe(true);
            expect(groupStore.splitDialogOpen).toBe(false);
            expect(groupStore.pendingGroupMembers).toHaveLength(1);
            expect(groupStore.pendingGroupMembers[0]).toEqual({
                layerId: 'ModalFilters',
                historyId: 'hist-1'
            });
        });

        it('opens the split dialog when a polyline is partially selected', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2, v3]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const selStore = useSelectionStore(pinia);
            // Only select 2 of 3 vertices — partial selection.
            selStore.setSelected([
                makeSelected('MobilityLanes', 'poly-1', polyline as any, v1),
                makeSelected('MobilityLanes', 'poly-1', polyline as any, v2)
            ]);
            selStore.activate();

            createGroupFromSelection();

            const groupStore = useGroupStore(pinia);
            expect(groupStore.splitDialogOpen).toBe(true);
            expect(groupStore.nameDialogOpen).toBe(false);
            expect(groupStore.pendingSplits).toHaveLength(1);
            expect(groupStore.pendingSplits[0].layerTitle).toBe('MobilityLanes');
        });

        it('skips features with no historyId', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = { feature: { properties: {} }, getLatLng: () => ({ lat: 1, lng: 2 }) };
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const selStore = useSelectionStore(pinia);
            selStore.setSelected([makeSelected('ModalFilters', null as any, marker as any)]);
            selStore.activate();

            createGroupFromSelection();

            const groupStore = useGroupStore(pinia);
            expect(groupStore.pendingGroupMembers).toHaveLength(0);
        });

        it('does nothing when nothing is selected', () => {
            createGroupFromSelection();
            const groupStore = useGroupStore(pinia);
            expect(groupStore.nameDialogOpen).toBe(false);
            expect(groupStore.splitDialogOpen).toBe(false);
        });
    });

    describe('finalizeCreateGroup()', () => {
        it('creates a group with pending members and marks layer updated', () => {
            const groupStore = useGroupStore(pinia);
            const mapStore = useMapStore(pinia);
            const markSpy = vi.spyOn(mapStore, 'markLayerUpdated');

            groupStore.setPendingGroupMembers([{ layerId: 'ModalFilters', historyId: 'h1' }]);
            finalizeCreateGroup('My Group');

            expect(groupStore.groups).toHaveLength(1);
            expect(groupStore.groups[0].name).toBe('My Group');
            expect(groupStore.groups[0].members).toHaveLength(1);
            expect(groupStore.nameDialogOpen).toBe(false);
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('trims the group name', () => {
            useGroupStore(pinia).setPendingGroupMembers([]);
            finalizeCreateGroup('  Padded  ');
            expect(useGroupStore(pinia).groups[0].name).toBe('Padded');
        });

        it('does nothing for an empty name', () => {
            finalizeCreateGroup('   ');
            expect(useGroupStore(pinia).groups).toHaveLength(0);
        });

        it('deactivates the area selection so the selection pop-up closes', () => {
            const groupStore = useGroupStore(pinia);
            const selectionStore = useSelectionStore(pinia);

            selectionStore.activate();
            selectionStore.setSelected([
                { layerId: 'ModalFilters', historyId: 'h1', latLng: {} as any, marker: {} as any }
            ]);
            groupStore.setPendingGroupMembers([{ layerId: 'ModalFilters', historyId: 'h1' }]);

            finalizeCreateGroup('Closes Popup');

            expect(selectionStore.isActive).toBe(false);
            expect(selectionStore.selected).toHaveLength(0);
        });
    });

    // ── finalizeRenameGroup ───────────────────────────────────────────────────

    describe('finalizeRenameGroup()', () => {
        it('renames a group and marks layer updated', () => {
            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'Old', members: [] });
            const mapStore = useMapStore(pinia);
            const markSpy = vi.spyOn(mapStore, 'markLayerUpdated');

            finalizeRenameGroup('g1', 'New Name');

            expect(groupStore.groups[0].name).toBe('New Name');
            expect(markSpy).toHaveBeenCalledOnce();
        });
    });

    // ── deleteGroupWithElements ───────────────────────────────────────────────

    describe('createGroupVersion()', () => {
        it('starts empty instead of cloning features already assigned to a version', () => {
            const layer = makePointLayer('ModalFilters');
            const sourceMarker = makePointMarker('source-feature');
            layer.getLayer().addLayer(sourceMarker as any);
            (layer as any).loadFeature = vi.fn((_feature: unknown, historyId: string) => {
                layer.getLayer().addLayer(makePointMarker(historyId) as any);
                return historyId;
            });
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Test',
                members: [{ layerId: 'ModalFilters', historyId: 'source-feature' }]
            });

            const created = createGroupVersion('g1', 'Alternative');
            const versions = groupStore.groups[0].versions ?? [];
            const members = versions[1]?.members ?? [];

            expect(created).toBe(true);
            expect(versions).toHaveLength(2);
            expect(members).toEqual([]);
            expect(groupStore.activeVersionIds.g1).toBe(versions[1].id);
            expect(layer.loadFeature).not.toHaveBeenCalled();
            expect(layer.getLayer().getLayers()).toHaveLength(1);
            expect(useSelectionStore(pinia).selectedGroupId).toBe('g1');
        });

        it('seeds a new version only with unassigned group members without cloning them', () => {
            const layer = makePointLayer('ModalFilters');
            layer.getLayer().addLayer(makePointMarker('assigned') as any);
            layer.getLayer().addLayer(makePointMarker('unassigned') as any);
            useMapStore(pinia).setLayers([layer]);
            const groupStore = useGroupStore(pinia);
            const assigned = { layerId: 'ModalFilters', historyId: 'assigned' };
            const unassigned = { layerId: 'ModalFilters', historyId: 'unassigned' };
            groupStore.setGroups([
                {
                    id: 'g1',
                    name: 'Test',
                    versions: [{ id: 'v1', name: 'First', members: [assigned] }],
                    unassignedMembers: [unassigned]
                }
            ]);

            expect(createGroupVersion('g1', 'Second')).toBe(true);
            expect(groupStore.groups[0].versions?.map((version) => version.members)).toEqual([
                [assigned],
                [unassigned]
            ]);
            expect(groupStore.groups[0].unassignedMembers).toEqual([]);
            expect(layer.getLayer().getLayers()).toHaveLength(2);
        });
    });
});
