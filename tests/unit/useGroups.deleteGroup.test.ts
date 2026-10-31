/**
 * Tests for useGroups — deleting groups and their elements.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import { pinia } from '../../src/stores/index';
import { useGroupStore } from '../../src/stores/groupStore';
import { useMapStore } from '../../src/stores/mapStore';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useFeatureDeletionStore } from '../../src/stores/featureDeletionStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import {
    deleteGroupWithElements,
    removeAllGroupElements,
    deleteGroup
} from '../../src/composables/useGroups';
import { makePointLayer, makePointMarker, makeSelected } from './useGroups.helpers';

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

    describe('deleteGroupWithElements()', () => {
        it('removes unassigned features as well as version members', () => {
            const layer = makePointLayer('ModalFilters');
            layer.getLayer().addLayer(makePointMarker('versioned') as any);
            layer.getLayer().addLayer(makePointMarker('unassigned') as any);
            useMapStore(pinia).setLayers([layer]);
            const store = useGroupStore(pinia);
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Group',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [{ layerId: 'ModalFilters', historyId: 'versioned' }]
                        }
                    ],
                    unassignedMembers: [{ layerId: 'ModalFilters', historyId: 'unassigned' }]
                }
            ]);
            deleteGroupWithElements('g1');
            expect(layer.getLayer().getLayers()).toEqual([]);
            expect(store.groups).toEqual([]);
        });
        it('removes group members from their layers and removes the group', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Test',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            const mapStore = useMapStore(pinia);
            const markSpy = vi.spyOn(mapStore, 'markLayerUpdated');

            deleteGroupWithElements('g1');

            expect(layer.getLayer().getLayers()).toHaveLength(0);
            expect(groupStore.groups).toHaveLength(0);
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('removes members from inactive versions as well', () => {
            const layer = makePointLayer('ModalFilters');
            const activeMarker = makePointMarker('active-feature');
            const inactiveMarker = makePointMarker('inactive-feature');
            layer.getLayer().addLayer(activeMarker as any);
            layer.getLayer().addLayer(inactiveMarker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.setGroups([
                {
                    id: 'g1',
                    name: 'Versioned group',
                    defaultVersionId: 'v1',
                    versions: [
                        {
                            id: 'v1',
                            name: 'Active',
                            members: [{ layerId: 'ModalFilters', historyId: 'active-feature' }]
                        },
                        {
                            id: 'v2',
                            name: 'Inactive',
                            members: [{ layerId: 'ModalFilters', historyId: 'inactive-feature' }]
                        }
                    ]
                }
            ]);

            deleteGroupWithElements('g1');

            expect(layer.getLayer().getLayers()).toHaveLength(0);
            expect(groupStore.groups).toHaveLength(0);
        });

        it('does nothing for an unknown group id', () => {
            deleteGroupWithElements('nonexistent');
            expect(useGroupStore(pinia).groups).toHaveLength(0);
        });
    });

    // ── removeAllGroupElements / deleteGroup ──────────────────────────────────

    describe('removeAllGroupElements()', () => {
        it('clears members without removing features from the map', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Test',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            removeAllGroupElements('g1');

            expect(groupStore.groups[0].members).toHaveLength(0);
            // Feature stays on the map.
            expect(layer.getLayer().getLayers()).toHaveLength(1);
        });
    });

    describe('deleteGroup()', () => {
        it('removes the group and marks layer updated', () => {
            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'Empty', members: [] });
            const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');

            deleteGroup('g1');

            expect(groupStore.groups).toHaveLength(0);
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('deletes a non-empty group but leaves its member features on the map', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Keep Elements',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            deleteGroup('g1');

            // Group gone, but the feature remains on the map.
            expect(groupStore.groups).toHaveLength(0);
            expect(layer.getLayer().getLayers()).toHaveLength(1);
        });

        it('clears the current selection so the ungrouped elements are not left highlighted', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Selected',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            // Simulate having selected the group (members tracked in selection).
            const selStore = useSelectionStore(pinia);
            selStore.setSelected([makeSelected('ModalFilters', 'h1', marker as any)]);

            deleteGroup('g1');

            expect(selStore.selected).toHaveLength(0);
        });
    });
});
