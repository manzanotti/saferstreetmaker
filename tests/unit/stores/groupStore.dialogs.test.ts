/**
 * Unit tests for groupStore — dialog and pending state.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia } from 'pinia';
import { pinia } from '../../../src/stores/index';
import { useGroupStore } from '../../../src/stores/groupStore';
import type { Group } from '../../../src/models/Group';

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

        it('clears all phase dialog ownership state', () => {
            const store = useGroupStore();
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Group',
                    versions: [{ id: 'v1', name: 'First', members: [] }]
                }
            ]);
            store.openPhasesDialog('g1', 'v1');

            store.clearPendingState();

            expect(store.phasesDialogOpen).toBe(false);
            expect(store.phaseGroupId).toBeNull();
            expect(store.phaseVersionId).toBeNull();
            expect(store.phaseDraftActive).toBe(false);
        });

        it('closes pending name and split dialogs', () => {
            const store = useGroupStore();
            store.openNameDialog();
            store.openSplitDialog([]);

            store.clearPendingState();

            expect(store.nameDialogOpen).toBe(false);
            expect(store.splitDialogOpen).toBe(false);
        });
    });

    describe('phase dialog ownership', () => {
        it('closes phase editing when its group is removed', () => {
            const store = useGroupStore();
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Group',
                    versions: [{ id: 'v1', name: 'First', members: [] }]
                }
            ]);
            store.openPhasesDialog('g1', 'v1');

            store.removeGroup('g1');

            expect(store.phasesDialogOpen).toBe(false);
            expect(store.phaseGroupId).toBeNull();
        });

        it('closes phase editing when its version is removed', () => {
            const store = useGroupStore();
            store.setGroups([
                {
                    id: 'g1',
                    name: 'Group',
                    versions: [
                        { id: 'v1', name: 'First', members: [] },
                        { id: 'v2', name: 'Second', members: [] }
                    ]
                }
            ]);
            store.openPhasesDialog('g1', 'v2');

            store.removeVersion('g1', 'v2');

            expect(store.phasesDialogOpen).toBe(false);
            expect(store.phaseVersionId).toBeNull();
        });
    });
});
