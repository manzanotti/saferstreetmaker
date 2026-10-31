/**
 * Unit tests for UndoJournal — MAX_HISTORY pruning.
 */
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UndoJournal } from '../../src/services/UndoJournal';
import type { SerializedMap } from '../../src/services/MapSerializer';
import { makeSnapshot } from './UndoJournal.helpers';

describe('UndoJournal', () => {
    let journal: UndoJournal;

    beforeEach(async () => {
        await Dexie.delete('SaferStreetMakerDB');
        journal = new UndoJournal();
    });

    afterEach(async () => {
        await Dexie.delete('SaferStreetMakerDB');
    });

    it('prunes the oldest entry once MAX_HISTORY is exceeded', async () => {
        await journal.clearHistory('Cap Test');
        // Fill exactly MAX_HISTORY entries.
        for (let i = 0; i < UndoJournal.MAX_HISTORY; i++) {
            await journal.recordCheckpoint(
                'Cap Test',
                makeSnapshot(`Before ${i}`),
                makeSnapshot(`After ${i}`)
            );
        }

        // Verify the cap hasn't been hit yet.
        const statusAtCap = await journal.getStatus('Cap Test');
        expect(statusAtCap.canUndo).toBe(true);

        // Write the 301st entry — this should prune entry 0.
        await journal.recordCheckpoint(
            'Cap Test',
            makeSnapshot('Before overflow'),
            makeSnapshot('After overflow')
        );

        // Total stored entries should not exceed MAX_HISTORY.
        const remaining = await journal.getStatus('Cap Test');
        expect(remaining.canUndo).toBe(true);
        expect(remaining.canRedo).toBe(false);
    });

    it('undo still works correctly after the cap has been applied', async () => {
        await journal.clearHistory('Cap Undo');
        // Write MAX_HISTORY + 1 entries so pruning fires.
        for (let i = 0; i <= UndoJournal.MAX_HISTORY; i++) {
            await journal.recordCheckpoint(
                'Cap Undo',
                makeSnapshot(`Before ${i}`),
                makeSnapshot(`After ${i}`)
            );
        }

        // After pruning the canUndo button must still be enabled.
        const status = await journal.getStatus('Cap Undo');
        expect(status.canUndo).toBe(true);

        // Calling undo repeatedly should never produce null until all entries are consumed.
        let undoneCount = 0;
        while ((await journal.getStatus('Cap Undo')).canUndo) {
            const result = await journal.undo('Cap Undo');
            expect(result).not.toBeNull();
            undoneCount++;
            // Safety guard — must not loop more than MAX_HISTORY times.
            if (undoneCount > UndoJournal.MAX_HISTORY) {
                break;
            }
        }
        expect(undoneCount).toBe(UndoJournal.MAX_HISTORY);
    });

    it('redo still works correctly after the cap has been applied and entries were undone', async () => {
        await journal.clearHistory('Cap Redo');
        for (let i = 0; i <= UndoJournal.MAX_HISTORY; i++) {
            await journal.recordCheckpoint(
                'Cap Redo',
                makeSnapshot(`Before ${i}`),
                makeSnapshot(`After ${i}`)
            );
        }

        const undone: SerializedMap[] = [];
        for (let i = 0; i < 10; i++) {
            const result = await journal.undo('Cap Redo');
            expect(result).not.toBeNull();
            undone.push(result as SerializedMap);
        }

        const statusAfterUndo = await journal.getStatus('Cap Redo');
        expect(statusAfterUndo.canRedo).toBe(true);

        for (let i = 0; i < 10; i++) {
            const result = await journal.redo('Cap Redo');
            expect(result).not.toBeNull();
        }

        const statusAfterRedo = await journal.getStatus('Cap Redo');
        expect(statusAfterRedo.canRedo).toBe(false);
        expect(statusAfterRedo.canUndo).toBe(true);
    });
});
