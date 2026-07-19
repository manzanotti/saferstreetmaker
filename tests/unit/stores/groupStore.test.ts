import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia } from 'pinia';
import { pinia } from '../../../src/stores/index';
import { useGroupStore } from '../../../src/stores/groupStore';
import type { Group } from '../../../src/models/Group';

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
