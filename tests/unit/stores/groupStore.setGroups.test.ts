/**
 * Unit tests for groupStore — setGroups().
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia } from 'pinia';
import { pinia } from '../../../src/stores/index';
import { useGroupStore } from '../../../src/stores/groupStore';
import type { Group } from '../../../src/models/Group';
import { makeGroup } from './groupStore.helpers';

describe('groupStore', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        useGroupStore(pinia).setGroups([]);
        useGroupStore(pinia).setAllHidden(false);
        useGroupStore(pinia).clearPendingState();
        useGroupStore(pinia).closeNameDialog();
        useGroupStore(pinia).closeSplitDialog();
        useGroupStore(pinia).closePhasesDialog();
    });

    // ── setGroups ─────────────────────────────────────────────────────────────

    describe('setGroups()', () => {
        it('replaces the groups array', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'Group 1')]);
            expect(store.groups).toHaveLength(1);

            store.setGroups([makeGroup('g2', 'Group 2'), makeGroup('g3', 'Group 3')]);
            expect(store.groups).toHaveLength(2);
            expect(store.groups[0].id).toBe('g2');
        });

        it('clears groups when called with an empty array', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'Group 1')]);
            store.setGroups([]);
            expect(store.groups).toHaveLength(0);
        });

        it('refreshes feature membership lookups after version membership changes', () => {
            const store = useGroupStore();
            const member = { layerId: 'ModalFilters', historyId: 'feature-1' };
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Group 1',
                    defaultVersionId: 'v2',
                    versions: [
                        { id: 'v1', name: 'Current', members: [member] },
                        { id: 'v2', name: 'Alternative', members: [] }
                    ]
                }
            ]);

            const firstSummaries = store.getFeatureGroupMemberships(member);
            expect(firstSummaries[0]?.versions).toEqual([{ id: 'v1', name: 'Current' }]);
            firstSummaries[0]?.versions.push({ id: 'corrupt', name: 'Corrupt' });
            expect(store.getFeatureGroupMemberships(member)[0]?.versions).toEqual([
                { id: 'v1', name: 'Current' }
            ]);
            store.addMembersToGroup('g1', [member]);
            expect(store.getFeatureGroupMemberships(member)[0]?.versions).toEqual([
                { id: 'v1', name: 'Current' },
                { id: 'v2', name: 'Alternative' }
            ]);
            expect(
                store.getFeatureMemberships(member).map(({ versionId, isActive }) => ({
                    versionId,
                    isActive
                }))
            ).toEqual([
                { versionId: 'v1', isActive: false },
                { versionId: 'v2', isActive: true }
            ]);

            store.removeMemberFromVersions('g1', ['v1'], member);
            expect(store.getFeatureGroupMemberships(member)[0]?.versions).toEqual([
                { id: 'v2', name: 'Alternative' }
            ]);
            store.removeMemberFromVersions('g1', ['v2'], member);
            expect(store.getFeatureGroupMemberships(member)).toEqual([]);
        });

        it('clears a pending empty-group deletion when restored members make it invalid', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'Group 1')]);
            store.setPendingEmptyGroupDeletion('g1');

            store.setGroups([makeGroup('g1', 'Group 1', ['restored-member'])]);

            expect(store.pendingEmptyGroupDeletionId).toBeNull();
        });

        it('removes phase members that are absent from replacement group data', () => {
            const store = useGroupStore();
            const kept = { layerId: 'ModalFilters', historyId: 'kept' };
            const dangling = { layerId: 'ModalFilters', historyId: 'dangling' };

            store.setGroups([
                {
                    id: 'g1',
                    name: 'Group 1',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [kept],
                            phases: [{ id: 'phase-1', members: [kept, dangling] }]
                        }
                    ]
                }
            ]);

            expect(store.groups[0].versions?.[0].phases?.[0].members).toEqual([kept]);
        });

        it('closes phase editing when the replacement groups omit its group', () => {
            const store = useGroupStore();
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Group 1',
                    versions: [{ id: 'v1', name: 'First', members: [] }]
                }
            ]);
            store.openPhasesDialog('g1', 'v1');

            store.setGroups([]);

            expect(store.phasesDialogOpen).toBe(false);
            expect(store.phaseGroupId).toBeNull();
            expect(store.phaseVersionId).toBeNull();
            expect(store.phaseDraftActive).toBe(false);
        });

        it('closes phase editing when the replacement group omits its version', () => {
            const store = useGroupStore();
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Group 1',
                    versions: [{ id: 'v1', name: 'First', members: [] }]
                }
            ]);
            store.openPhasesDialog('g1', 'v1');

            store.setGroups([
                {
                    id: 'g1',
                    name: 'Group 1',
                    versions: [{ id: 'v2', name: 'Second', members: [] }]
                }
            ]);

            expect(store.phasesDialogOpen).toBe(false);
            expect(store.phaseGroupId).toBeNull();
            expect(store.phaseVersionId).toBeNull();
            expect(store.phaseDraftActive).toBe(false);
        });
    });
});
