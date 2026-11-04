import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UndoJournal } from '../../src/services/UndoJournal';
import { viewSnapshot } from './UndoJournal.helpers';

describe('history checkpoint migration', () => {
    let journal: UndoJournal;

    beforeEach(async () => {
        await Dexie.delete('SaferStreetMakerDB');
        journal = new UndoJournal();
    });

    afterEach(async () => {
        await Dexie.delete('SaferStreetMakerDB');
    });

    it('can retry a migration that failed partway through its map list', async () => {
        await journal.recordCheckpoint('First', viewSnapshot(12, {}), viewSnapshot(15, {}));
        await journal.recordCheckpoint('Second', viewSnapshot(12, {}), viewSnapshot(15, {}));

        let calls = 0;
        await expect(
            journal.migrateRemoveViewOnlyCheckpoints(['First', 'Second'], () => {
                calls++;
                if (calls === 2) {
                    throw new Error('Migration failed');
                }
                return true;
            })
        ).rejects.toThrow('Migration failed');

        expect((await journal.getStatus('First')).canUndo).toBe(false);
        expect((await journal.getStatus('Second')).canUndo).toBe(true);

        await journal.migrateRemoveViewOnlyCheckpoints(['First', 'Second'], () => true);
        expect((await journal.getStatus('Second')).canUndo).toBe(false);
    });
});
