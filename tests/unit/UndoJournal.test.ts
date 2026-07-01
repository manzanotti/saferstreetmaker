import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UndoJournal } from '../../src/services/UndoJournal';
import type { SerializedMap } from '../../src/services/MapSerializer';

function makeSnapshot(title: string): SerializedMap {
    return {
        settings: {
            title,
            readOnly: false,
            hideToolbar: false,
            activeLayers: [],
            centre: null,
            zoom: 12,
            version: '1.0.0'
        },
        layers: {},
        lastSaved: '2026-06-28T00:00:00.000Z'
    };
}

describe('UndoJournal', () => {
    let journal: UndoJournal;

    beforeEach(async () => {
        await Dexie.delete('SaferStreetMakerDB');
        journal = new UndoJournal();
    });

    afterEach(async () => {
        await Dexie.delete('SaferStreetMakerDB');
    });

    it('records checkpoints and exposes undo/redo status', async () => {
        await journal.clearHistory('Map A');
        await journal.recordCheckpoint('Map A', makeSnapshot('Before'), makeSnapshot('After'));

        await expect(journal.getStatus('Map A')).resolves.toEqual({
            canUndo: true,
            canRedo: false
        });
    });

    it('undoes then redoes the latest checkpoint', async () => {
        const before = makeSnapshot('Before');
        const after = makeSnapshot('After');

        await journal.clearHistory('Map A');
        await journal.recordCheckpoint('Map A', before, after);

        await expect(journal.undo('Map A')).resolves.toEqual(before);
        await expect(journal.getStatus('Map A')).resolves.toEqual({
            canUndo: false,
            canRedo: true
        });

        await expect(journal.redo('Map A')).resolves.toEqual(after);
        await expect(journal.getStatus('Map A')).resolves.toEqual({
            canUndo: true,
            canRedo: false
        });
    });

    it('stores structured mutation metadata with a checkpoint', async () => {
        await journal.clearHistory('Map A');
        await journal.recordCheckpoint(
            'Map A',
            makeSnapshot('Before'),
            makeSnapshot('After'),
            'checkpoint',
            {
                kind: 'point-add',
                layerId: 'ModalFilters',
                payload: { lat: 52.5, lng: -1.9 }
            }
        );

        await expect(journal.getLatestEntry('Map A')).resolves.toMatchObject({
            mutationKind: 'point-add',
            mutationLayerId: 'ModalFilters',
            mutationPayload: { lat: 52.5, lng: -1.9 }
        });
    });

    it('getLatestEntry returns the most recent checkpoint when multiple exist', async () => {
        await journal.clearHistory('Ordering Test');
        await journal.recordCheckpoint(
            'Ordering Test',
            makeSnapshot('Before 1'),
            makeSnapshot('After 1'),
            'checkpoint',
            { kind: 'point-add', layerId: 'ModalFilters', payload: {} }
        );
        await journal.recordCheckpoint(
            'Ordering Test',
            makeSnapshot('Before 2'),
            makeSnapshot('After 2'),
            'checkpoint',
            { kind: 'point-delete', layerId: 'ModalFilters', payload: {} }
        );
        await journal.recordCheckpoint(
            'Ordering Test',
            makeSnapshot('Before 3'),
            makeSnapshot('After 3'),
            'checkpoint',
            { kind: 'polyline-add', layerId: 'MobilityLanes', payload: {} }
        );

        await expect(journal.getLatestEntry('Ordering Test')).resolves.toMatchObject({
            mutationKind: 'polyline-add',
            mutationLayerId: 'MobilityLanes',
            sequence: 2
        });
    });

    it('stores settings mutation metadata with a checkpoint', async () => {
        await journal.clearHistory('Map A');
        await journal.recordCheckpoint(
            'Map A',
            makeSnapshot('Before'),
            makeSnapshot('After'),
            'checkpoint',
            {
                kind: 'settings-apply',
                layerId: 'settings',
                payload: {
                    before: { title: 'Before' },
                    after: { title: 'After' }
                }
            }
        );

        await expect(journal.getLatestEntry('Map A')).resolves.toMatchObject({
            mutationKind: 'settings-apply',
            mutationLayerId: 'settings',
            mutationPayload: {
                before: { title: 'Before' },
                after: { title: 'After' }
            }
        });
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
