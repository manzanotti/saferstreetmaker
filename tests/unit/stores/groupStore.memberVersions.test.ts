/**
 * Unit tests for groupStore — removing and replacing members across versions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia } from 'pinia';
import { pinia } from '../../../src/stores/index';
import { useGroupStore } from '../../../src/stores/groupStore';

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

    describe('removeMemberFromVersions()', () => {
        it('removes a shared feature only from the requested version', () => {
            const store = useGroupStore();
            const member = { layerId: 'MobilityLanes', historyId: 'shared-line' };
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Versioned streets',
                    defaultVersionId: 'v1',
                    versions: [
                        { id: 'v1', name: 'Current', members: [member] },
                        { id: 'v2', name: 'Alternative', members: [{ ...member }] }
                    ]
                }
            ]);

            expect(store.removeMemberFromVersions('g1', ['v1'], member)).toBe(true);
            expect(store.groups[0].versions).toEqual([
                { id: 'v1', name: 'Current', members: [] },
                { id: 'v2', name: 'Alternative', members: [member] }
            ]);
            expect(store.groups[0].members).toEqual([]);
        });

        it('removes the member from phases in every targeted version', () => {
            const store = useGroupStore();
            const member = { layerId: 'ModalFilters', historyId: 'member' };
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Phased',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [member],
                            phases: [{ id: 'phase-1', members: [member] }]
                        },
                        {
                            id: 'v2',
                            name: 'Second',
                            members: [{ ...member }],
                            phases: [{ id: 'phase-2', members: [{ ...member }] }]
                        }
                    ]
                }
            ]);

            expect(store.removeMemberFromVersions('g1', ['v1', 'v2'], member)).toBe(true);
            expect(store.groups[0].versions?.flatMap((version) => version.phases ?? [])).toEqual([
                { id: 'phase-1', members: [] },
                { id: 'phase-2', members: [] }
            ]);
        });
    });

    describe('replaceVersionMember()', () => {
        it('changes only the requested version member', () => {
            const store = useGroupStore();
            const sharedMember = { layerId: 'LtnCells', historyId: 'polygon-shared' };
            const clonedMember = { layerId: 'LtnCells', historyId: 'polygon-clone' };
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Versioned',
                    defaultVersionId: 'v1',
                    versions: [
                        { id: 'v1', name: 'First', members: [sharedMember] },
                        { id: 'v2', name: 'Alternative', members: [{ ...sharedMember }] }
                    ],
                    members: [sharedMember]
                }
            ]);

            expect(store.replaceVersionMember('g1', 'v2', sharedMember, clonedMember)).toBe(true);
            expect(store.groups[0].versions).toEqual([
                { id: 'v1', name: 'First', members: [sharedMember] },
                { id: 'v2', name: 'Alternative', members: [clonedMember] }
            ]);
            expect(store.groups[0].members).toEqual([sharedMember]);
        });

        it('replaces the same member in that version phases', () => {
            const store = useGroupStore();
            const original = { layerId: 'LtnCells', historyId: 'original' };
            const replacement = { layerId: 'LtnCells', historyId: 'replacement' };
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Phased',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [original],
                            phases: [{ id: 'phase-1', members: [original] }]
                        }
                    ]
                }
            ]);

            expect(store.replaceVersionMember('g1', 'v1', original, replacement)).toBe(true);
            expect(store.groups[0].versions?.[0].phases?.[0].members).toEqual([replacement]);
        });
    });
});
