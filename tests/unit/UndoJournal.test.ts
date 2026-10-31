import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UndoJournal } from '../../src/services/UndoJournal';
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

    it('stores imported layers once and resolves references during undo and redo', async () => {
        const importedLayers = [
            {
                id: 'imported-1',
                name: 'Wards',
                nameProperty: null,
                featureCollection: {
                    type: 'FeatureCollection' as const,
                    features: []
                }
            }
        ];
        const before = { ...makeSnapshot('Before'), importedLayers };
        const after = { ...makeSnapshot('After'), importedLayers };

        await journal.clearHistory('Map A');
        await journal.recordCheckpoint('Map A', before, after);

        const entry = await journal.getLatestEntry('Map A');
        expect(entry?.before).not.toHaveProperty('importedLayers');
        expect(entry?.after).not.toHaveProperty('importedLayers');
        expect(entry?.before).toHaveProperty('importedLayersRef');
        expect(entry?.after).toHaveProperty('importedLayersRef');

        await expect(journal.undo('Map A')).resolves.toEqual(before);
        await expect(journal.redo('Map A')).resolves.toEqual(after);
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
});
