/**
 * Tests for useGroups — deleteGroupVersion().
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
import { createGroupVersion, deleteGroupVersion } from '../../src/composables/useGroups';
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

    describe('deleteGroupVersion()', () => {
        it('keeps deleted-version elements used as unassigned members of another group', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('shared');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);
            const member = { layerId: 'ModalFilters', historyId: 'shared' };
            const store = useGroupStore(pinia);
            store.setGroups([
                {
                    id: 'g1',
                    name: 'First',
                    versions: [
                        { id: 'v1', name: 'Default', members: [] },
                        { id: 'v2', name: 'Alternative', members: [member] }
                    ]
                },
                {
                    id: 'g2',
                    name: 'Second',
                    versions: [{ id: 'v3', name: 'Default', members: [] }],
                    unassignedMembers: [member]
                }
            ]);
            expect(deleteGroupVersion('g1', 'v2', true)).toBe(true);
            expect(layer.getLayer().getLayers()).toEqual([marker]);
            expect(store.getFeatureGroupMemberships(member).map((item) => item.groupId)).toEqual([
                'g2'
            ]);
        });
        it('keeps the version features on the map when deleting the version only', () => {
            const layer = makePointLayer('ModalFilters');
            const firstMarker = makePointMarker('first-feature');
            const secondMarker = makePointMarker('second-feature');
            layer.getLayer().addLayer(firstMarker as any);
            layer.getLayer().addLayer(secondMarker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.setGroups([
                {
                    id: 'g1',
                    name: 'Test',
                    defaultVersionId: 'v1',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [{ layerId: 'ModalFilters', historyId: 'first-feature' }]
                        },
                        {
                            id: 'v2',
                            name: 'Second',
                            members: [{ layerId: 'ModalFilters', historyId: 'second-feature' }]
                        }
                    ]
                }
            ]);

            expect(deleteGroupVersion('g1', 'v2')).toBe(true);
            expect(groupStore.groups[0].versions?.map((version) => version.id)).toEqual(['v1']);
            expect(layer.getLayer().getLayers()).toEqual([firstMarker, secondMarker]);
            expect(groupStore.groups[0].unassignedMembers).toEqual([
                { layerId: 'ModalFilters', historyId: 'second-feature' }
            ]);
            expect(
                groupStore.getFeatureGroupMemberships({
                    layerId: 'ModalFilters',
                    historyId: 'second-feature'
                })
            ).toMatchObject([{ groupId: 'g1', groupName: 'Test', versions: [] }]);
            expect(createGroupVersion('g1', 'Third')).toBe(true);
            expect(groupStore.getActiveGroupVersion('g1')?.members).toEqual([
                { layerId: 'ModalFilters', historyId: 'second-feature' }
            ]);
            expect(groupStore.groups[0].unassignedMembers).toEqual([]);
            expect(layer.getLayer().getLayers()).toHaveLength(2);
        });

        it('removes unique version features when deleting the version and its elements', () => {
            const layer = makePointLayer('ModalFilters');
            const firstMarker = makePointMarker('first-feature');
            const secondMarker = makePointMarker('second-feature');
            layer.getLayer().addLayer(firstMarker as any);
            layer.getLayer().addLayer(secondMarker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.setGroups([
                {
                    id: 'g1',
                    name: 'Test',
                    defaultVersionId: 'v1',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [{ layerId: 'ModalFilters', historyId: 'first-feature' }]
                        },
                        {
                            id: 'v2',
                            name: 'Second',
                            members: [{ layerId: 'ModalFilters', historyId: 'second-feature' }]
                        }
                    ]
                }
            ]);

            expect(deleteGroupVersion('g1', 'v2', true)).toBe(true);
            expect(groupStore.groups[0].versions?.map((version) => version.id)).toEqual(['v1']);
            expect(layer.getLayer().getLayers()).toEqual([firstMarker]);
            expect(groupStore.groups[0].unassignedMembers ?? []).toEqual([]);
        });

        it('clears the selected version highlights and selection state', () => {
            const layer = makePointLayer('ModalFilters');
            const firstMarker = makePointMarker('first-feature');
            const secondMarker = makePointMarker('second-feature');
            layer.getLayer().addLayer(firstMarker as any);
            layer.getLayer().addLayer(secondMarker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.setGroups([
                {
                    id: 'g1',
                    name: 'Test',
                    defaultVersionId: 'v1',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [{ layerId: 'ModalFilters', historyId: 'first-feature' }]
                        },
                        {
                            id: 'v2',
                            name: 'Second',
                            members: [{ layerId: 'ModalFilters', historyId: 'second-feature' }]
                        }
                    ]
                }
            ]);
            groupStore.setActiveVersion('g1', 'v2');
            const selectionStore = useSelectionStore(pinia);
            selectionStore.setSelected([
                makeSelected('ModalFilters', 'second-feature', secondMarker as any)
            ]);
            selectionStore.markGroupSelection('g1');

            expect(deleteGroupVersion('g1', 'v2')).toBe(true);
            expect(selectionStore.selected).toEqual([]);
            expect(selectionStore.selectedGroupId).toBeNull();
        });

        it('keeps a feature referenced by another group', () => {
            const layer = makePointLayer('ModalFilters');
            const sharedMarker = makePointMarker('shared-feature');
            layer.getLayer().addLayer(sharedMarker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.setGroups([
                {
                    id: 'g1',
                    name: 'First group',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [{ layerId: 'ModalFilters', historyId: 'unique-feature' }]
                        },
                        {
                            id: 'v2',
                            name: 'Second',
                            members: [{ layerId: 'ModalFilters', historyId: 'shared-feature' }]
                        }
                    ]
                },
                {
                    id: 'g2',
                    name: 'Second group',
                    members: [{ layerId: 'ModalFilters', historyId: 'shared-feature' }]
                }
            ]);

            expect(deleteGroupVersion('g1', 'v2', true)).toBe(true);
            expect(layer.getLayer().getLayers()).toEqual([sharedMarker]);
        });
    });
});
