/**
 * Unit tests for groupStore — adding, renaming, describing and removing groups.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia } from 'pinia';
import { pinia } from '../../../src/stores/index';
import { useGroupStore } from '../../../src/stores/groupStore';
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
});
