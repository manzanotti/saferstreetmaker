/**
 * Unit tests for groupStore — version mutations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia } from 'pinia';
import { pinia } from '../../../src/stores/index';
import { useGroupStore } from '../../../src/stores/groupStore';
import type { Group, GroupVersion } from '../../../src/models/Group';
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

    it('moves a kept version member to the unassigned pool only when no remaining version uses it', () => {
        const store = useGroupStore(pinia);
        const shared = { layerId: 'ModalFilters', historyId: 'shared' };
        const free = { layerId: 'ModalFilters', historyId: 'free' };
        store.setGroups([
            {
                id: 'g1',
                name: 'Group',
                defaultVersionId: 'v2',
                versions: [
                    { id: 'v1', name: 'First', members: [shared] },
                    { id: 'v2', name: 'Second', members: [shared, free] }
                ]
            }
        ]);
        store.removeVersion('g1', 'v2', true);
        expect(store.groups[0].unassignedMembers).toEqual([free]);
        expect(store.activeVersionIds.g1).toBe('v1');
        expect(store.groups[0].defaultVersionId).toBe('v1');
        expect(store.getFeatureGroupMemberships(shared)[0].versions).toEqual([
            { id: 'v1', name: 'First' }
        ]);
        store.addMembersToGroup('g1', [free]);
        expect(store.groups[0].unassignedMembers).toEqual([]);
        expect(store.getActiveGroupVersion('g1')?.members).toEqual([shared, free]);
    });

    describe('version mutations', () => {
        const alternativeVersion: GroupVersion = {
            id: 'v2',
            name: 'Alternative',
            members: []
        };

        it('sets a default version when adding a version to a legacy group', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'Alpha')]);

            expect(store.addVersion('g1', alternativeVersion)).toBe(true);
            expect(store.groups[0].defaultVersionId).toBe('g1:default');
        });

        it('does not select the deleted version as default for a legacy group', () => {
            const store = useGroupStore();
            store.setGroups([
                {
                    ...makeGroup('g1', 'Alpha'),
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: []
                        },
                        alternativeVersion
                    ]
                }
            ]);
            store.addVersion('g1', { id: 'v3', name: 'Third', members: [] });
            store.setDefaultVersion('g1', 'v2');

            const removed = store.removeVersion('g1', 'v1');

            expect(removed?.id).toBe('v1');
            expect(store.groups[0].defaultVersionId).toBe('v2');
            expect(store.groups[0].versions?.map((version) => version.id)).toEqual(['v2', 'v3']);
        });

        it('replaces and reorders version phases', () => {
            const store = useGroupStore();
            const firstMember = { layerId: 'ModalFilters', historyId: 'one' };
            const secondMember = { layerId: 'ModalFilters', historyId: 'two' };
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Alpha',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [firstMember, secondMember]
                        }
                    ]
                }
            ]);
            const phases = [
                { id: 'phase-1', members: [firstMember] },
                { id: 'phase-2', members: [secondMember] }
            ];

            expect(store.replaceVersionPhases('g1', 'v1', phases)).toBe(true);
            expect(store.groups[0].versions?.[0].phases).toEqual(phases);
            expect(store.reorderVersionPhases('g1', 'v1', ['phase-2', 'phase-1'])).toBe(true);
            expect(store.groups[0].versions?.[0].phases?.map((phase) => phase.id)).toEqual([
                'phase-2',
                'phase-1'
            ]);
        });

        it('rejects duplicate phase ids when reordering', () => {
            const store = useGroupStore();
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Alpha',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [],
                            phases: [
                                { id: 'phase-1', members: [] },
                                { id: 'phase-2', members: [] }
                            ]
                        }
                    ]
                }
            ]);

            expect(store.reorderVersionPhases('g1', 'v1', ['phase-1', 'phase-1'])).toBe(false);
            expect(store.groups[0].versions?.[0].phases?.map((phase) => phase.id)).toEqual([
                'phase-1',
                'phase-2'
            ]);
        });
    });
});
