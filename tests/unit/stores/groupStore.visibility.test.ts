/**
 * Unit tests for groupStore — visibility, solo and hidden state.
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

    it('retains solo and cancels empty-group deletion when only unassigned members remain', () => {
        const store = useGroupStore(pinia);
        const group: Group = {
            id: 'g1',
            name: 'Group',
            versions: [{ id: 'v1', name: 'First', members: [] }],
            unassignedMembers: [{ layerId: 'ModalFilters', historyId: 'free' }]
        };
        store.setGroups([group]);
        store.cycleVisibility('g1');
        store.cycleVisibility('g1');
        expect(store.soloGroupId).toBe('g1');
        store.setPendingEmptyGroupDeletion('g1');
        store.setGroups([group], true);
        expect(store.soloGroupId).toBe('g1');
        expect(store.pendingEmptyGroupDeletionId).toBeNull();
        expect(
            store.removeMemberFromVersions('g1', ['v1'], group.unassignedMembers![0], true)
        ).toBe(true);
        expect(store.getFeatureGroupMemberships(group.unassignedMembers![0])).toEqual([]);
        expect(store.soloGroupId).toBeNull();
    });

    it('cycles visible, hidden, solo and shows everything when any eye is clicked', () => {
        const store = useGroupStore(pinia);
        store.setAllHidden(false);
        store.setGroups([makeGroup('g1', 'One', ['one']), makeGroup('g2', 'Two', ['two'])]);
        store.cycleVisibility('g1');
        expect(store.hiddenGroupIds.has('g1')).toBe(true);
        store.cycleVisibility('g1');
        expect(store.soloGroupId).toBe('g1');
        expect([...store.effectiveHiddenGroupIds]).toEqual(['g2']);
        expect(store.hiddenGroupIds.size).toBe(0);
        store.cycleVisibility('g2');
        expect(store.soloGroupId).toBeNull();
        expect(store.effectiveHiddenGroupIds.size).toBe(0);
    });

    it('clears solo when its group disappears or loses its final member', () => {
        const store = useGroupStore(pinia);
        store.setGroups([makeGroup('g1', 'One', ['one'])]);
        store.cycleVisibility('g1');
        store.cycleVisibility('g1');
        store.clearGroupMembers('g1');
        expect(store.soloGroupId).toBeNull();
        store.setGroups([makeGroup('g1', 'One', ['one'])]);
        store.cycleVisibility('g1');
        store.cycleVisibility('g1');
        store.removeGroup('g1');
        expect(store.soloGroupId).toBeNull();
        expect(store.hiddenGroupIds.size).toBe(0);
    });

    it('retains solo across same-map group updates but resets with master visibility', () => {
        const store = useGroupStore(pinia);
        store.setGroups([makeGroup('g1', 'One', ['one'])]);
        store.cycleVisibility('g1');
        store.cycleVisibility('g1');
        store.setGroups([makeGroup('g1', 'Updated', ['one', 'two'])], true);
        expect(store.soloGroupId).toBe('g1');
        store.setAllHidden(false);
        expect(store.soloGroupId).toBeNull();
        store.cycleVisibility('missing');
        expect(store.hiddenGroupIds.size).toBe(0);
        store.setGroups([makeGroup('empty', 'Empty')]);
        store.cycleVisibility('empty');
        store.cycleVisibility('empty');
        expect(store.soloGroupId).toBeNull();
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
});
