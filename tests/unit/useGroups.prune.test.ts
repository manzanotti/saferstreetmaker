/**
 * Tests for useGroups — pruneDanglingGroupMembers().
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
import { pruneDanglingGroupMembers } from '../../src/composables/useGroups';
import { makePointLayer, makePointMarker } from './useGroups.helpers';

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

    // ── pruneDanglingGroupMembers ─────────────────────────────────────────────

    describe('pruneDanglingGroupMembers()', () => {
        it('prunes deleted unassigned features without losing surviving group membership', () => {
            const layer = makePointLayer('ModalFilters');
            layer.getLayer().addLayer(makePointMarker('kept') as any);
            useMapStore(pinia).setLayers([layer]);
            const store = useGroupStore(pinia);
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Group',
                    versions: [{ id: 'v1', name: 'First', members: [] }],
                    unassignedMembers: [
                        { layerId: 'ModalFilters', historyId: 'kept' },
                        { layerId: 'ModalFilters', historyId: 'deleted' }
                    ]
                }
            ]);
            expect(pruneDanglingGroupMembers()).toBe(true);
            expect(store.groups[0].unassignedMembers).toEqual([
                { layerId: 'ModalFilters', historyId: 'kept' }
            ]);
            expect(pruneDanglingGroupMembers()).toBe(false);
        });
        it('removes members whose feature no longer exists on the map', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'G',
                members: [
                    { layerId: 'ModalFilters', historyId: 'h1' },
                    { layerId: 'ModalFilters', historyId: 'gone' }
                ]
            });

            const changed = pruneDanglingGroupMembers();

            expect(changed).toBe(true);
            expect(groupStore.groups[0].members).toEqual([
                { layerId: 'ModalFilters', historyId: 'h1' }
            ]);
        });

        it('returns false and leaves groups intact when all members exist', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'G',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            const changed = pruneDanglingGroupMembers();

            expect(changed).toBe(false);
            expect(groupStore.groups[0].members).toHaveLength(1);
        });

        it('preserves the selected version while pruning another version', () => {
            const layer = makePointLayer('ModalFilters');
            const alternativeMarker = makePointMarker('alternative');
            layer.getLayer().addLayer(alternativeMarker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.setGroups([
                {
                    id: 'g1',
                    name: 'G',
                    defaultVersionId: 'default',
                    versions: [
                        {
                            id: 'default',
                            name: 'Default',
                            members: [{ layerId: 'ModalFilters', historyId: 'missing' }]
                        },
                        {
                            id: 'alternative',
                            name: 'Alternative',
                            members: [
                                { layerId: 'ModalFilters', historyId: 'alternative' },
                                { layerId: 'ModalFilters', historyId: 'also-missing' }
                            ]
                        }
                    ]
                }
            ]);
            groupStore.setActiveVersion('g1', 'alternative');

            expect(pruneDanglingGroupMembers()).toBe(true);
            expect(groupStore.activeVersionIds.g1).toBe('alternative');
            expect(groupStore.groups[0].members).toEqual([
                { layerId: 'ModalFilters', historyId: 'alternative' }
            ]);
        });

        it('is a no-op when there are no groups', () => {
            useMapStore(pinia).setLayers([makePointLayer('ModalFilters')]);
            expect(pruneDanglingGroupMembers()).toBe(false);
        });
    });
});
