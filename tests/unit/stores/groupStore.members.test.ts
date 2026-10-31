/**
 * Unit tests for groupStore — adding, replacing and clearing members.
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

        it('removes phase members omitted from the active version replacement', () => {
            const store = useGroupStore();
            const kept = { layerId: 'ModalFilters', historyId: 'kept' };
            const removed = { layerId: 'ModalFilters', historyId: 'removed' };
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Phased',
                    versions: [
                        {
                            id: 'v1',
                            name: 'First',
                            members: [kept, removed],
                            phases: [{ id: 'phase-1', members: [kept, removed] }]
                        }
                    ]
                }
            ]);

            expect(store.replaceActiveVersionMembers('g1', [kept])).toBe(true);
            expect(store.groups[0].versions?.[0].phases?.[0].members).toEqual([kept]);
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

        it('clears phases in the active version', () => {
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
                        }
                    ]
                }
            ]);

            store.clearGroupMembers('g1');

            expect(store.groups[0].versions?.[0].phases?.[0].members).toEqual([]);
        });
    });
});
