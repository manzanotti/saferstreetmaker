import { describe, expect, it, vi } from 'vitest';
import { HistoryNavigationCoordinator } from '../../src/features/history/HistoryNavigationCoordinator';
import type { HistoryReplayEntry } from '../../src/services/UndoJournal';

function makeReplay(direction: 'undo' | 'redo'): HistoryReplayEntry {
    return {
        direction,
        snapshot: { layers: {} },
        entry: {
            mapTitle: 'Map',
            sequence: 0,
            kind: 'checkpoint',
            before: { layers: {} },
            after: { layers: {} },
            createdAt: new Date().toISOString(),
            mutationPayload: { lat: 52.5, lng: -1.9 }
        }
    };
}

function createCoordinator(
    overrides: Partial<ConstructorParameters<typeof HistoryNavigationCoordinator>[0]> = {}
) {
    const options: ConstructorParameters<typeof HistoryNavigationCoordinator>[0] = {
        undoJournal: {
            undoEntry: vi.fn().mockResolvedValue(makeReplay('undo')),
            redoEntry: vi.fn().mockResolvedValue(makeReplay('redo'))
        },
        getActiveHistoryTitle: vi.fn().mockReturnValue('Map'),
        applyReplay: vi.fn().mockResolvedValue(true),
        revealMutationArea: vi.fn(),
        syncHistoryStatus: vi.fn().mockResolvedValue(undefined),
        ...overrides
    };
    return { coordinator: new HistoryNavigationCoordinator(options), options };
}

describe('HistoryNavigationCoordinator', () => {
    it('applies undo, reveals its mutation area, and syncs status', async () => {
        const state = createCoordinator();

        await expect(state.coordinator.undo()).resolves.toBe(true);

        expect(state.options.undoJournal.undoEntry).toHaveBeenCalledWith('Map');
        expect(state.options.applyReplay).toHaveBeenCalledWith(
            expect.objectContaining({ direction: 'undo' })
        );
        expect(state.options.revealMutationArea).toHaveBeenCalledOnce();
        expect(state.options.syncHistoryStatus).toHaveBeenCalledOnce();
    });

    it('does not reveal a failed replay but still syncs status', async () => {
        const state = createCoordinator({ applyReplay: vi.fn().mockResolvedValue(false) });

        await expect(state.coordinator.redo()).resolves.toBe(false);

        expect(state.options.undoJournal.redoEntry).toHaveBeenCalledWith('Map');
        expect(state.options.revealMutationArea).not.toHaveBeenCalled();
        expect(state.options.syncHistoryStatus).toHaveBeenCalledOnce();
    });

    it('syncs status when navigation has no replay entry', async () => {
        const state = createCoordinator({
            undoJournal: {
                undoEntry: vi.fn().mockResolvedValue(null),
                redoEntry: vi.fn().mockResolvedValue(null)
            }
        });

        await expect(state.coordinator.undo()).resolves.toBe(false);

        expect(state.options.applyReplay).not.toHaveBeenCalled();
        expect(state.options.revealMutationArea).not.toHaveBeenCalled();
        expect(state.options.syncHistoryStatus).toHaveBeenCalledOnce();
    });

    it('serializes rapid navigation requests until the current replay completes', async () => {
        let completeFirstReplay: (() => void) | undefined;
        const firstReplay = new Promise<void>((resolve) => {
            completeFirstReplay = resolve;
        });
        const state = createCoordinator({
            applyReplay: vi
                .fn()
                .mockImplementationOnce(async () => {
                    await firstReplay;
                    return true;
                })
                .mockResolvedValueOnce(true)
        });

        const undo = state.coordinator.undo();
        const redo = state.coordinator.redo();
        await Promise.resolve();

        expect(state.options.undoJournal.undoEntry).toHaveBeenCalledOnce();
        expect(state.options.undoJournal.redoEntry).not.toHaveBeenCalled();

        completeFirstReplay?.();

        await expect(undo).resolves.toBe(true);
        await expect(redo).resolves.toBe(true);
        expect(state.options.undoJournal.redoEntry).toHaveBeenCalledOnce();
    });
});
