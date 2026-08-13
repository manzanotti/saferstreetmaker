import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia } from 'pinia';
import { pinia } from '../../../src/stores/index';
import { useGroupStore } from '../../../src/stores/groupStore';
import type { Group, GroupVersion } from '../../../src/models/Group';

function makeGroup(id: string, name: string, memberHistoryIds: string[] = []): Group {
    return {
        id,
        name,
        members: memberHistoryIds.map((historyId) => ({ layerId: 'ModalFilters', historyId }))
    };
}

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
    });

    // ── addGroup ──────────────────────────────────────────────────────────────

    describe('addGroup()', () => {
        it('appends a group', () => {
            const store = useGroupStore();
            store.addGroup(makeGroup('g1', 'Alpha'));
            store.addGroup(makeGroup('g2', 'Beta'));
            expect(store.groups).toHaveLength(2);
            expect(store.groups[1].name).toBe('Beta');
        });

        it('sets the active version for a legacy group', () => {
            const store = useGroupStore();
            store.addGroup(makeGroup('g1', 'Alpha'));

            expect(store.activeVersionIds.g1).toBe('g1:default');
        });
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
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Alpha',
                    versions: [{ id: 'v1', name: 'First', members: [] }]
                }
            ]);
            const phases = [
                { id: 'phase-1', members: [{ layerId: 'ModalFilters', historyId: 'one' }] },
                { id: 'phase-2', members: [{ layerId: 'ModalFilters', historyId: 'two' }] }
            ];

            expect(store.replaceVersionPhases('g1', 'v1', phases)).toBe(true);
            expect(store.groups[0].versions?.[0].phases).toEqual(phases);
            expect(store.reorderVersionPhases('g1', 'v1', ['phase-2', 'phase-1'])).toBe(true);
            expect(store.groups[0].versions?.[0].phases?.map((phase) => phase.id)).toEqual([
                'phase-2',
                'phase-1'
            ]);
        });
    });

    // ── renameGroup ───────────────────────────────────────────────────────────

    describe('renameGroup()', () => {
        it('renames the matching group', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'Old Name')]);
            store.renameGroup('g1', 'New Name');
            expect(store.groups[0].name).toBe('New Name');
        });

        it('leaves other groups unchanged', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'Alpha'), makeGroup('g2', 'Beta')]);
            store.renameGroup('g1', 'Gamma');
            expect(store.groups[1].name).toBe('Beta');
        });
    });

    describe('setDescription()', () => {
        it('sanitizes and stores a changed description', () => {
            const store = useGroupStore();
            store.addGroup(makeGroup('g1', 'Alpha'));

            expect(store.setDescription('g1', '<p onclick="bad()">Hello</p>')).toBe(true);
            expect(store.groups[0].description).toBe('<p>Hello</p>');
        });

        it('reports false and does not update when the effective value is unchanged', () => {
            const store = useGroupStore();
            store.addGroup({ ...makeGroup('g1', 'Alpha'), description: '<p>Hello</p>' });

            expect(store.setDescription('g1', '<p onclick="bad()">Hello</p>')).toBe(false);
            expect(store.groups[0].description).toBe('<p>Hello</p>');
        });
    });

    describe('details dialog state and metadata', () => {
        it('opens details for an existing group and clears it when the group is removed', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'Alpha')]);

            store.openDetailsDialog('g1');
            expect(store.detailsGroupId).toBe('g1');

            store.removeGroup('g1');
            expect(store.detailsGroupId).toBeNull();
        });

        it('updates metadata as one normalized mutation and rejects blank names', () => {
            const store = useGroupStore();
            store.addGroup(makeGroup('g1', 'Alpha'));

            expect(store.setMetadata('g1', '  Beta  ', '#123456', '<p>Hello</p>')).toBe(true);
            expect(store.groups[0]).toMatchObject({
                name: 'Beta',
                color: '#123456',
                description: '<p>Hello</p>'
            });
            expect(store.setMetadata('g1', '   ', '#ffffff', '')).toBe(false);
        });
    });

    // ── removeGroup ───────────────────────────────────────────────────────────

    describe('removeGroup()', () => {
        it('removes the group by id', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'A'), makeGroup('g2', 'B')]);
            store.removeGroup('g1');
            expect(store.groups).toHaveLength(1);
            expect(store.groups[0].id).toBe('g2');
        });

        it('also removes the id from hiddenGroupIds', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'A')]);
            store.toggleHidden('g1');
            expect(store.hiddenGroupIds.has('g1')).toBe(true);
            store.removeGroup('g1');
            expect(store.hiddenGroupIds.has('g1')).toBe(false);
        });
    });

    // ── addMembersToGroup ─────────────────────────────────────────────────────

    describe('addMembersToGroup()', () => {
        it('appends new members', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'A', ['h1'])]);
            store.addMembersToGroup('g1', [{ layerId: 'BusGates', historyId: 'h2' }]);
            expect(store.groups[0].members).toHaveLength(2);
        });

        it('does not duplicate existing members', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'A', ['h1'])]);
            store.addMembersToGroup('g1', [{ layerId: 'ModalFilters', historyId: 'h1' }]);
            expect(store.groups[0].members).toHaveLength(1);
        });
    });

    describe('replaceActiveVersionMembers()', () => {
        it('replaces members in the active version and group projection', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'A', ['h1', 'h2'])]);

            expect(
                store.replaceActiveVersionMembers('g1', [
                    { layerId: 'ModalFilters', historyId: 'h2' }
                ])
            ).toBe(true);
            expect(store.groups[0].members).toEqual([{ layerId: 'ModalFilters', historyId: 'h2' }]);
            expect(store.getActiveGroupVersion('g1')?.members).toEqual([
                { layerId: 'ModalFilters', historyId: 'h2' }
            ]);
        });

        it('deduplicates members by layer and history id', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'A')]);
            const member = { layerId: 'LtnCells', historyId: 'polygon-1' };

            expect(store.replaceActiveVersionMembers('g1', [member, { ...member }])).toBe(true);
            expect(store.groups[0].members).toEqual([member]);
        });

        it('preserves a matching feature in inactive versions', () => {
            const store = useGroupStore();
            const member = { layerId: 'LtnCells', historyId: 'polygon-shared' };
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Versioned',
                    defaultVersionId: 'v1',
                    versions: [
                        { id: 'v1', name: 'First', members: [member] },
                        { id: 'v2', name: 'Alternative', members: [{ ...member }] }
                    ],
                    members: [member]
                }
            ]);

            expect(store.replaceActiveVersionMembers('g1', [])).toBe(true);
            expect(store.groups[0].versions).toEqual([
                { id: 'v1', name: 'First', members: [] },
                { id: 'v2', name: 'Alternative', members: [member] }
            ]);
        });
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
    });

    // ── clearGroupMembers ─────────────────────────────────────────────────────

    describe('clearGroupMembers()', () => {
        it('empties the members array', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'A', ['h1', 'h2'])]);
            store.clearGroupMembers('g1');
            expect(store.groups[0].members).toHaveLength(0);
        });
    });

    // ── toggleHidden / setAllHidden ───────────────────────────────────────────

    describe('toggleHidden()', () => {
        it('adds id to hiddenGroupIds when not present', () => {
            const store = useGroupStore();
            store.toggleHidden('g1');
            expect(store.hiddenGroupIds.has('g1')).toBe(true);
        });

        it('removes id from hiddenGroupIds when already present', () => {
            const store = useGroupStore();
            store.toggleHidden('g1');
            store.toggleHidden('g1');
            expect(store.hiddenGroupIds.has('g1')).toBe(false);
        });
    });

    describe('setAllHidden()', () => {
        it('hides all groups when true', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'A'), makeGroup('g2', 'B')]);
            store.setAllHidden(true);
            expect(store.hiddenGroupIds.has('g1')).toBe(true);
            expect(store.hiddenGroupIds.has('g2')).toBe(true);
        });

        it('shows all groups when false', () => {
            const store = useGroupStore();
            store.setGroups([makeGroup('g1', 'A'), makeGroup('g2', 'B')]);
            store.setAllHidden(true);
            store.setAllHidden(false);
            expect(store.hiddenGroupIds.size).toBe(0);
        });
    });

    // ── Dialog state ──────────────────────────────────────────────────────────

    describe('openNameDialog() / closeNameDialog()', () => {
        it('opens and closes name dialog', () => {
            const store = useGroupStore();
            expect(store.nameDialogOpen).toBe(false);
            store.openNameDialog();
            expect(store.nameDialogOpen).toBe(true);
            store.closeNameDialog();
            expect(store.nameDialogOpen).toBe(false);
        });

        it('sets renameGroupId in rename mode', () => {
            const store = useGroupStore();
            store.openNameDialog('g1');
            expect(store.renameGroupId).toBe('g1');
            store.closeNameDialog();
            expect(store.renameGroupId).toBeNull();
        });
    });

    describe('openSplitDialog() / closeSplitDialog()', () => {
        it('opens and closes split dialog and stores pending splits', () => {
            const store = useGroupStore();
            const fakeSplit = {
                layerId: 'MobilityLanes',
                layerTitle: 'Mobility Lane',
                marker: {} as any,
                selectedLatLngs: [],
                allLatLngs: []
            };
            store.openSplitDialog([fakeSplit]);
            expect(store.splitDialogOpen).toBe(true);
            expect(store.pendingSplits).toHaveLength(1);
            store.closeSplitDialog();
            expect(store.splitDialogOpen).toBe(false);
            expect(store.pendingSplits).toHaveLength(0);
        });
    });

    describe('setPendingGroupMembers() / clearPendingState()', () => {
        it('sets and clears pending members', () => {
            const store = useGroupStore();
            store.setPendingGroupMembers([{ layerId: 'ModalFilters', historyId: 'h1' }]);
            expect(store.pendingGroupMembers).toHaveLength(1);
            store.clearPendingState();
            expect(store.pendingGroupMembers).toHaveLength(0);
        });
    });
});
