/**
 * Unit tests for UndoJournal — no-op and view-only checkpoint cleanup.
 */
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UndoJournal } from '../../src/services/UndoJournal';
import type { SerializedMap } from '../../src/services/MapSerializer';
import { viewSnapshot, isNoOp } from './UndoJournal.helpers';

describe('UndoJournal', () => {
    let journal: UndoJournal;

    beforeEach(async () => {
        await Dexie.delete('SaferStreetMakerDB');
        journal = new UndoJournal();
    });

    afterEach(async () => {
        await Dexie.delete('SaferStreetMakerDB');
    });

    describe('pruneNoOpCheckpoints', () => {
        it('removes view-only entries, keeps feature entries, and compacts sequences', async () => {
            await journal.clearHistory('Prune');
            // A: feature change (adds a layer).
            await journal.recordCheckpoint(
                'Prune',
                viewSnapshot(12, {}),
                viewSnapshot(12, { L: { a: 1 } })
            );
            // B: view-only change (zoom only) — should be pruned.
            await journal.recordCheckpoint(
                'Prune',
                viewSnapshot(12, { L: { a: 1 } }),
                viewSnapshot(15, { L: { a: 1 } })
            );
            // C: feature change.
            await journal.recordCheckpoint(
                'Prune',
                viewSnapshot(15, { L: { a: 1 } }),
                viewSnapshot(15, { L: { a: 2 } })
            );

            const removed = await journal.pruneNoOpCheckpoints('Prune', isNoOp);
            expect(removed).toBe(1);

            expect(await journal.getStatus('Prune')).toEqual({ canUndo: true, canRedo: false });

            // Undo walks the two surviving feature entries in order.
            const first = await journal.undo('Prune');
            expect((first as SerializedMap).layers).toEqual({ L: { a: 1 } });
            const second = await journal.undo('Prune');
            expect((second as SerializedMap).layers).toEqual({});
            expect(await journal.getStatus('Prune')).toEqual({ canUndo: false, canRedo: true });
        });

        it('adjusts currentSequence when a no-op below the current position is removed', async () => {
            await journal.clearHistory('PruneMid');
            await journal.recordCheckpoint(
                'PruneMid',
                viewSnapshot(12, {}),
                viewSnapshot(12, { L: 1 })
            );
            await journal.recordCheckpoint(
                'PruneMid',
                viewSnapshot(12, { L: 1 }),
                viewSnapshot(15, { L: 1 })
            ); // view-only
            await journal.recordCheckpoint(
                'PruneMid',
                viewSnapshot(15, { L: 1 }),
                viewSnapshot(15, { L: 2 })
            );

            // Undo C so the current position sits above the view-only entry.
            await journal.undo('PruneMid');

            const removed = await journal.pruneNoOpCheckpoints('PruneMid', isNoOp);
            expect(removed).toBe(1);
            // Survivors A + C; position still allows both undo (A) and redo (C).
            expect(await journal.getStatus('PruneMid')).toEqual({ canUndo: true, canRedo: true });
        });

        it('renumbers currentSequence correctly after cap-pruned history is compacted', async () => {
            await journal.clearHistory('PruneAfterCap');

            for (let i = 0; i <= UndoJournal.MAX_HISTORY; i++) {
                await journal.recordCheckpoint(
                    'PruneAfterCap',
                    viewSnapshot(12, { L: i }),
                    i === 150 ? viewSnapshot(15, { L: i }) : viewSnapshot(12, { L: i + 1 })
                );
            }

            const removed = await journal.pruneNoOpCheckpoints('PruneAfterCap', isNoOp);
            expect(removed).toBe(1);

            expect(await journal.getStatus('PruneAfterCap')).toEqual({
                canUndo: true,
                canRedo: false
            });

            const firstUndo = await journal.undo('PruneAfterCap');
            expect(firstUndo).not.toBeNull();
            expect((firstUndo as SerializedMap).layers).toEqual({ L: UndoJournal.MAX_HISTORY });
            expect(await journal.getStatus('PruneAfterCap')).toEqual({
                canUndo: true,
                canRedo: true
            });
        });

        it('returns 0 and preserves history when there are no no-op entries', async () => {
            await journal.clearHistory('NoNoop');
            await journal.recordCheckpoint(
                'NoNoop',
                viewSnapshot(12, {}),
                viewSnapshot(12, { L: 1 })
            );

            const removed = await journal.pruneNoOpCheckpoints('NoNoop', isNoOp);
            expect(removed).toBe(0);
            expect(await journal.getStatus('NoNoop')).toEqual({ canUndo: true, canRedo: false });
        });
    });

    describe('migrateRemoveViewOnlyCheckpoints', () => {
        it('strips legacy view-only entries once, then never runs again', async () => {
            await journal.clearHistory('Mig');
            await journal.recordCheckpoint('Mig', viewSnapshot(12, {}), viewSnapshot(15, {})); // view-only
            await journal.recordCheckpoint('Mig', viewSnapshot(15, {}), viewSnapshot(15, { L: 1 })); // feature

            await journal.migrateRemoveViewOnlyCheckpoints(['Mig'], isNoOp);

            // Only the single feature entry survives.
            expect(await journal.getStatus('Mig')).toEqual({ canUndo: true, canRedo: false });
            const undone = await journal.undo('Mig');
            expect((undone as SerializedMap).layers).toEqual({});
            await journal.redo('Mig');

            // A new view-only entry recorded after the migration is NOT pruned
            // on a second run, because the migration flag has been set.
            await journal.recordCheckpoint(
                'Mig',
                viewSnapshot(15, { L: 1 }),
                viewSnapshot(18, { L: 1 })
            );
            await journal.migrateRemoveViewOnlyCheckpoints(['Mig'], isNoOp);

            // Both the feature entry and the new view-only entry remain (2 undos).
            let undos = 0;
            while ((await journal.getStatus('Mig')).canUndo) {
                await journal.undo('Mig');
                undos++;
                if (undos > 5) {
                    break;
                }
            }
            expect(undos).toBe(2);
        });
    });
});
